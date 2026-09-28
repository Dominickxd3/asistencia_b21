export interface Persona {
  id: number;
  dni: string | null;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  telefono: string | null;
  correo: string | null;
  fechaNacimiento: string | null;
  estado: 'ACTIVO' | 'INACTIVO';
  etapaCodigo: string | null;
  etapa: string | null;
  grupoId: number | null;
  grupo: string | null;
  /** Usuario del sistema, si tiene cuenta */
  username: string | null;
  roles: string[];
  /** Grupo que encarga (como encargado, no como integrante) */
  encargaGrupoId: number | null;
  encargaGrupo: string | null;
  /** Personal de instrucción o administración: cuenta con rol, sin etapa ni grupo */
  esPersonal: boolean;
}

export interface FichaPersona extends Persona {
  /** Sin etapas, grupos, asistencias ni cuenta: se puede eliminar */
  eliminable: boolean;
}

export interface PaginaPersonas {
  items: Persona[];
  total: number;
  pagina: number;
  tamano: number;
}

/** Conteos del combo de categorías y grupos activos (para incorporar al registrar) */
export interface ResumenPersonas {
  total: number;
  etapas: { codigo: string; nombre: string; total: number }[];
  /** Personal del sistema (jefatura, encargados, administración) */
  instruccion: number;
  grupos: { grupoId: number; nombre: string; codigo: string; etapa: string }[];
}

export interface FiltrosPersonas {
  q: string;
  /** '' = todos · '0' = sin grupo · '-1' = personal · id */
  grupo: string;
  /** '' = todas · código de etapa · 'INSTRUCCION' (personal) */
  etapa: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'TODOS';
  pagina: number;
  tamano: number;
}

export interface PersonaForm {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  correo: string;
  fechaNacimiento: string;
}

export const nombreCompleto = (p: Pick<Persona, 'apellidoPaterno' | 'apellidoMaterno' | 'nombres'>) =>
  `${p.apellidoPaterno} ${p.apellidoMaterno ?? ''} ${p.nombres}`.replace(/\s+/g, ' ').trim();
