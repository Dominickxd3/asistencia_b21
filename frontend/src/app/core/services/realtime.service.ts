import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/**
 * Canal WebSocket con el backend. Se conecta cuando hay token y
 * se desconecta al cerrar sesión o al expirar.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  readonly conectado = signal(false);

  conectar(): void {
    const token = this.auth.token;
    if (!token || this.socket) return;
    this.socket = io(environment.wsUrl, {
      auth: { token },
      transports: ['websocket'],
    });
    this.socket.on('connect', () => this.conectado.set(true));
    this.socket.on('disconnect', () => this.conectado.set(false));
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.conectado.set(false);
  }

  on<T>(evento: string, handler: (data: T) => void): void {
    this.socket?.on(evento, handler);
  }

  off(evento: string): void {
    this.socket?.off(evento);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }
}
