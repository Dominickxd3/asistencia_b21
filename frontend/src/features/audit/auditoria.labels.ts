export interface ModuloInfo {
  label: string;
  desc: string;
  icon: string;
}

export interface AccionInfo {
  label: string;
  desc: string;
  badge: 'ok' | 'warn' | 'peligro' | 'info' | 'neutro';
  icon: string;
}

export interface EntidadInfo {
  label: string;
  icon: string;
}

export const MODULOS_MAP: Record<string, ModuloInfo> = {
  auth: {
    label: 'Seguridad y Accesos',
    desc: 'Inicios de sesión, contraseñas y accesos al sistema',
    icon: 'pi pi-shield',
  },
  attendance: {
    label: 'Control de Asistencias',
    desc: 'Marcaciones de entrada, salida y justificaciones',
    icon: 'pi pi-calendar-check',
  },
  sessions: {
    label: 'Jornadas de Instrucción',
    desc: 'Aperturas, cierres y gestión de clases de formación',
    icon: 'pi pi-book',
  },
  groups: {
    label: 'Grupos de Formación',
    desc: 'Secciones, compañías y asignación de integrantes',
    icon: 'pi pi-users',
  },
  persons: {
    label: 'Directorio de Personal',
    desc: 'Fichas personales, bomberos y postulantes',
    icon: 'pi pi-id-card',
  },
  formation: {
    label: 'Trayectoria y Etapas',
    desc: 'Historial de formación, ascensos y promociones',
    icon: 'pi pi-compass',
  },
  reports: {
    label: 'Reportes e Informes',
    desc: 'Generación y exportación de reportes institucionales',
    icon: 'pi pi-file-export',
  },
  sedes: {
    label: 'Sedes e Instalaciones',
    desc: 'Cuarteles, sedes y geocercas geográficas',
    icon: 'pi pi-map-marker',
  },
  users: {
    label: 'Usuarios y Permisos',
    desc: 'Cuentas de usuario y roles de acceso al sistema',
    icon: 'pi pi-user-edit',
  },
};

