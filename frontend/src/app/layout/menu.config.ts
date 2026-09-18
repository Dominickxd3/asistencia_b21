export interface MenuItem {
  ruta: string;
  icono: string;
  etiqueta: string;
  permiso: string | null;
  seccion?: string;
  hijos?: MenuItem[];
}

/**
 * Menú institucional del Área de Instrucción (Rímac 21)
 * Iconos PrimeIcons v17
 */
export const MENU: MenuItem[] = [
  { ruta: '/inicio', icono: 'pi pi-home', etiqueta: 'Inicio', permiso: 'inicio.view' },
  { ruta: '/asistencia', icono: 'pi pi-check-square', etiqueta: 'Asistencia', permiso: 'attendance.view' },
  { ruta: '/mi-grupo', icono: 'pi pi-id-card', etiqueta: 'Mi grupo', permiso: 'attendance.view_assigned_group' },
  { ruta: '/seguimiento', icono: 'pi pi-chart-line', etiqueta: 'Seguimiento', permiso: 'tracking.view' },
  { ruta: '/formacion/grupos', icono: 'pi pi-th-large', etiqueta: 'Grupos', permiso: 'formation.view', seccion: 'Formación' },
  { ruta: '/formacion/personas', icono: 'pi pi-users', etiqueta: 'Personas', permiso: 'formation.view', seccion: 'Formación' },
  { ruta: '/formacion/historial', icono: 'pi pi-history', etiqueta: 'Historial', permiso: 'formation.view', seccion: 'Formación' },
  { ruta: '/reportes', icono: 'pi pi-file', etiqueta: 'Reportes', permiso: 'reports.view' },
  { ruta: '/auditoria', icono: 'pi pi-shield', etiqueta: 'Auditoría', permiso: 'audit.view_full' },
  { ruta: '/admin/usuarios', icono: 'pi pi-cog', etiqueta: 'Usuarios y permisos', permiso: 'users.manage' },
  { ruta: '/admin/config', icono: 'pi pi-sliders-h', etiqueta: 'Configuración', permiso: 'settings.manage' },
];

export const ROL_SIDEBAR_NOMBRE: Record<string, string> = {
  ADMIN_SISTEMA: 'Administrador del sistema',
  JEFE_INSTRUCCION: 'Jefe de Instrucción',
  SUBJEFE_INSTRUCCION: 'Subjefe de Instrucción',
  ADJUNTO_INSTRUCCION: 'Adjunto de Instrucción',
  ENCARGADO_GRUPO: 'Encargado de grupo',
};
