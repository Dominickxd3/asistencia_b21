import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthzService } from '../../roles/authz.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/auth.decorators';
import { PermissionCode } from '../../../common/constants/permissions.constants';

/**
 * Verifica permisos actuales consultando la BD (con cache corta).
 * Nunca confia en que el JWT contenga permisos.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requeridos || requeridos.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) throw new ForbiddenException('Sin autenticación');

    const permisos = await this.authz.obtenerPermisos(user.id);
    const faltantes = requeridos.filter((p) => !permisos.has(p));
    if (faltantes.length > 0) {
      throw new ForbiddenException('No tiene permisos para esta operación');
    }
    return true;
  }
}
