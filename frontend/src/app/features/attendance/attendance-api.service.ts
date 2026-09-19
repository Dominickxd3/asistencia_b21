import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GeoPayload } from '../../core/services/geo.service';
import {
  JornadaItem,
  PendienteItem,
  PizarraItem,
  ResultadoEscaneoQr,
} from './attendance.models';

@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}`;

  jornadas(fecha?: string) {
    const qs = fecha ? `?fecha=${fecha}` : '';
    return firstValueFrom(this.http.get<JornadaItem[]>(`${this.base}/sessions${qs}`));
  }

  pizarra(jornadaId: number) {
    return firstValueFrom(this.http.get<PizarraItem[]>(`${this.base}/attendance/board/${jornadaId}`));
  }

  abrirJornada(jornadaId: number) {
    return firstValueFrom(this.http.post<JornadaItem>(`${this.base}/sessions/${jornadaId}/open`, {}));
  }

  entrada(jornadaId: number, personaId: number, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.post(`${this.base}/attendance/entry`, { jornadaId, personaId, geo }),
    );
  }

  salida(asistenciaId: number, geo: GeoPayload | null) {
    return firstValueFrom(this.http.post(`${this.base}/attendance/exit`, { asistenciaId, geo }));
  }

  entradaManual(jornadaId: number, personaId: number, horaEntrada: string, motivo: string, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.post(`${this.base}/attendance/manual-entry`, { jornadaId, personaId, horaEntrada, motivo, geo }),
    );
  }

  faltaJustificada(jornadaId: number, personaId: number, motivo: string, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.post(`${this.base}/attendance/justified-absence`, { jornadaId, personaId, motivo, geo }),
    );
  }

  salidaAnticipada(asistenciaId: number, motivo: string, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.post(`${this.base}/attendance/early-exit`, { asistenciaId, motivo, geo }),
    );
  }

  observacion(asistenciaId: number, observacion: string) {
    return firstValueFrom(
      this.http.patch(`${this.base}/attendance/${asistenciaId}/observation`, { observacion }),
    );
  }

  ajusteManual(asistenciaId: number, horas: { horaEntrada?: string; horaSalida?: string }, motivo: string, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.patch(`${this.base}/attendance/${asistenciaId}/manual-adjust`, { ...horas, motivo, geo }),
    );
  }

  anular(asistenciaId: number, motivo: string, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.post(`${this.base}/attendance/${asistenciaId}/annul`, { motivo, geo }),
    );
  }

  pendientes(jornadaId: number) {
    return firstValueFrom(
      this.http.get<PendienteItem[]>(`${this.base}/attendance/sessions/${jornadaId}/pending`),
    );
  }

  cerrarJornada(jornadaId: number, convertirPendientes = false) {
    return firstValueFrom(
      this.http.post(`${this.base}/attendance/sessions/${jornadaId}/close`, { convertirPendientes }),
    );
  }

  escanearQr(jornadaId: number, qrCode: string, geo: GeoPayload | null) {
    return firstValueFrom(
      this.http.post<ResultadoEscaneoQr>(
        `${this.base}/attendance/sessions/${jornadaId}/scan-qr`,
        { qrCode, geo },
      ),
    );
  }

  observacionPersona(jornadaId: number, personaId: number, observacion: string) {
    return firstValueFrom(
      this.http.post(
        `${this.base}/attendance/sessions/${jornadaId}/persons/${personaId}/observation`,
        { observacion },
      ),
    );
  }
}
