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
  { ruta: '/inicio', icono: '@tui.house', etiqueta: 'Inicio', permiso: 'inicio.view' },
  { ruta: '/asistencia', icono: '@tui.square-check', etiqueta: 'Asistencia', permiso: 'attendance.view' },
  { ruta: '/mi-grupo', icono: '@tui.id-card', etiqueta: 'Mi grupo', permiso: 'attendance.view_assigned_group' },
  { ruta: '/seguimiento', icono: '@tui.chart-line', etiqueta: 'Seguimiento', permiso: 'tracking.view' },
  { ruta: '/formacion/grupos', icono: '@tui.layout-grid', etiqueta: 'Grupos', permiso: 'formation.view', seccion: 'Formación' },
  { ruta: '/formacion/personas', icono: '@tui.users', etiqueta: 'Personas', permiso: 'formation.view', seccion: 'Formación' },
  { ruta: '/formacion/historial', icono: '@tui.history', etiqueta: 'Historial', permiso: 'formation.view', seccion: 'Formación' },
  { ruta: '/reportes', icono: '@tui.file-text', etiqueta: 'Reportes', permiso: 'reports.view' },
  { ruta: '/auditoria', icono: '@tui.shield', etiqueta: 'Auditoría', permiso: 'audit.view_full' },
  { ruta: '/admin/usuarios', icono: '@tui.settings', etiqueta: 'Usuarios y permisos', permiso: 'users.manage' },
  { ruta: '/admin/config', icono: '@tui.sliders-horizontal', etiqueta: 'Configuración', permiso: 'settings.manage' },
];

export const ROL_SIDEBAR_NOMBRE: Record<string, string> = {
  ADMIN_SISTEMA: 'Administrador del sistema',
  JEFE_INSTRUCCION: 'Jefe de Instrucción',
  SUBJEFE_INSTRUCCION: 'Subjefe de Instrucción',
  ADJUNTO_INSTRUCCION: 'Adjunto de Instrucción',
  ENCARGADO_GRUPO: 'Encargado de grupo',
};
