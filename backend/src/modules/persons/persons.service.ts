import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';
import {
  CambiarEstadoPersonaDto,
  CreatePersonaDto,
  ListarPersonasQueryDto,
  UpdatePersonaDto,
} from './dto/persona.dto';
import { AuditoriaService } from '../audit/auditoria.service';
import { AuthzService } from '../roles/authz.service';
import { fechaColumna, fechaServidor } from '../../common/utils/fecha.util';

const COMPANIA_ID = 1;

/**
 * Persona con su situación actual: etapa y grupo vigentes (como integrante) y, si tiene
 * cuenta, sus roles y el grupo que encarga. «Personal» = tiene cuenta con rol, sin etapa ni
 * grupo como integrante (jefatura, encargados, administración): no es un alumno sin grupo.
 */
const SELECT_PERSONA = `
  SELECT p.persona_id AS id, p.dni, p.nombres, p.apellido_paterno AS apellidoPaterno,
         p.apellido_materno AS apellidoMaterno, p.telefono, p.correo,
         p.fecha_nacimiento AS fechaNacimiento, p.estado,
         e.codigo AS etapaCodigo, e.nombre AS etapa,
         g.grupo_id AS grupoId, g.nombre AS grupo,
         u.username,
         ga.grupo_id AS encargaGrupoId, ga.nombre AS encargaGrupo,
         STUFF((SELECT DISTINCT ', ' + r2.nombre
                FROM usuario_roles ur2 JOIN roles r2 ON r2.rol_id = ur2.rol_id
                WHERE ur2.usuario_id = u.usuario_id AND ur2.estado = 'ACTIVO' AND r2.estado = 'ACTIVO'
                FOR XML PATH('')), 1, 2, '') AS roles,
         CASE WHEN gi.grupo_id IS NULL AND pe.etapa_id IS NULL AND EXISTS (
                SELECT 1 FROM usuario_roles ur3 JOIN roles r3 ON r3.rol_id = ur3.rol_id
                WHERE ur3.usuario_id = u.usuario_id AND ur3.estado = 'ACTIVO' AND r3.estado = 'ACTIVO')
              THEN 1 ELSE 0 END AS esPersonal
  FROM personas p
  OUTER APPLY (SELECT TOP 1 pe.etapa_id FROM persona_etapas pe
               WHERE pe.persona_id = p.persona_id AND pe.estado = 'ACTIVO'
               ORDER BY pe.fecha_inicio DESC, pe.persona_etapa_id DESC) pe
  LEFT JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
  OUTER APPLY (SELECT TOP 1 gi.grupo_id FROM grupo_integrantes gi
               WHERE gi.persona_id = p.persona_id AND gi.estado = 'ACTIVO') gi
  LEFT JOIN grupos_formacion g ON g.grupo_id = gi.grupo_id
  LEFT JOIN usuarios u ON u.persona_id = p.persona_id
  OUTER APPLY (SELECT TOP 1 g2.grupo_id, g2.nombre FROM grupo_encargados ge
               JOIN grupos_formacion g2 ON g2.grupo_id = ge.grupo_id
               WHERE ge.usuario_id = u.usuario_id AND ge.estado = 'ACTIVO') ga`;

export interface PersonaView {
  id: number;
  dni: string | null;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  telefono: string | null;
  correo: string | null;
  fechaNacimiento: string | null;
  estado: string;
  etapaCodigo: string | null;
  etapa: string | null;
  grupoId: number | null;
  grupo: string | null;
  /** Usuario del sistema, si tiene cuenta */
  username: string | null;
  roles: string[];
  /** Grupo del que es encargado (no integrante) */
  encargaGrupoId: number | null;
  encargaGrupo: string | null;
  /** Personal de instrucción/administración: cuenta con rol, sin etapa ni grupo */
  esPersonal: boolean;
}

/**
 * Personas: una sola ficha por persona durante toda su formación.
 * Nunca se borra historia: desactivar retira sus vínculos vigentes (grupo, etapa,
 * encargo y cuenta); el borrado físico solo aplica a registros sin ninguna historia.
 */
