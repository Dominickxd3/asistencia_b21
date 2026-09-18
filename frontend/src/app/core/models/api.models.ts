export interface PerfilUsuario {
  id: number;
  username: string;
  persona: {
    id: number;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    nombreCompleto: string;
    correo: string | null;
    fotoUrl: string | null;
  };
  roles: { codigo: string; nombre: string }[];
  permisos: string[];
}

export interface ResumenHoy {
  presentesAhora: number;
  ingresaronHoy: number;
  pendientes: number;
  justificados: number;
  faltas: number;
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
  primeraEntrada: string | null;
  ultimaSalida: string | null;
}

export interface AtencionItem {
  tipo: string;
  descripcion: string;
  grupo: string;
  cantidad: number;
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
  fechaFin?: string;
  periodo: 'dia' | 'mes' | 'rango';
  resumen: ResumenHoy;
  jornadas: JornadaHoy[];
  requierenAtencion: AtencionItem[];
  actividad: ActividadItem[];
}
