export type EstadoGrupo = 'ACTIVO' | 'CERRADO' | 'CANCELADO';

export interface Grupo {
  id: number;
  codigo: string;
  nombre: string;
  periodo: string;
  etapaId: number;
  etapa: string;
  etapaCodigo: string;
  estado: EstadoGrupo;
  fechaInicio: string;
  fechaFin: string | null;
  totalIntegrantes: number;
  encargado: { usuarioId: number; nombre: string; desde: string } | null;
}

export interface Integrante {
  id: number;
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  fechaIngreso: string;
  estado: string;
}

export interface GrupoDetalle extends Grupo {
  eliminable: boolean;
  etapaEditable: boolean;
  jornadasAbiertas: number;
  programacionObligatoria: HorarioObligatorio[];
  integrantes: Integrante[];
  historialEncargados: {
    usuarioId: number;
    nombre: string;
    desde: string;
    hasta: string | null;
    estado: string;
    motivo: string | null;
  }[];
  exIntegrantes: {
    personaId: number;
    nombreCompleto: string;
    fechaIngreso: string;
    fechaSalida: string | null;
    estado: string;
    motivo: string | null;
  }[];
}

export interface HorarioObligatorio {
  /** 1=lunes, ..., 7=domingo */
  diaSemana: number;
  horaInicio: string;
}

export interface CatalogosGrupo {
  etapas: { id: number; codigo: string; nombre: string; orden: number }[];
}

export interface GrupoForm {
  etapaId: number | '';
  codigo: string;
  nombre: string;
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  programacionObligatoria: HorarioObligatorio[];
}

export interface CandidatoIntegrante {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  etapaCodigo: string | null;
  etapa: string | null;
  grupoActualId: number | null;
  grupoActual: string | null;
  situacion: 'AGREGAR' | 'TRANSFERIR' | 'YA_INTEGRA' | 'OTRA_ETAPA';
}

export interface CandidatoEncargado {
  personaId: number;
  usuarioId: number | null;
  username: string | null;
  nombre: string;
  roles: string[];
  /** Integrante activo del grupo (si no, es otro usuario ya habilitado) */
  esIntegrante: boolean;
  situacion: 'LISTO' | 'SIN_ROL' | 'SIN_CUENTA' | 'CUENTA_INACTIVA';
  usernameSugerido: string | null;
  grupoActualId: number | null;
  grupoActual: string | null;
}

/** Permisos de la pantalla, derivados de los roles del usuario */
export interface PermisosGrupos {
  /** formation.manage_groups: crear, editar, cerrar, eliminar, encargado */
  gestionar: boolean;
  /** formation.manage_groups + formation.manage_people: altas y bajas de integrantes */
  integrantes: boolean;
  /** tracking.view */
  seguimiento: boolean;
}
