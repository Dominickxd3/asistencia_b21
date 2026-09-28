import { environment } from '../../environments/environment';
import { http } from '../../core/http/http';
import type { GeoPayload } from '../../core/services/geo.service';
import type {
  CredencialQr,
  JornadaItem,
  PizarraItem,
  RespuestaMovimiento,
  RespuestaQr,
  ResumenCierre,
} from './attendance.models';

const base = environment.apiUrl;

export const attendanceApi = {
  jornadas(fecha?: string) {
    const qs = fecha ? `?fecha=${fecha}` : '';
    return http.get<JornadaItem[]>(`${base}/sessions${qs}`);
  },

  pizarra(jornadaId: number) {
    return http.get<PizarraItem[]>(`${base}/attendance/board/${jornadaId}`);
  },

  entrada(jornadaId: number, personaId: number, geo: GeoPayload | null) {
    return http.post<RespuestaMovimiento>(`${base}/attendance/entry`, { jornadaId, personaId, geo });
  },

  salida(asistenciaId: number, geo: GeoPayload | null) {
    return http.post<RespuestaMovimiento>(`${base}/attendance/exit`, { asistenciaId, geo });
  },

  entradaManual(
    jornadaId: number,
    personaId: number,
    horaEntrada: string,
    motivo: string,
    geo: GeoPayload | null,
  ) {
    return http.post<RespuestaMovimiento>(`${base}/attendance/manual-entry`, {
      jornadaId,
      personaId,
      horaEntrada,
      motivo,
      geo,
    });
  },

  faltaJustificada(jornadaId: number, personaId: number, motivo: string, geo: GeoPayload | null) {
    return http.post<RespuestaMovimiento>(`${base}/attendance/justified-absence`, { jornadaId, personaId, motivo, geo });
  },

  salidaAnticipada(asistenciaId: number, motivo: string, geo: GeoPayload | null) {
    return http.post<RespuestaMovimiento>(`${base}/attendance/early-exit`, { asistenciaId, motivo, geo });
  },

  observacion(asistenciaId: number, observacion: string) {
    return http.patch(`${base}/attendance/${asistenciaId}/observation`, { observacion });
  },

  ajusteManual(
    asistenciaId: number,
    horas: { horaEntrada?: string; horaSalida?: string },
    motivo: string,
    geo: GeoPayload | null,
  ) {
    return http.patch<RespuestaMovimiento>(`${base}/attendance/${asistenciaId}/manual-adjust`, { ...horas, motivo, geo });
  },

  anular(asistenciaId: number, motivo: string, geo: GeoPayload | null) {
    return http.post(`${base}/attendance/${asistenciaId}/annul`, { motivo, geo });
  },

  resumenCierre(jornadaId: number) {
    return http.get<ResumenCierre>(`${base}/attendance/sessions/${jornadaId}/close-summary`);
  },

  cerrarJornada(jornadaId: number, convertirPendientes = false) {
    return http.post<{ convertidas: number; salidasRegistradas: number }>(
      `${base}/attendance/sessions/${jornadaId}/close`,
      { convertirPendientes },
    );
  },

  abrirJornada(jornadaId: number) {
    return http.post<JornadaItem>(`${base}/sessions/${jornadaId}/open`, {});
  },

  credencialesQr(grupoId: number) {
    return http.get<CredencialQr[]>(`${base}/attendance/qr/group/${grupoId}`);
  },

  rotarQr(grupoId: number, personaId: number) {
    return http.post<{ ok: boolean }>(`${base}/attendance/qr/rotate`, { grupoId, personaId });
  },

  escanearQr(
    jornadaId: number,
    codigoQr: string,
    accion: 'AUTO' | 'ENTRADA' | 'SALIDA' = 'AUTO',
    geo: GeoPayload | null,
  ) {
    return http.post<RespuestaQr>(`${base}/attendance/qr/scan`, {
      jornadaId,
      codigoQr,
      accion,
      geo,
    });
  },
};
