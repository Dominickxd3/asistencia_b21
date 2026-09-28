export interface PizarraItemView {
  personaId: number;
  nombreCompleto: string;
  asistenciaId: number | null;
  estado: string | null;
  fechaHoraEntrada: Date | null;
  fechaHoraSalida: Date | null;
  tipoRegistro: string | null;
  observacion: string | null;
  /** Resultado geográfico del último registro de entrada / salida */
  geoEntrada: UbicacionPizarraView | null;
  geoSalida: UbicacionPizarraView | null;
}

export interface UbicacionPizarraView {
  estado: string;
  precisionMetros: number | null;
  distanciaMetros: number | null;
}

export interface AsistenciaEventoView {
  asistenciaId: number;
  jornadaId: number;
  personaId: number;
  persona: string;
  grupo: string;
  accion: 'ENTRADA' | 'SALIDA';
  estado: string;
  fechaHora: Date;
  registradoPor: string;
}
