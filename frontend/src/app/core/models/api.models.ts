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
  salidasAnticipadas: number;
}

export interface JornadaHoy {
  jornadaId: number;
  grupo: string;
  etapa: string;
  horario: string;
  tipoJornada: string;
  estado: string;
  encargado: string | null;
  integrantes: number;
  presentes: number;
  finalizados: number;
  pendientes: number;
  justificados: number;
}

export interface AtencionItem {
  tipo: string;
  descripcion: string;
  jornadaId: number;
}

export interface ActividadItem {
  asistencia_id: number;
  persona: string;
  grupo: string;
  accion: string;
  fechaHora: string;
  registradoPor: string;
}

export interface DashboardHoy {
  fecha: string;
  resumen: ResumenHoy;
  jornadas: JornadaHoy[];
  requierenAtencion: AtencionItem[];
  actividad: ActividadItem[];
}