@Injectable()
export class PersonsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
    private readonly auditoria: AuditoriaService,
    private readonly authz: AuthzService,
  ) {}

  async listar(query: ListarPersonasQueryDto) {
    const pagina = query.pagina ?? 1;
    const tamano = query.tamano ?? 25;
    const estado = query.estado === 'ACTIVO' || query.estado === 'INACTIVO' ? query.estado : null;
    const texto = query.q ? `%${query.q}%` : null;
    const filtrado = `FROM (${SELECT_PERSONA} WHERE p.compania_id = @0) x
       WHERE (@1 IS NULL OR x.estado = @1)
         AND (@2 IS NULL OR x.nombres LIKE @2 OR x.apellidoPaterno LIKE @2 OR x.apellidoMaterno LIKE @2
              OR x.dni LIKE @2
              OR (x.apellidoPaterno + ISNULL(' ' + x.apellidoMaterno, '') + ' ' + x.nombres) LIKE @2
              OR (x.nombres + ' ' + x.apellidoPaterno) LIKE @2)
         AND (@3 IS NULL OR (@3 = 0 AND x.grupoId IS NULL AND x.esPersonal = 0)
              OR (@3 = -1 AND x.esPersonal = 1) OR x.grupoId = @3)
         AND (@4 IS NULL OR (@4 = 'INSTRUCCION' AND x.esPersonal = 1)
              OR (@4 = 'SIN_ETAPA' AND x.etapaCodigo IS NULL AND x.esPersonal = 0)
              OR x.etapaCodigo = @4)`;
    const params = [COMPANIA_ID, estado, texto, query.grupoId ?? null, query.etapa ?? null];
    const [{ total }] = await this.ds.query(`SELECT COUNT(*) AS total ${filtrado}`, params);
    const rows = await this.ds.query(
      `SELECT x.* ${filtrado}
       ORDER BY x.apellidoPaterno, x.apellidoMaterno, x.nombres, x.id
       OFFSET @5 ROWS FETCH NEXT @6 ROWS ONLY`,
      [...params, (pagina - 1) * tamano, tamano],
    );
    return { items: rows.map((r: any) => this.toView(r)), total, pagina, tamano };
  }

  /**
   * Conteos para el combo de categorías (según el estado filtrado): una opción por etapa
   * de formación e «Instrucción» (personal del sistema). Incluye los grupos activos para
   * incorporar a una persona al registrarla.
   */
  async resumen(estadoFiltro?: string) {
    const estado = estadoFiltro === 'ACTIVO' || estadoFiltro === 'INACTIVO' ? estadoFiltro : null;
    const personas = `(${SELECT_PERSONA} WHERE p.compania_id = @0) x`;
    const etapas = await this.ds.query(
      `SELECT e.codigo, e.nombre, e.orden, COUNT(x.id) AS total
       FROM etapas_formacion e
       LEFT JOIN ${personas} ON x.etapaCodigo = e.codigo AND (@1 IS NULL OR x.estado = @1)
       WHERE e.estado = 'ACTIVO'
       GROUP BY e.codigo, e.nombre, e.orden
       ORDER BY e.orden`,
      [COMPANIA_ID, estado],
    );
    const [otros] = await this.ds.query(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN x.esPersonal = 1 THEN 1 ELSE 0 END) AS instruccion
       FROM ${personas} WHERE (@1 IS NULL OR x.estado = @1)`,
      [COMPANIA_ID, estado],
    );
    const grupos = await this.ds.query(
      `SELECT g.grupo_id AS grupoId, g.nombre, g.codigo, e.nombre AS etapa
       FROM grupos_formacion g JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE g.compania_id = @0 AND g.estado = 'ACTIVO'
       ORDER BY e.orden, g.fecha_inicio DESC, g.nombre`,
      [COMPANIA_ID],
    );
    return {
      total: otros.total ?? 0,
      etapas: etapas.map((e: any) => ({ codigo: e.codigo, nombre: e.nombre, total: e.total })),
      instruccion: otros.instruccion ?? 0,
      grupos,
    };
  }

  async obtener(id: number) {
    const [row] = await this.ds.query(`${SELECT_PERSONA} WHERE p.persona_id = @0`, [id]);
    if (!row) throw new NotFoundException('Persona no encontrada');
    const [h] = await this.ds.query(
      `SELECT (SELECT COUNT(*) FROM persona_etapas WHERE persona_id = @0)
            + (SELECT COUNT(*) FROM grupo_integrantes WHERE persona_id = @0)
            + (SELECT COUNT(*) FROM asistencias WHERE persona_id = @0)
            + (SELECT COUNT(*) FROM usuarios WHERE persona_id = @0) AS n`,
      [id],
    );
    return { ...this.toView(row), eliminable: h.n === 0 };
  }

  async crear(dto: CreatePersonaDto, usuarioId: number) {
    await this.validarDni(dto.dni ?? null);
    let id: number;
    try {
      // personas tiene trigger (crea su QR): no admite OUTPUT sin INTO
      const [r] = await this.ds.query(
        `INSERT INTO personas
           (compania_id, dni, nombres, apellido_paterno, apellido_materno, telefono, correo,
            fecha_nacimiento, estado)
         VALUES (@0, @1, @2, @3, @4, @5, @6, @7, 'ACTIVO');
         SELECT CAST(SCOPE_IDENTITY() AS int) AS id`,
        [
          COMPANIA_ID,
          dto.dni ?? null,
          dto.nombres,
          dto.apellidoPaterno,
          dto.apellidoMaterno ?? null,
          dto.telefono ?? null,
          dto.correo ?? null,
          dto.fechaNacimiento ?? null,
        ],
      );
      id = Number(r.id);
    } catch (err) {
      throw this.traducirDuplicado(err, dto.dni ?? null);
    }
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PERSON_CREATED',
      modulo: 'persons',
      entidad: 'personas',
      entidadId: id,
      valorNuevo: { nombres: dto.nombres, apellidoPaterno: dto.apellidoPaterno, dni: dto.dni ?? null },
    });
    return this.obtener(id);
  }

  async actualizar(id: number, dto: UpdatePersonaDto, usuarioId: number) {
    const actual = await this.obtener(id);
    const campos: [keyof UpdatePersonaDto, string][] = [
      ['dni', 'dni'],
      ['nombres', 'nombres'],
      ['apellidoPaterno', 'apellido_paterno'],
      ['apellidoMaterno', 'apellido_materno'],
      ['telefono', 'telefono'],
      ['correo', 'correo'],
      ['fechaNacimiento', 'fecha_nacimiento'],
    ];
    const cambios = campos.filter(([k]) => dto[k] !== undefined && dto[k] !== actual[k]);
    if (cambios.length === 0) return actual;
    if (dto.dni !== undefined && dto.dni !== actual.dni) await this.validarDni(dto.dni ?? null, id);

    const sets = cambios.map(([, col], i) => `${col} = @${i + 1}`).join(', ');
    try {
      await this.ds.query(
        `UPDATE personas SET ${sets}, fecha_actualizacion = GETDATE() WHERE persona_id = @0`,
        [id, ...cambios.map(([k]) => dto[k] ?? null)],
      );
    } catch (err) {
      throw this.traducirDuplicado(err, dto.dni ?? null);
    }
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PERSON_UPDATED',
      modulo: 'persons',
      entidad: 'personas',
      entidadId: id,
      valorAnterior: Object.fromEntries(cambios.map(([k]) => [k, actual[k]])),
      valorNuevo: Object.fromEntries(cambios.map(([k]) => [k, dto[k] ?? null])),
    });
    return this.obtener(id);
  }

  /**
   * INACTIVO: sale de su grupo y su etapa vigente queda «Retirado»; si tenía cuenta, se
   * inactiva y deja de ser encargado. ACTIVO: vuelve a estar disponible (se reincorpora a
   * un grupo desde Grupos; la cuenta la reactiva un administrador).
   */
  async cambiarEstado(id: number, dto: CambiarEstadoPersonaDto, usuarioId: number) {
    const persona = await this.obtener(id);
    if (persona.estado === dto.estado) {
      throw new ConflictException(`La persona ya está ${dto.estado === 'ACTIVO' ? 'activa' : 'inactiva'}`);
    }
    const resultado = { grupoFinalizado: null as string | null, cuentaInactivada: false, encargosFinalizados: 0 };
    let cuentaId: number | null = null;

    await this.ds.transaction(async (em) => {
      if (dto.estado === 'INACTIVO') {
        const [presente] = await em.query(
          `SELECT TOP 1 g.nombre FROM asistencias a
           JOIN jornadas j ON j.jornada_id = a.jornada_id
           JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
           WHERE a.persona_id = @0 AND a.estado_asistencia = 'PRESENTE' AND j.estado = 'ABIERTA'`,
          [id],
        );
        if (presente) {
          throw new UnprocessableEntityException(
            `La persona está PRESENTE en una jornada abierta de ${presente.nombre}. Registre su salida antes de desactivarla.`,
          );
        }
        const hoy = await fechaServidor(em);
        const motivo = `Persona desactivada: ${dto.motivo}`.slice(0, 300);
        await em.query(
          `UPDATE grupo_integrantes SET estado = 'RETIRADO', fecha_fin = @1, motivo_salida = @2
           WHERE persona_id = @0 AND estado = 'ACTIVO'`,
          [id, hoy, motivo],
        );
        resultado.grupoFinalizado = persona.grupo;
        await em.query(
          `UPDATE persona_etapas SET estado = 'RETIRADO', fecha_fin = @1, observacion = @2
           WHERE persona_id = @0 AND estado = 'ACTIVO'`,
          [id, hoy, motivo.slice(0, 500)],
        );
        const [cuenta] = await em.query(`SELECT usuario_id AS id, estado_cuenta AS estado FROM usuarios WHERE persona_id = @0`, [id]);
        if (cuenta) {
          cuentaId = cuenta.id;
          const [enc] = await em.query(
            `UPDATE grupo_encargados SET estado = 'FINALIZADO', fecha_fin = GETDATE(), motivo_finalizacion = @1
             WHERE usuario_id = @0 AND estado = 'ACTIVO';
             SELECT @@ROWCOUNT AS n`,
            [cuenta.id, motivo],
          );
          resultado.encargosFinalizados = Number(enc?.n ?? 0);
          if (cuenta.estado === 'ACTIVA') {
            await em.query(
              `UPDATE usuarios SET estado_cuenta = 'INACTIVA', fecha_actualizacion = GETDATE() WHERE usuario_id = @0`,
              [cuenta.id],
            );
            resultado.cuentaInactivada = true;
          }
        }
      }
      await em.query(`UPDATE personas SET estado = @1, fecha_actualizacion = GETDATE() WHERE persona_id = @0`, [
        id,
        dto.estado,
      ]);
    });

    if (cuentaId != null) this.authz.invalidar(cuentaId);
    await this.auditoria.registrar({
      usuarioId,
      accion: dto.estado === 'INACTIVO' ? 'PERSON_DEACTIVATED' : 'PERSON_REACTIVATED',
      modulo: 'persons',
      entidad: 'personas',
      entidadId: id,
      valorAnterior: { estado: persona.estado, grupo: persona.grupo, etapa: persona.etapaCodigo },
      valorNuevo: { estado: dto.estado, motivo: dto.motivo, ...resultado },
    });
    return resultado;
  }

  /** Solo registros sin ninguna historia (creados por error) */
  async eliminar(id: number, usuarioId: number): Promise<void> {
    const persona = await this.obtener(id);
    if (!persona.eliminable) {
      throw new ConflictException(
        'La persona ya tiene historia (etapas, grupos, asistencias o cuenta) y no se puede eliminar. Desactívela.',
      );
    }
    await this.ds.transaction(async (em) => {
      await em.query(`DELETE FROM persona_qr WHERE persona_id = @0`, [id]);
      await em.query(`DELETE FROM personas WHERE persona_id = @0`, [id]);
    });
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PERSON_DELETED',
      modulo: 'persons',
      entidad: 'personas',
      entidadId: id,
      valorAnterior: { nombres: persona.nombres, apellidoPaterno: persona.apellidoPaterno, dni: persona.dni },
    });
  }

  private async validarDni(dni: string | null, excluirId?: number): Promise<void> {
    if (!dni) return;
    const [existente] = await this.ds.query(
      `SELECT persona_id AS id, apellido_paterno + ' ' + nombres AS nombre FROM personas
       WHERE compania_id = @0 AND dni = @1 AND (@2 IS NULL OR persona_id <> @2)`,
      [COMPANIA_ID, dni, excluirId ?? null],
    );
    if (existente) throw new ConflictException(`El DNI ${dni} ya pertenece a ${existente.nombre}`);
  }

  /** UQ_personas_compania_dni no filtra NULL: solo puede existir una persona sin DNI */
  private traducirDuplicado(err: unknown, dni: string | null): Error {
    const texto = String((err as Error)?.message ?? '');
    if (/UQ_personas_compania_dni|UX_personas_compania_dni|duplicate key/i.test(texto)) {
      return new ConflictException(
        dni
          ? `El DNI ${dni} ya está registrado`
          : 'Ya existe otra persona sin DNI registrado. Ingrese el DNI de esta persona.',
      );
    }
    return err as Error;
  }

  private toView(r: any): PersonaView {
    return {
      id: r.id,
      dni: r.dni ?? null,
      nombres: r.nombres,
      apellidoPaterno: r.apellidoPaterno,
      apellidoMaterno: r.apellidoMaterno ?? null,
      telefono: r.telefono ?? null,
      correo: r.correo ?? null,
      fechaNacimiento: r.fechaNacimiento ? fechaColumna(r.fechaNacimiento) : null,
      estado: r.estado,
      etapaCodigo: r.etapaCodigo ?? null,
      etapa: r.etapa ?? null,
      grupoId: r.grupoId ?? null,
      grupo: r.grupo ?? null,
      username: r.username ?? null,
      roles: r.roles ? String(r.roles).split(', ') : [],
      encargaGrupoId: r.encargaGrupoId ?? null,
      encargaGrupo: r.encargaGrupo ?? null,
      esPersonal: r.esPersonal === 1,
    };
  }
}
