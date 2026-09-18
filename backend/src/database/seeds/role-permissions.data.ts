import { RoleCode } from '../../common/constants/roles.constants';
import { PermissionCode } from '../../common/constants/permissions.constants';

const TODOS = Object.values(PermissionCode);

const JEFE = [
  PermissionCode.INICIO_VIEW,
  PermissionCode.ATTENDANCE_VIEW,
  PermissionCode.ATTENDANCE_VIEW_ALL,
  PermissionCode.ATTENDANCE_REGISTER,
  PermissionCode.ATTENDANCE_UPDATE,
  PermissionCode.ATTENDANCE_JUSTIFY,
  PermissionCode.ATTENDANCE_CANCEL,
  PermissionCode.FORMATION_VIEW,
  PermissionCode.FORMATION_MANAGE_GROUPS,
  PermissionCode.FORMATION_MANAGE_PEOPLE,
  PermissionCode.FORMATION_PROMOTE,
  PermissionCode.TRACKING_VIEW,
  PermissionCode.REPORTS_VIEW,
  PermissionCode.REPORTS_GENERATE,
  PermissionCode.AUDIT_VIEW_FULL,
];

const SUBJEFE_ADJUNTO = [
  PermissionCode.INICIO_VIEW,
  PermissionCode.ATTENDANCE_VIEW,
  PermissionCode.ATTENDANCE_VIEW_ALL,
  PermissionCode.ATTENDANCE_REGISTER,
  PermissionCode.ATTENDANCE_UPDATE,
  PermissionCode.FORMATION_VIEW,
  PermissionCode.TRACKING_VIEW,
  PermissionCode.REPORTS_VIEW,
];

const ENCARGADO = [
  PermissionCode.INICIO_VIEW,
  PermissionCode.ATTENDANCE_VIEW,
  PermissionCode.ATTENDANCE_VIEW_GROUP,
  PermissionCode.ATTENDANCE_REGISTER,
];

export const ROLE_PERMISSION_MATRIX: Record<RoleCode, string[]> = {
  [RoleCode.ADMIN]: TODOS,
  [RoleCode.JEFE_INSTRUCCION]: JEFE,
  [RoleCode.SUBJEFE_INSTRUCCION]: SUBJEFE_ADJUNTO,
  [RoleCode.ADJUNTO_INSTRUCCION]: SUBJEFE_ADJUNTO,
  [RoleCode.ENCARGADO_GRUPO]: ENCARGADO,
};
