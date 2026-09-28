export interface PizarraItem {
  personaId: number;
  nombreCompleto: string;
  asistenciaId: number | null;
  estado: string | null;
  fechaHoraEntrada: string | null;
  fechaHoraSalida: string | null;
  tipoRegistro: string | null;
  observacion: string | null;
  /** Resultado geográfico del último registro de entrada / salida */
  geoEntrada: UbicacionRegistro | null;
  geoSalida: UbicacionRegistro | null;
}

export interface UbicacionRegistro {
  estado: string;
  precisionMetros: number | null;
  distanciaMetros: number | null;
}

/** Resultado de la validación geográfica que devuelve el backend tras cada acción */
export interface ResumenUbicacion {
  estado: string;
  sede: string | null;
  distanciaMetros: number | null;
  precisionMetros: number | null;
}

export interface RespuestaMovimiento {
  ubicacion?: ResumenUbicacion;
}

export interface CredencialQr {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  contenido: string;
  fechaGeneracion: string;
  imagen: string;
}

export interface RespuestaQr {
  accion: 'ENTRADA' | 'SALIDA';
  personaId: number;
  nombreCompleto: string;
  registro: RespuestaMovimiento;
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
  /** HH:mm (hora local del servidor) */
  horaInicio: string | null;
  horaFin: string | null;
}

export interface PendienteItem {
  personaId: number;
  nombreCompleto: string;
}

/** Qué ocurrirá al cerrar la jornada */
export interface ResumenCierre {
  tipoJornada: string;
  generaFaltas: boolean;
  /** Sin registro → FALTA_INJUSTIFICADA */
  pendientes: PendienteItem[];
  /** Siguen presentes → se registra su salida */
  presentes: PendienteItem[];
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
