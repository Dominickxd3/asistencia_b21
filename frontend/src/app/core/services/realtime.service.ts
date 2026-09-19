import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Canal WebSocket con el backend.
 * - Reconexión automática con token JWT fresco.
 * - Registro robusto de listeners por evento (desuscripción segura por componente).
 * - Notificación de reconexión para resincronización de datos.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private readonly listeners = new Map<string, Set<(data: any) => void>>();
  private readonly socketEventBindings = new Set<string>();
  private haEstadoConectado = false;

  readonly conectado = signal(false);
  readonly reconectado = signal<number>(0);

  conectar(): void {
    const token = this.auth.token;
    if (!token) return;

    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.auth = { token: this.auth.token };
        this.socket.connect();
      }
      return;
    }

    this.socket = io(environment.wsUrl, {
      auth: (cb) => {
        cb({ token: this.auth.token });
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.conectado.set(true);
      if (this.haEstadoConectado) {
        // Notificar a los componentes activos que se reconectó para refrescar datos
        this.reconectado.set(Date.now());
      }
      this.haEstadoConectado = true;
    });

    this.socket.on('disconnect', () => {
      this.conectado.set(false);
    });

    this.socket.on('connect_error', async (err) => {
      console.warn('Realtime WS error de conexión:', err.message);
      if (err.message?.toLowerCase().includes('token') || err.message?.toLowerCase().includes('auth')) {
        await this.auth.intentarRestaurar();
        if (this.socket && this.auth.token) {
          this.socket.auth = { token: this.auth.token };
        }
      }
    });

    // Enlazar eventos que ya tengan listeners registrados
    for (const evento of this.listeners.keys()) {
      this.enlazarEventoSocalo(evento);
    }
  }

  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.conectado.set(false);
    this.haEstadoConectado = false;
  }

  /**
   * Suscribe un handler a un evento WebSocket.
   * Retorna una función para cancelar la suscripción de forma limpia.
   */
  on<T>(evento: string, handler: (data: T) => void): () => void {
    if (!this.listeners.has(evento)) {
      this.listeners.set(evento, new Set());
    }
    this.listeners.get(evento)!.add(handler);

    if (this.socket) {
      this.enlazarEventoSocalo(evento);
    }

    return () => this.off(evento, handler);
  }

  /**
   * Desuscribe un handler específico, o todos los handlers si no se pasa handler.
   */
  off<T>(evento: string, handler?: (data: T) => void): void {
    const handlers = this.listeners.get(evento);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(evento);
        if (this.socket) {
          this.socket.off(evento);
          this.socketEventBindings.delete(evento);
        }
      }
    } else {
      this.listeners.delete(evento);
      if (this.socket) {
        this.socket.off(evento);
        this.socketEventBindings.delete(evento);
      }
    }
  }

  private enlazarEventoSocalo(evento: string): void {
    if (!this.socket || this.socketEventBindings.has(evento)) return;

    this.socketEventBindings.add(evento);
    this.socket.on(evento, (data: any) => {
      const handlers = this.listeners.get(evento);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(data);
          } catch (e) {
            console.error(`Error en handler de WebSocket para "${evento}":`, e);
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.desconectar();
    this.listeners.clear();
    this.socketEventBindings.clear();
  }
}
