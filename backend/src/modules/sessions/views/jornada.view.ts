export interface JornadaView {
  id: number;
  grupoId: number;
  grupo: string;
  etapa: string;
  fecha: string;
  tipoJornada: string;
  origen: string;
  estado: string;
  inicioProgramada: Date | null;
  finProgramada: Date | null;
  fechaApertura: Date | null;
  fechaCierre: Date | null;
}
