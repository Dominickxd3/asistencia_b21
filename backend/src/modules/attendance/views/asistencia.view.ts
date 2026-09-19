export interface PizarraItemView {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  fotoUrl: string | null;
  asistenciaId: number | null;
  estado: string | null;
  fechaHoraEntrada: Date | null;
  fechaHoraSalida: Date | null;
  tipoRegistro: string | null;
  observacion: string | null;
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
