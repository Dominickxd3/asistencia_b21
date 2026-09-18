import {
  BadRequestException,
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
import { Persona } from '../../persons/entities/persona.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UploadedImage } from '../dto/uploaded-image.type';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';

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
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
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
        correo: usuario.persona.correo,
        fotoUrl: usuario.persona.fotoUrl,
      },
      roles: rolesActivos,
      permisos: [...permisos],
    };
  }

  async actualizarPerfil(
    usuarioId: number,
    dto: UpdateProfileDto,
    foto?: UploadedImage,
  ) {
    const usuario = await this.usuarioRepo.findOneOrFail({
      where: { id: usuarioId },
      relations: { persona: true },
    });
    const persona = usuario.persona;
    const anterior = {
      nombres: persona.nombres,
      apellidoPaterno: persona.apellidoPaterno,
      apellidoMaterno: persona.apellidoMaterno,
      correo: persona.correo,
      fotoUrl: persona.fotoUrl,
    };

    let nuevaFotoUrl = persona.fotoUrl;
    if (foto) nuevaFotoUrl = await this.guardarFotoPerfil(foto);

    persona.nombres = dto.nombres.trim();
    persona.apellidoPaterno = dto.apellidoPaterno.trim();
    persona.apellidoMaterno = dto.apellidoMaterno?.trim() || null;
    persona.correo = dto.correo?.trim().toLowerCase() || null;
    persona.fotoUrl = nuevaFotoUrl;
    await this.personaRepo.save(persona);
    if (foto && anterior.fotoUrl && anterior.fotoUrl !== nuevaFotoUrl) {
      await this.eliminarFotoGestionada(anterior.fotoUrl);
    }

    await this.auditoria.registrar({
      usuarioId,
      accion: 'PROFILE_UPDATED',
      modulo: 'auth',
      entidad: 'personas',
      entidadId: persona.id,
      valorAnterior: anterior,
      valorNuevo: {
        nombres: persona.nombres,
        apellidoPaterno: persona.apellidoPaterno,
        apellidoMaterno: persona.apellidoMaterno,
        correo: persona.correo,
        fotoUrl: persona.fotoUrl,
      },
    });

    return this.perfil(usuarioId);
  }

  private async guardarFotoPerfil(foto: UploadedImage): Promise<string> {
    const tipo = this.detectarTipoImagen(foto.buffer);
    if (!tipo) throw new BadRequestException('La foto debe ser JPG, PNG o WEBP válida');

    const carpeta = resolve(process.cwd(), 'public', 'imagenes', 'perfiles');
    await mkdir(carpeta, { recursive: true });
    const nombre = `${randomUUID()}.${tipo}`;
    await writeFile(join(carpeta, nombre), foto.buffer, { flag: 'wx', mode: 0o644 });

    return `/imagenes/perfiles/${nombre}`;
  }

  private async eliminarFotoGestionada(ruta: string): Promise<void> {
    if (ruta.startsWith('/imagenes/perfiles/')) {
      const archivoAnterior = basename(ruta);
      if (/^[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(archivoAnterior)) {
        const carpeta = resolve(process.cwd(), 'public', 'imagenes', 'perfiles');
        await unlink(join(carpeta, archivoAnterior)).catch(() => undefined);
      }
    }
  }

  private detectarTipoImagen(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    return null;
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