export const ACCIONES_MAP: Record<string, AccionInfo> = {
  LOGIN: {
    label: 'Inicio de sesión exitoso',
    desc: 'El usuario ingresó correctamente al sistema',
    badge: 'ok',
    icon: 'pi pi-sign-in',
  },
  LOGIN_FAILED: {
    label: 'Intento fallido de acceso',
    desc: 'Se intentó ingresar con contraseña o usuario erróneo',
    badge: 'peligro',
    icon: 'pi pi-ban',
  },
  LOGOUT: {
    label: 'Cierre de sesión',
    desc: 'El usuario cerró voluntariamente su sesión',
    badge: 'neutro',
    icon: 'pi pi-sign-out',
  },
  TOKEN_REFRESHED: {
    label: 'Renovación de sesión',
    desc: 'Renovación de credenciales activas del usuario',
    badge: 'neutro',
    icon: 'pi pi-refresh',
  },

  ATTENDANCE_ENTRY: {
    label: 'Entrada registrada',
    desc: 'Marcación de asistencia de ingreso a la jornada',
    badge: 'ok',
    icon: 'pi pi-sign-in',
  },
  ATTENDANCE_EXIT: {
    label: 'Salida registrada',
    desc: 'Marcación de asistencia de salida de la jornada',
    badge: 'info',
    icon: 'pi pi-sign-out',
  },
  ATTENDANCE_JUSTIFIED: {
    label: 'Falta justificada',
    desc: 'Inasistencia justificada debidamente documentada',
    badge: 'warn',
    icon: 'pi pi-check-circle',
  },
  ATTENDANCE_EARLY_EXIT: {
    label: 'Salida anticipada',
    desc: 'El integrante se retiró antes del horario programado',
    badge: 'warn',
    icon: 'pi pi-clock',
  },
  ATTENDANCE_MODIFIED: {
    label: 'Asistencia modificada',
    desc: 'Ajuste manual de hora o estado de asistencia',
    badge: 'warn',
    icon: 'pi pi-pencil',
  },
  ATTENDANCE_ANNULLED: {
    label: 'Asistencia anulada',
    desc: 'Registro de asistencia cancelado por el instructor',
    badge: 'peligro',
    icon: 'pi pi-times-circle',
  },

  SESSION_CREATED: {
    label: 'Jornada creada',
    desc: 'Creación de una nueva jornada de instrucción',
    badge: 'info',
    icon: 'pi pi-plus',
  },
  SESSION_OPENED: {
    label: 'Jornada aperturada',
    desc: 'Se abrió la jornada para recibir registros de asistencia',
    badge: 'ok',
    icon: 'pi pi-lock-open',
  },
  SESSION_CLOSED: {
    label: 'Jornada cerrada',
    desc: 'Cierre definitivo de la jornada de instrucción',
    badge: 'neutro',
    icon: 'pi pi-lock',
  },

  GROUP_CREATED: {
    label: 'Grupo de formación creado',
    desc: 'Creación de un nuevo grupo o sección formativa',
    badge: 'ok',
    icon: 'pi pi-folder-plus',
  },
  GROUP_UPDATED: {
    label: 'Grupo de formación modificado',
    desc: 'Modificación de datos o configuración del grupo',
    badge: 'info',
    icon: 'pi pi-pencil',
  },
  GROUP_CLOSED: {
    label: 'Grupo de formación finalizado',
    desc: 'Cierre formal del ciclo del grupo',
    badge: 'neutro',
    icon: 'pi pi-check',
  },
  GROUP_CANCELLED: {
    label: 'Grupo cancelado',
    desc: 'Cancelación del grupo de formación',
    badge: 'peligro',
    icon: 'pi pi-times',
  },
  GROUP_REACTIVATED: {
    label: 'Grupo reactivado',
    desc: 'Reapertura del grupo de formación',
    badge: 'ok',
    icon: 'pi pi-replay',
  },
  GROUP_DELETED: {
    label: 'Grupo eliminado',
    desc: 'Eliminación del registro del grupo',
    badge: 'peligro',
    icon: 'pi pi-trash',
  },

  MANAGER_ASSIGNED: {
    label: 'Responsable asignado',
    desc: 'Asignación de instructor a cargo del grupo',
    badge: 'info',
    icon: 'pi pi-user-plus',
  },
  MANAGER_REMOVED: {
    label: 'Responsable removido',
    desc: 'Remoción de instructor responsable del grupo',
    badge: 'warn',
    icon: 'pi pi-user-minus',
  },

  MEMBER_ADDED: {
    label: 'Integrante incorporado',
    desc: 'Ingreso de integrante al grupo de formación',
    badge: 'ok',
    icon: 'pi pi-user-plus',
  },
  MEMBER_TRANSFERRED: {
    label: 'Integrante transferido',
    desc: 'Traslado del integrante a otro grupo de formación',
    badge: 'info',
    icon: 'pi pi-arrows-h',
  },
  MEMBER_REMOVED: {
    label: 'Integrante retirado',
    desc: 'Salida del integrante del grupo de formación',
    badge: 'warn',
    icon: 'pi pi-user-minus',
  },
  MEMBER_RETIRED: {
    label: 'Baja de integrante',
    desc: 'Baja formal del integrante de la institución',
    badge: 'peligro',
    icon: 'pi pi-ban',
  },
  MEMBER_PROMOTED: {
    label: 'Ascenso / Promoción de etapa',
    desc: 'Promoción formal del integrante a la siguiente etapa formativa',
    badge: 'ok',
    icon: 'pi pi-arrow-circle-up',
  },

  HISTORIAL_CREATED: {
    label: 'Trayectoria registrada',
    desc: 'Creación de un nuevo registro de etapa en el historial',
    badge: 'ok',
    icon: 'pi pi-plus-circle',
  },
  HISTORIAL_UPDATED: {
    label: 'Trayectoria modificada',
    desc: 'Modificación de fecha, estado o grupo en el historial',
    badge: 'warn',
    icon: 'pi pi-pencil',
  },
  HISTORIAL_DELETED: {
    label: 'Trayectoria eliminada',
    desc: 'Eliminación de un registro erróneo del historial',
    badge: 'peligro',
    icon: 'pi pi-trash',
  },

  PERSON_CREATED: {
    label: 'Persona registrada',
    desc: 'Registro de una nueva persona en el directorio',
    badge: 'ok',
    icon: 'pi pi-user-plus',
  },
  PERSON_UPDATED: {
    label: 'Datos personales actualizados',
    desc: 'Modificación de información en la ficha de la persona',
    badge: 'info',
    icon: 'pi pi-pencil',
  },
  PERSON_DEACTIVATED: {
    label: 'Persona desactivada',
    desc: 'Desactivación temporal del perfil de la persona',
    badge: 'peligro',
    icon: 'pi pi-user-minus',
  },
  PERSON_REACTIVATED: {
    label: 'Persona reactivada',
    desc: 'Reactivación del perfil de la persona',
    badge: 'ok',
    icon: 'pi pi-user-plus',
  },
  PERSON_DELETED: {
    label: 'Persona eliminada',
    desc: 'Eliminación permanente de la ficha de la persona',
    badge: 'peligro',
    icon: 'pi pi-trash',
  },

  SEDE_CREATED: {
    label: 'Sede creada',
    desc: 'Registro de un nuevo cuartel o instalación institucional',
    badge: 'ok',
    icon: 'pi pi-building',
  },
  SEDE_UPDATED: {
    label: 'Sede modificada',
    desc: 'Actualización de datos generales de la sede',
    badge: 'info',
    icon: 'pi pi-pencil',
  },
  GEOFENCE_UPDATED: {
    label: 'Geocerca actualizada',
    desc: 'Ajuste del perímetro geográfico o radio de cobertura de la sede',
    badge: 'warn',
    icon: 'pi pi-compass',
  },

  USER_CREATED: {
    label: 'Usuario del sistema creado',
    desc: 'Creación de credenciales de usuario para el sistema',
    badge: 'info',
    icon: 'pi pi-id-card',
  },
  USER_UPDATED: {
    label: 'Usuario del sistema modificado',
    desc: 'Modificación de credenciales o estado del usuario',
    badge: 'info',
    icon: 'pi pi-pencil',
  },
  ROLE_GRANTED: {
    label: 'Rol o permiso otorgado',
    desc: 'Asignación de privilegios de acceso al usuario',
    badge: 'warn',
    icon: 'pi pi-key',
  },

  REPORT_GENERATED: {
    label: 'Reporte generado',
    desc: 'Generación y exportación de informe oficial',
    badge: 'info',
    icon: 'pi pi-file-export',
  },
};

