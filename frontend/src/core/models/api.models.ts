export interface PerfilUsuario {
  id: number;
  username: string;
  persona: {
    id: number;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    nombreCompleto: string;
  };
  roles: { codigo: string; nombre: string }[];
  permisos: string[];
}

export interface ResumenHoy {
  presentesAhora: number;
  ingresaronHoy: number;
  pendientes: number;
  justificados: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  finalizados: number;
  /** Integrantes esperados en las jornadas del día */
  esperados: number;
}

export interface JornadaHoy {
  jornadaId: number;
  grupoId: number;
  grupo: string;
  etapa: string;
  horario: string;
  horaInicio: string | null;
  horaFin: string | null;
  tipoJornada: string;
  origen: string;
  estado: string;
  encargado: string | null;
  integrantes: number;
  presentes: number;
  finalizados: number;
  pendientes: number;
  justificados: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  ingresaron: number;
  justificacionesPorRevisar: number;
  sinAbrir: boolean;
  sinCerrar: boolean;
}

export type TipoAtencion = 'PENDIENTES' | 'JORNADA_SIN_ABRIR' | 'JORNADA_SIN_CERRAR' | 'JUSTIFICACIONES';

export interface AtencionItem {
  tipo: TipoAtencion;
  descripcion: string;
  jornadaId: number;
}

export interface ActividadItem {
  asistencia_id: number;
  jornadaId: number;
  persona: string;
  grupo: string;
  accion: string;
  tipoRegistro: string | null;
  fechaHora: string;
  registradoPor: string | null;
}

export interface ProximaJornada {
  jornadaId: number;
  grupo: string;
  fecha: string;
  horaInicio: string | null;
}

export interface GrupoMetricas {
  grupoId: number;
  nombre: string;
  etapa: string;
  etapaCodigo: string;
  integrantes: number;
  encargado: string | null;
  jornadasMes: number;
  asistenciasMes: number;
  faltasJustificadasMes: number;
  faltasInjustificadasMes: number;
  salidasAnticipadasMes: number;
  horasMes: number;
  participacionesVoluntariasMes: number;
  horasVoluntariasMes: number;
  horasTotalesMes: number;
  asistenciaPct: number | null;
  proximaJornada: { fecha: string; horaInicio: string | null } | null;
}

export interface DashboardHoy {
  fecha: string;
  esHoy: boolean;
  resumen: ResumenHoy;
  jornadas: JornadaHoy[];
  requierenAtencion: AtencionItem[];
  actividad: ActividadItem[];
  proximaJornada: ProximaJornada | null;
  grupos: GrupoMetricas[];
}
