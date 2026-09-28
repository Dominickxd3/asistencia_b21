export interface JornadaView {
  id: number;
  grupoId: number;
  grupo: string;
  etapa: string;
  /** YYYY-MM-DD */
  fecha: string;
  tipoJornada: string;
  origen: string;
  estado: string;
  inicioProgramada: Date | null;
  finProgramada: Date | null;
  /** HH:mm en hora local del servidor (o null si no hay horario) */
  horaInicio: string | null;
  horaFin: string | null;
  fechaApertura: Date | null;
  fechaCierre: Date | null;
}
