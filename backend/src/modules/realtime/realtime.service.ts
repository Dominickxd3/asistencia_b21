import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

export const REALTIME_EVENTS = {
  ASISTENCIA_REGISTRADA: 'asistencia.registrada',
  JORNADA_ABIERTA: 'jornada.abierta',
  JORNADA_CERRADA: 'jornada.cerrada',
  DASHBOARD_ACTUALIZAR: 'dashboard.actualizar',
} as const;

export interface AsistenciaEvento {
  jornadaId: number;
  grupoId: number;
  asistenciaId: number;
  personaId: number;
  accion: 'ENTRADA' | 'SALIDA';
  estado: string;
  fechaHora: Date;
}

/**
 * Emisor centralizado. Solo se invoca DESPUES de que la operacion
 * quedo confirmada en SQL Server.
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  registrarServidor(server: Server) {
    this.server = server;
  }

  emitirAsistenciaRegistrada(evento: AsistenciaEvento): void {
    this.emitir(REALTIME_EVENTS.ASISTENCIA_REGISTRADA, evento);
    this.emitir(REALTIME_EVENTS.DASHBOARD_ACTUALIZAR, { motivo: REALTIME_EVENTS.ASISTENCIA_REGISTRADA });
  }

  emitirJornada(evento: 'jornada.abierta' | 'jornada.cerrada', data: { jornadaId: number; grupoId: number }): void {
    this.emitir(evento, data);
    this.emitir(REALTIME_EVENTS.DASHBOARD_ACTUALIZAR, { motivo: evento });
  }

  private emitir(evento: string, payload: unknown): void {
    if (!this.server) return;
    this.server.emit(evento, payload);
  }
}
