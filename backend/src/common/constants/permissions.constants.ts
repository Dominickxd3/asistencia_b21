/** Codigos exactos registrados en la tabla permisos */
export enum PermissionCode {
  INICIO_VIEW = 'inicio.view',
  ATTENDANCE_VIEW = 'attendance.view',
  ATTENDANCE_VIEW_ALL = 'attendance.view_all_groups',
  ATTENDANCE_VIEW_GROUP = 'attendance.view_assigned_group',
  ATTENDANCE_REGISTER = 'attendance.register',
  ATTENDANCE_UPDATE = 'attendance.update',
  ATTENDANCE_JUSTIFY = 'attendance.justify',
  ATTENDANCE_CANCEL = 'attendance.cancel',
  FORMATION_VIEW = 'formation.view',
  FORMATION_MANAGE_GROUPS = 'formation.manage_groups',
  FORMATION_MANAGE_PEOPLE = 'formation.manage_people',
  FORMATION_PROMOTE = 'formation.promote',
  TRACKING_VIEW = 'tracking.view',
  REPORTS_VIEW = 'reports.view',
  REPORTS_GENERATE = 'reports.generate',
  AUDIT_VIEW_FULL = 'audit.view_full',
  AUDIT_VIEW_OPERATIONAL = 'audit.view_operational',
  USERS_MANAGE = 'users.manage',
  ROLES_MANAGE = 'roles.manage',
  SETTINGS_MANAGE = 'settings.manage',
}

export const ALL_PERMISSIONS = Object.values(PermissionCode);
