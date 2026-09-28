export enum AttendanceStatus {
  PENDIENTE = 'PENDIENTE',
  PRESENTE = 'PRESENTE',
  FINALIZADO = 'FINALIZADO',
  FALTA_JUSTIFICADA = 'FALTA_JUSTIFICADA',
  FALTA_INJUSTIFICADA = 'FALTA_INJUSTIFICADA',
  SALIDA_ANTICIPADA = 'SALIDA_ANTICIPADA',
  ANULADO = 'ANULADO',
}

export enum RegisterType {
  AUTOMATICO = 'AUTOMATICO',
  MANUAL = 'MANUAL',
}

export enum GeoStatus {
  DENTRO_ZONA = 'DENTRO_ZONA',
  FUERA_ZONA = 'FUERA_ZONA',
  NO_DISPONIBLE = 'NO_DISPONIBLE',
}

export enum GeoEventType {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  MODIFICACION = 'MODIFICACION',
  ANULACION = 'ANULACION',
}

export enum JustificationType {
  FALTA = 'FALTA',
  SALIDA_ANTICIPADA = 'SALIDA_ANTICIPADA',
  OTRA = 'OTRA',
}

export enum JustificationStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

/** Texto para el usuario final; los mensajes de error nunca muestran el código interno */
export const ETIQUETA_ESTADO_ASISTENCIA: Record<string, string> = {
  PENDIENTE: 'pendiente',
  PRESENTE: 'presente (con entrada)',
  FINALIZADO: 'con entrada y salida',
  FALTA_JUSTIFICADA: 'falta justificada',
  FALTA_INJUSTIFICADA: 'falta sin justificar',
  SALIDA_ANTICIPADA: 'salida anticipada',
  ANULADO: 'anulado',
};

export const ETIQUETA_ESTADO_JORNADA: Record<string, string> = {
  PROGRAMADA: 'programada (aún no empieza)',
  ABIERTA: 'abierta',
  CERRADA: 'cerrada',
  CANCELADA: 'cancelada',
};
