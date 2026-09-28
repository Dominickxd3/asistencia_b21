import { hash } from 'argon2';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditoriaService } from '../audit/auditoria.service';
import { AuthzService } from '../roles/authz.service';
import { SesionesService } from '../auth/services/sesiones.service';
import { RealtimeService } from '../realtime/realtime.service';
import { RoleCode } from '../../common/constants/roles.constants';
import { generarPasswordTemporal } from '../../common/utils/password.util';
import { ActualizarRolesDto, CrearUsuarioDto } from './dto/usuario.dto';

/** Nombre completo en SQL con el mismo formato que Persona.nombreCompleto */
const NOMBRE_SQL = (p: string) =>
  `LTRIM(RTRIM(${p}.apellido_paterno + ISNULL(' ' + ${p}.apellido_materno, '') + ' ' + ${p}.nombres))`;

/** Rol vigente: activo y sin fecha de fin pasada */
const ROL_VIGENTE = `ur.estado = 'ACTIVO' AND (ur.fecha_fin IS NULL OR ur.fecha_fin >= CAST(GETDATE() AS date))`;

export interface UsuarioView {
  id: number;
  username: string;
  estado: string;
  ultimoAcceso: Date | null;
  personaId: number;
  nombre: string;
  dni: string | null;
  roles: { codigo: string; nombre: string }[];
  /** Grupos que encarga actualmente */
  grupos: string[];
}

export interface Credenciales {
  username: string;
  passwordTemporal: string;
}

