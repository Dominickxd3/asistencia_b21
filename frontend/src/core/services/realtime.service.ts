import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { authService } from '../auth/auth.service';

type Handler = (...args: any[]) => void;

/**
 * Canal WebSocket con el backend.
 * - El token se lee en cada (re)conexión: tras refrescar la sesión se usa el vigente.
 * - Los handlers se registran aquí y se enlazan al socket cuando existe, así una
 *   página puede suscribirse antes de que el layout abra la conexión.
 */
class RealtimeService {
  private socket: Socket | null = null;
  private estado = false;
  private readonly oyentes = new Set<() => void>();
  private readonly handlers = new Map<string, Set<Handler>>();

  get conectado(): boolean {
    return this.estado;
  }

  readonly suscribir = (oyente: () => void): (() => void) => {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  };

  readonly instantanea = (): boolean => this.estado;

  conectar(): void {
    if (!authService.token || this.socket) return;
    const socket = io(environment.wsUrl, {
      auth: (cb) => cb({ token: authService.token }),
      transports: ['websocket'],
    });
    socket.on('connect', () => this.cambiarEstado(true));
    socket.on('disconnect', () => this.cambiarEstado(false));
    for (const [evento, fns] of this.handlers) fns.forEach((fn) => socket.on(evento, fn));
    this.socket = socket;
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.cambiarEstado(false);
  }

  /** Suscribe un handler y devuelve la función que lo retira (solo ese handler). */
  on<T>(evento: string, handler: (data: T) => void): () => void {
    const fn = handler as Handler;
    if (!this.handlers.has(evento)) this.handlers.set(evento, new Set());
    this.handlers.get(evento)!.add(fn);
    this.socket?.on(evento, fn);
    return () => {
      this.handlers.get(evento)?.delete(fn);
      this.socket?.off(evento, fn);
    };
  }

  private cambiarEstado(valor: boolean): void {
    if (this.estado === valor) return;
    this.estado = valor;
    this.oyentes.forEach((o) => o());
  }
}

export const realtimeService = new RealtimeService();

/** Estado de conexión en vivo para la interfaz */
export function useRealtimeConectado(): boolean {
  return useSyncExternalStore(realtimeService.suscribir, realtimeService.instantanea);
}
