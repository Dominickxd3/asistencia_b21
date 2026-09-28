export interface GrupoEtapaView {
  id: number;
  codigo: string;
  nombre: string;
  periodo: string;
  etapaId: number;
  etapa: string;
  etapaCodigo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  totalIntegrantes: number;
  encargado: { usuarioId: number; nombre: string; desde: Date } | null;
}

export interface GrupoDetalleView extends GrupoEtapaView {
  /** true si nunca tuvo integrantes, asistencias ni reportes: se puede eliminar físicamente */
  eliminable: boolean;
  /** La etapa solo puede cambiarse mientras el grupo no tenga historia */
  etapaEditable: boolean;
  jornadasAbiertas: number;
  programacionObligatoria: { diaSemana: number; horaInicio: string }[];
  integrantes: IntegranteView[];
  historialEncargados: {
    usuarioId: number;
    nombre: string;
    desde: Date;
    hasta: Date | null;
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

export interface IntegranteView {
  id: number;
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  fechaIngreso: string;
  estado: string;
}

export interface CandidatoIntegranteView {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  etapaCodigo: string | null;
  etapa: string | null;
  grupoActualId: number | null;
  grupoActual: string | null;
  /** AGREGAR | TRANSFERIR | YA_INTEGRA | OTRA_ETAPA */
  situacion: 'AGREGAR' | 'TRANSFERIR' | 'YA_INTEGRA' | 'OTRA_ETAPA';
}

/**
 * Candidato a encargado. Los integrantes del grupo aparecen aunque no tengan cuenta:
 * al asignarlos se crea la cuenta (SIN_CUENTA) o se otorga el rol (SIN_ROL).
 */
export interface CandidatoEncargadoView {
  personaId: number;
  usuarioId: number | null;
  username: string | null;
  nombre: string;
  roles: string[];
  esIntegrante: boolean;
  situacion: 'LISTO' | 'SIN_ROL' | 'SIN_CUENTA' | 'CUENTA_INACTIVA';
  /** Solo para SIN_CUENTA: usuario propuesto, libre en la BD */
  usernameSugerido: string | null;
  grupoActualId: number | null;
  grupoActual: string | null;
}

export interface ResultadoAsignacionEncargado {
  /** Si se creó la cuenta: credenciales para entregar, se muestran una sola vez */
  credenciales: { username: string; passwordTemporal: string } | null;
  rolOtorgado: boolean;
}