/**
 * Cuentas del personal de Instrucción. Una cuenta pertenece a una persona ya
 * registrada; sus permisos se derivan de los cargos (roles) vigentes.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly authz: AuthzService,
    private readonly sesiones: SesionesService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {}

  async listar(): Promise<UsuarioView[]> {
    const usuarios: Omit<UsuarioView, 'roles' | 'grupos'>[] = await this.ds.query(
      `SELECT u.usuario_id AS id, u.username, u.estado_cuenta AS estado, u.ultimo_login_at AS ultimoAcceso,
              p.persona_id AS personaId, ${NOMBRE_SQL('p')} AS nombre, p.dni
       FROM usuarios u JOIN personas p ON p.persona_id = u.persona_id
       ORDER BY CASE u.estado_cuenta WHEN 'ACTIVA' THEN 0 ELSE 1 END, p.apellido_paterno, p.nombres`,
    );
    const roles: { usuarioId: number; codigo: string; nombre: string }[] = await this.ds.query(
      `SELECT ur.usuario_id AS usuarioId, r.codigo, r.nombre
       FROM usuario_roles ur JOIN roles r ON r.rol_id = ur.rol_id
       WHERE ${ROL_VIGENTE}
       ORDER BY r.rol_id`,
    );
    const grupos: { usuarioId: number; nombre: string }[] = await this.ds.query(
      `SELECT ge.usuario_id AS usuarioId, g.nombre
       FROM grupo_encargados ge JOIN grupos_formacion g ON g.grupo_id = ge.grupo_id
       WHERE ge.estado = 'ACTIVO'`,
    );
    return usuarios.map((u) => ({
      ...u,
      roles: roles.filter((r) => r.usuarioId === u.id).map(({ codigo, nombre }) => ({ codigo, nombre })),
      grupos: grupos.filter((g) => g.usuarioId === u.id).map((g) => g.nombre),
    }));
  }

  roles(): Promise<{ codigo: string; nombre: string; descripcion: string | null }[]> {
    return this.ds.query(
      `SELECT codigo, nombre, descripcion FROM roles WHERE estado = 'ACTIVO' ORDER BY rol_id`,
    );
  }

  /** Personas activas sin cuenta, para crearles una */
  candidatos(q?: string) {
    const texto = q?.trim() ? `%${q.trim()}%` : null;
    return this.ds.query(
      `SELECT TOP 20 p.persona_id AS id, ${NOMBRE_SQL('p')} AS nombre, p.dni,
              g.nombre AS grupo
       FROM personas p
       OUTER APPLY (SELECT TOP 1 gf.nombre FROM grupo_integrantes gi
                    JOIN grupos_formacion gf ON gf.grupo_id = gi.grupo_id
                    WHERE gi.persona_id = p.persona_id AND gi.estado = 'ACTIVO') g
       WHERE p.estado = 'ACTIVO'
         AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.persona_id = p.persona_id)
         AND (@0 IS NULL OR ${NOMBRE_SQL('p')} LIKE @0 OR p.dni LIKE @0)
       ORDER BY p.apellido_paterno, p.nombres`,
      [texto],
    );
  }

  async crear(dto: CrearUsuarioDto, actorId: number): Promise<Credenciales> {
    await this.exigirPuedeAsignar(actorId, dto.roles);
    const passwordTemporal = generarPasswordTemporal();
    const usuarioId = await this.ds.transaction(async (em) => {
      const [persona] = await em.query(
        `SELECT p.estado, u.usuario_id AS usuarioId
         FROM personas p LEFT JOIN usuarios u ON u.persona_id = p.persona_id
         WHERE p.persona_id = @0`,
        [dto.personaId],
      );
      if (!persona || persona.estado !== 'ACTIVO') {
        throw new NotFoundException('La persona no existe o está inactiva');
      }
      if (persona.usuarioId != null) {
        throw new ConflictException('Esta persona ya tiene una cuenta. Búsquela en la lista para cambiar sus cargos.');
      }
      const [ocupado] = await em.query(`SELECT 1 AS x FROM usuarios WHERE username = @0`, [dto.username]);
      if (ocupado) throw new ConflictException(`El usuario «${dto.username}» ya existe; elija otro`);

      const [nuevo] = await em.query(
        `INSERT INTO usuarios (persona_id, username, password_hash, estado_cuenta, fecha_creacion)
         OUTPUT INSERTED.usuario_id AS id
         VALUES (@0, @1, @2, 'ACTIVA', GETDATE())`,
        [dto.personaId, dto.username, await hash(passwordTemporal)],
      );
      const id = Number(nuevo.id);
      await this.otorgarRoles(em, id, dto.roles, actorId);
      return id;
    });

    await this.auditoria.registrar({
      usuarioId: actorId,
      accion: 'USER_CREATED',
      modulo: 'users',
      entidad: 'usuarios',
      entidadId: usuarioId,
      valorNuevo: { personaId: dto.personaId, username: dto.username, roles: dto.roles },
    });
    return { username: dto.username, passwordTemporal };
  }

  async actualizarRoles(usuarioId: number, dto: ActualizarRolesDto, actorId: number): Promise<void> {
    const cuenta = await this.cuenta(usuarioId);
    await this.exigirPuedeGestionar(actorId, cuenta);
    const actuales = cuenta.roles;
    const quitar = actuales.filter((r) => !dto.roles.includes(r));
    const agregar = dto.roles.filter((r) => !actuales.includes(r));
    if (quitar.length === 0 && agregar.length === 0) return;
    await this.exigirPuedeAsignar(actorId, [...quitar, ...agregar]);

    if (quitar.includes(RoleCode.ADMIN)) {
      if (usuarioId === actorId) {
        throw new UnprocessableEntityException(
          'No puede quitarse a sí mismo el cargo de Administrador. Pídaselo a otro administrador.',
        );
      }
      await this.exigirOtroAdmin(usuarioId);
    }
    if (quitar.includes(RoleCode.ENCARGADO_GRUPO)) {
      const grupos: { nombre: string }[] = await this.ds.query(
        `SELECT g.nombre FROM grupo_encargados ge JOIN grupos_formacion g ON g.grupo_id = ge.grupo_id
         WHERE ge.usuario_id = @0 AND ge.estado = 'ACTIVO'`,
        [usuarioId],
      );
      if (grupos.length > 0) {
        throw new UnprocessableEntityException(
          `Es encargado de ${grupos.map((g) => g.nombre).join(', ')}. ` +
            'Asigne otro encargado en ese grupo antes de quitarle este cargo.',
        );
      }
    }

    await this.ds.transaction(async (em) => {
      if (quitar.length > 0) {
        await em.query(
          `UPDATE ur SET ur.estado = 'FINALIZADO', ur.fecha_fin = CAST(GETDATE() AS date)
           FROM usuario_roles ur JOIN roles r ON r.rol_id = ur.rol_id
           WHERE ur.usuario_id = @0 AND ur.estado = 'ACTIVO'
             AND r.codigo IN (SELECT value FROM STRING_SPLIT(@1, ','))`,
          [usuarioId, quitar.join(',')],
        );
      }
      await this.otorgarRoles(em, usuarioId, agregar, actorId);
    });
    this.authz.invalidar(usuarioId);

    await this.auditoria.registrar({
      usuarioId: actorId,
      accion: 'USER_UPDATED',
      modulo: 'users',
      entidad: 'usuarios',
      entidadId: usuarioId,
      valorAnterior: { roles: actuales },
      valorNuevo: { roles: dto.roles },
    });
  }

  /** Sin `password` se genera una temporal; con ella se usa la que eligió quien la cambia */
  async restablecerPassword(usuarioId: number, actorId: number, password?: string): Promise<Credenciales> {
    if (usuarioId === actorId) {
      throw new UnprocessableEntityException('No puede restablecer su propia contraseña desde aquí.');
    }
    const cuenta = await this.cuenta(usuarioId);
    await this.exigirPuedeGestionar(actorId, cuenta);
    const passwordTemporal = password ?? generarPasswordTemporal();
    await this.ds.query(
      `UPDATE usuarios SET password_hash = @1, fecha_actualizacion = GETDATE() WHERE usuario_id = @0`,
      [usuarioId, await hash(passwordTemporal)],
    );
    // La contraseña anterior deja de servir también en los equipos donde ya había entrado
    await this.sesiones.revocarTodas(usuarioId);
    await this.realtime.desconectarUsuario(usuarioId);
    await this.auditoria.registrar({
      usuarioId: actorId,
      accion: 'USER_UPDATED',
      modulo: 'users',
      entidad: 'usuarios',
      entidadId: usuarioId,
      descripcion: 'Contraseña restablecida',
    });
    return { username: cuenta.username, passwordTemporal };
  }

  async cambiarEstado(usuarioId: number, estado: 'ACTIVA' | 'INACTIVA', actorId: number): Promise<void> {
    if (usuarioId === actorId) {
      throw new UnprocessableEntityException('No puede desactivar su propia cuenta.');
    }
    const cuenta = await this.cuenta(usuarioId);
    await this.exigirPuedeGestionar(actorId, cuenta);
    if (cuenta.estado === estado) return;
    if (estado === 'INACTIVA' && cuenta.roles.includes(RoleCode.ADMIN)) {
      await this.exigirOtroAdmin(usuarioId);
    }
    await this.ds.query(
      `UPDATE usuarios SET estado_cuenta = @1, fecha_actualizacion = GETDATE() WHERE usuario_id = @0`,
      [usuarioId, estado],
    );
    if (estado === 'INACTIVA') {
      await this.sesiones.revocarTodas(usuarioId);
      await this.realtime.desconectarUsuario(usuarioId);
    }
    this.authz.invalidar(usuarioId);
    await this.auditoria.registrar({
      usuarioId: actorId,
      accion: 'USER_UPDATED',
      modulo: 'users',
      entidad: 'usuarios',
      entidadId: usuarioId,
      valorAnterior: { estado: cuenta.estado },
      valorNuevo: { estado },
    });
  }

  private async cuenta(usuarioId: number): Promise<{ username: string; estado: string; roles: string[] }> {
    const [u] = await this.ds.query(
      `SELECT username, estado_cuenta AS estado FROM usuarios WHERE usuario_id = @0`,
      [usuarioId],
    );
    if (!u) throw new NotFoundException('Cuenta no encontrada');
    const roles: { codigo: string }[] = await this.ds.query(
      `SELECT r.codigo FROM usuario_roles ur JOIN roles r ON r.rol_id = ur.rol_id
       WHERE ur.usuario_id = @0 AND ${ROL_VIGENTE}`,
      [usuarioId],
    );
    return { username: u.username, estado: u.estado, roles: roles.map((r) => r.codigo) };
  }

  private async esAdmin(usuarioId: number): Promise<boolean> {
    return (await this.cuenta(usuarioId)).roles.includes(RoleCode.ADMIN);
  }

  /**
   * El Jefe de Instrucción también gestiona cuentas, pero el cargo de
   * Administrador solo lo da o quita otro Administrador (evita autoelevarse).
   */
  private async exigirPuedeAsignar(actorId: number, roles: string[]): Promise<void> {
    if (roles.includes(RoleCode.ADMIN) && !(await this.esAdmin(actorId))) {
      throw new ForbiddenException('Solo un Administrador puede dar o quitar el cargo de Administrador.');
    }
  }

  /** Las cuentas de administradores solo las gestiona otro Administrador */
  private async exigirPuedeGestionar(actorId: number, cuenta: { roles: string[] }): Promise<void> {
    if (cuenta.roles.includes(RoleCode.ADMIN) && !(await this.esAdmin(actorId))) {
      throw new ForbiddenException('Las cuentas de administradores solo las puede modificar un Administrador.');
    }
  }

  /** Nunca dejar el sistema sin un administrador con cuenta activa */
  private async exigirOtroAdmin(usuarioId: number): Promise<void> {
    const [r] = await this.ds.query(
      `SELECT COUNT(*) AS n FROM usuarios u
       JOIN usuario_roles ur ON ur.usuario_id = u.usuario_id
       JOIN roles ro ON ro.rol_id = ur.rol_id AND ro.codigo = @1
       WHERE u.usuario_id <> @0 AND u.estado_cuenta = 'ACTIVA' AND ${ROL_VIGENTE}`,
      [usuarioId, RoleCode.ADMIN],
    );
    if (Number(r?.n) === 0) {
      throw new UnprocessableEntityException(
        'Es el único administrador activo. Dé el cargo de Administrador a otra persona antes de hacer este cambio.',
      );
    }
  }

  private async otorgarRoles(em: EntityManager, usuarioId: number, roles: string[], actorId: number): Promise<void> {
    for (const codigo of roles) {
      const [r] = await em.query(
        `INSERT INTO usuario_roles (usuario_id, rol_id, fecha_inicio, fecha_fin, estado, asignado_por_usuario_id)
         SELECT @0, r.rol_id, CAST(GETDATE() AS date), NULL, 'ACTIVO', @1
         FROM roles r WHERE r.codigo = @2 AND r.estado = 'ACTIVO';
         SELECT @@ROWCOUNT AS n`,
        [usuarioId, actorId, codigo],
      );
      if (!r || Number(r.n) === 0) {
        throw new UnprocessableEntityException(`El cargo ${codigo} no está disponible`);
      }
    }
  }
}
