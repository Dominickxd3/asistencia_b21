import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verify } from 'argon2';
import { Usuario } from '../../users/entities/usuario.entity';
import { TokenService } from './token.service';
import { SesionesService } from './sesiones.service';
import { AuthzService } from '../../roles/authz.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { AUTH_ERRORS } from '../../../common/constants/auth.constants';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly tokenService: TokenService,
    private readonly sesionesService: SesionesService,
    private readonly authz: AuthzService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(
    username: string,
    password: string,
    ip: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    const usuario = await this.usuarioRepo.findOne({
      where: { username },
      relations: { persona: true },
    });

    const credencialesValidas =
      usuario !== null && (await verify(usuario.passwordHash, password).catch(() => false));

    if (!credencialesValidas || !usuario) {
      await this.auditoria.registrar({
        accion: 'LOGIN_FAILED',
        modulo: 'auth',
        descripcion: `Intento fallido para usuario '${username}'`,
        ip,
        userAgent,
      });
      throw new UnauthorizedException(AUTH_ERRORS.CREDENCIALES_INVALIDAS);
    }

    if (usuario.estadoCuenta !== 'ACTIVA') {
      throw new UnauthorizedException(AUTH_ERRORS.CUENTA_NO_ACTIVA);
    }

    const tokens = await this.emitirTokens(usuario, ip, userAgent);
    await this.usuarioRepo.update(usuario.id, { ultimoLoginAt: () => 'GETDATE()' });
    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'LOGIN',
      modulo: 'auth',
      ip,
      userAgent,
    });
    return tokens;
  }

  async refresh(refreshToken: string, ip: string | null, userAgent: string | null): Promise<LoginResult> {
    let payload;
    try {
      payload = this.tokenService.verificarRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException(AUTH_ERRORS.SESION_INVALIDA);
    }

    const sesion = await this.sesionesService.validar(payload.sid, refreshToken);
    if (!sesion) {
      throw new UnauthorizedException(AUTH_ERRORS.SESION_INVALIDA);
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: sesion.usuarioId, estadoCuenta: 'ACTIVA' },
      relations: { persona: true },
    });
    if (!usuario) {
      throw new UnauthorizedException(AUTH_ERRORS.CUENTA_NO_ACTIVA);
    }

    // Rotacion: la sesion anterior queda revocada
    await this.sesionesService.revocar(sesion.id);
    await this.auditoria.registrar({
      usuarioId: usuario.id,
      accion: 'TOKEN_REFRESHED',
      modulo: 'auth',
      ip,
      userAgent,
    });
    return this.emitirTokens(usuario, ip, userAgent);
  }

  async logout(sesionId: string | undefined, usuarioId: number | undefined): Promise<void> {
    if (sesionId) {
      await this.sesionesService.revocar(sesionId);
    }
    if (usuarioId) {
      await this.auditoria.registrar({
        usuarioId,
        accion: 'LOGOUT',
        modulo: 'auth',
      });
    }
  }

  async perfil(usuarioId: number) {
    const usuario = await this.usuarioRepo.findOneOrFail({
      where: { id: usuarioId },
      relations: { persona: true, usuarioRoles: { rol: true } },
    });
    const hoy = new Date().toISOString().slice(0, 10);
    const rolesActivos = usuario.usuarioRoles
      .filter((ur) => ur.estado === 'ACTIVO' && (!ur.fechaFin || ur.fechaFin >= hoy))
      .map((ur) => ({ codigo: ur.rol.codigo, nombre: ur.rol.nombre }));
    const permisos = await this.authz.obtenerPermisos(usuarioId);

    return {
      id: usuario.id,
      username: usuario.username,
      persona: {
        id: usuario.persona.id,
        nombres: usuario.persona.nombres,
        apellidoPaterno: usuario.persona.apellidoPaterno,
        apellidoMaterno: usuario.persona.apellidoMaterno,
        nombreCompleto: usuario.persona.nombreCompleto,
      },
      roles: rolesActivos,
      permisos: [...permisos],
    };
  }

  private async emitirTokens(
    usuario: Usuario,
    ip: string | null,
    userAgent: string | null,
  ): Promise<LoginResult> {
    const sesionId = this.tokenService.nuevaSesionId();
    const refreshToken = this.tokenService.generarRefreshToken(usuario.id, sesionId);
    await this.sesionesService.crear({
      id: sesionId,
      usuarioId: usuario.id,
      refreshTokenHash: await this.tokenService.hashearRefreshToken(refreshToken),
      ip,
      userAgent,
    });
    const accessToken = this.tokenService.generarAccessToken({
      sub: usuario.id,
      username: usuario.username,
    });
    return { accessToken, refreshToken, usuario };
  }
}
