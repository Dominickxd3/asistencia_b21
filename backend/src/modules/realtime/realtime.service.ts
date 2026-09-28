import { Injectable } from '@nestjs/common';
import { Namespace } from 'socket.io';

export const REALTIME_EVENTS = {
  ASISTENCIA_REGISTRADA: 'asistencia.registrada',
  JORNADA_ABIERTA: 'jornada.abierta',
  JORNADA_CERRADA: 'jornada.cerrada',
  DASHBOARD_ACTUALIZAR: 'dashboard.actualizar',
} as const;

export interface AsistenciaEvento {
  jornadaId: number;
  grupoId: number;
  tipoJornada: 'OBLIGATORIA' | 'VOLUNTARIA';
  asistenciaId: number;
  personaId: number;
  accion: 'ENTRADA' | 'SALIDA' | 'FALTA' | 'MODIFICACION' | 'ANULACION';
  estado: string;
  fechaHora: Date;
}

/** Sala de quienes pueden ver todos los grupos */
export const SALA_TODOS = 'todos';
export const salaGrupo = (grupoId: number) => `grupo:${grupoId}`;

/**
 * Emisor centralizado. Solo se invoca DESPUES de que la operacion
 * quedo confirmada en SQL Server. Cada evento llega únicamente a la sala
 * general y a la del grupo afectado.
 */
@Injectable()
export class RealtimeService {
  private server: Namespace | null = null;

  registrarServidor(server: Namespace) {
    this.server = server;
  }

  emitirAsistenciaRegistrada(evento: AsistenciaEvento): void {
    this.emitir(evento.grupoId, REALTIME_EVENTS.ASISTENCIA_REGISTRADA, evento);
    this.emitir(evento.grupoId, REALTIME_EVENTS.DASHBOARD_ACTUALIZAR, { motivo: REALTIME_EVENTS.ASISTENCIA_REGISTRADA });
  }

  emitirJornada(
    evento: 'jornada.abierta' | 'jornada.cerrada',
    data: { jornadaId: number; grupoId: number; tipoJornada: 'OBLIGATORIA' | 'VOLUNTARIA' },
  ): void {
    this.emitir(data.grupoId, evento, data);
    this.emitir(data.grupoId, REALTIME_EVENTS.DASHBOARD_ACTUALIZAR, { motivo: evento });
  }

  /** Cierra los sockets de un usuario (cuenta desactivada o contraseña cambiada) */
  async desconectarUsuario(usuarioId: number): Promise<void> {
    if (!this.server) return;
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      if (Number(s.data?.usuarioId) === usuarioId) s.disconnect(true);
    }
  }

  private emitir(grupoId: number, evento: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to([SALA_TODOS, salaGrupo(Number(grupoId))]).emit(evento, payload);
  }
}
