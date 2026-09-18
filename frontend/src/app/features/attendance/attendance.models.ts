export interface PizarraItem {
  personaId: number;
  nombreCompleto: string;
  asistenciaId: number | null;
  estado: string | null;
  fechaHoraEntrada: string | null;
  fechaHoraSalida: string | null;
  tipoRegistro: string | null;
  observacion: string | null;
}

export interface JornadaItem {
  id: number;
  grupoId: number;
  grupo: string;
  etapa: string;
  fecha: string;
  tipoJornada: string;
  origen: string;
  estado: string;
  inicioProgramada: string | null;
  finProgramada: string | null;
}

export interface PendienteItem {
  personaId: number;
  nombreCompleto: string;
}

export type AccionFila =
  | 'entrada'
  | 'salida'
  | 'hora-manual'
  | 'falta-justificada'
  | 'salida-anticipada'
  | 'observacion'
  | 'ajustar'
  | 'anular';

export interface SolicitudAccion {
  accion: AccionFila;
  item: PizarraItem;
}

export interface HoraManualResult {
  horaEntrada?: string;
  horaSalida?: string;
  motivo: string;
}