export const ENTIDADES_MAP: Record<string, EntidadInfo> = {
  persona_etapas: { label: 'Historial de formación', icon: 'pi pi-history' },
  personas: { label: 'Ficha de persona', icon: 'pi pi-user' },
  asistencias: { label: 'Registro de asistencia', icon: 'pi pi-calendar-check' },
  jornadas_instruccion: { label: 'Jornada de instrucción', icon: 'pi pi-book' },
  grupos_formacion: { label: 'Grupo de formación', icon: 'pi pi-users' },
  grupo_integrantes: { label: 'Miembro de grupo', icon: 'pi pi-user' },
  usuarios: { label: 'Cuenta de usuario', icon: 'pi pi-lock' },
  roles: { label: 'Rol de seguridad', icon: 'pi pi-shield' },
  sedes: { label: 'Sede / Instalación', icon: 'pi pi-building' },
};

export function obtenerModuloInfo(modulo: string): ModuloInfo {
  return (
    MODULOS_MAP[modulo] ?? {
      label: modulo,
      desc: 'Módulo del sistema',
      icon: 'pi pi-folder',
    }
  );
}

export function obtenerAccionInfo(accion: string): AccionInfo {
  return (
    ACCIONES_MAP[accion] ?? {
      label: accion.replace(/_/g, ' ').toLowerCase(),
      desc: 'Acción del sistema',
      badge: 'neutro',
      icon: 'pi pi-info-circle',
    }
  );
}

export function obtenerEntidadInfo(entidad: string | null | undefined): EntidadInfo {
  if (!entidad) return { label: 'General / Sistema', icon: 'pi pi-server' };
  return (
    ENTIDADES_MAP[entidad] ?? {
      label: entidad.replace(/_/g, ' '),
      icon: 'pi pi-database',
    }
  );
}

export function formatearIp(ip: string | null | undefined): { ip: string; esLocal: boolean } {
  if (!ip) return { ip: '—', esLocal: false };
  const limpia = ip.trim();
  if (limpia === '::1' || limpia === '127.0.0.1' || limpia === 'localhost') {
    return { ip: '127.0.0.1 (Local)', esLocal: true };
  }
  return { ip: limpia, esLocal: false };
}
