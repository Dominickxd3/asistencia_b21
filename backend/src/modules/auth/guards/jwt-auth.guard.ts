import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenService } from '../services/token.service';
import { Usuario } from '../../users/entities/usuario.entity';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';

/**
 * Valida el access token y recarga el usuario desde BD:
 * el JWT identifica, la BD confirma que la cuenta sigue activa.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extraerToken(request);
    if (!token) throw new UnauthorizedException('Token no proporcionado');

    let payload;
    try {
      payload = this.tokenService.verificarAccessToken(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub, estadoCuenta: 'ACTIVA' },
      relations: { persona: true, usuarioRoles: { rol: true } },
    });
    if (!usuario) throw new UnauthorizedException('La cuenta no está activa');

    const hoy = new Date().toISOString().slice(0, 10);
    request.user = {
      id: usuario.id,
      username: usuario.username,
      personaId: usuario.personaId,
      nombreCompleto: usuario.persona?.nombreCompleto ?? usuario.username,
      roles: usuario.usuarioRoles
        .filter((ur) => ur.estado === 'ACTIVO' && (!ur.fechaFin || ur.fechaFin >= hoy))
        .map((ur) => ur.rol.codigo),
    };
    return true;
  }

  private extraerToken(request: any): string | null {
    const auth = request.headers?.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
