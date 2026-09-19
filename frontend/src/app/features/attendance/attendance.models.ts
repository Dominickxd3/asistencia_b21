export interface PizarraItem {
  personaId: number;
  nombreCompleto: string;
  dni?: string | null;
  fotoUrl?: string | null;
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
  | 'anular'
  | 'ver-qr'
  | 'escanear'
  | 'historial';

export interface EventoAuditoriaItem {
  id: number;
  accion: string;
  fechaHora: string;
  usuario: string;
  valorAnterior: any;
  valorNuevo: any;
  descripcion?: string | null;
}

export interface HistorialAsistenciaView {
  asistenciaId: number;
  personaId: number;
  estadoActual: string;
  tipoRegistro: string;
  fechaHoraEntrada: string | null;
  fechaHoraSalida: string | null;
  motivoRegistroManual: string | null;
  observacion: string | null;
  eventos: EventoAuditoriaItem[];
}

export interface SolicitudAccion {
  accion: AccionFila;
  item: PizarraItem;
}

export interface HoraManualResult {
  horaEntrada?: string;
  horaSalida?: string;
  motivo: string;
}

export interface ResultadoEscaneoQr {
  resultado: 'ENTRADA' | 'SALIDA' | 'DUPLICADO' | 'YA_FINALIZADO' | 'INCIDENCIA';
  mensaje: string;
  asistenciaId?: number;
  persona: {
    id: number;
    nombreCompleto: string;
    dni?: string | null;
  };
  hora?: string;
  horaEntrada?: string;
  horaSalida?: string;
  duracion?: string;
  segundos?: number;
  fechaHoraEntrada?: string | Date;
  fechaHoraSalida?: string | Date;
}

