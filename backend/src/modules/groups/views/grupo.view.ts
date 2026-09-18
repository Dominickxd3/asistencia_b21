export interface GrupoEtapaView {
  id: number;
  codigo: string;
  nombre: string;
  periodo: string;
  etapa: string;
  etapaCodigo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  totalIntegrantes: number;
  encargado: { usuarioId: number; nombre: string; desde: Date } | null;
}
