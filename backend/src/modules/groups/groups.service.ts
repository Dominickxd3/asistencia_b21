import { randomInt } from 'crypto';
import { hash } from 'argon2';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { GrupoFormacion } from './entities/grupo-formacion.entity';
import { GrupoEncargado } from './entities/grupo-encargado.entity';
import { GrupoIntegrante } from './entities/grupo-integrante.entity';
import {
  CandidatoEncargadoView,
  CandidatoIntegranteView,
  GrupoDetalleView,
  GrupoEtapaView,
  IntegranteView,
  ResultadoAsignacionEncargado,
} from './views/grupo.view';
import {
  AssignManagerDto,
  CambiarEstadoGrupoDto,
  CreateGroupDto,
  ReactivarGrupoDto,
  RetirarIntegranteDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { AuditoriaService } from '../audit/auditoria.service';
import { fechaColumna, fechaServidor } from '../../common/utils/fecha.util';
import {
  aplicaAsistenciaObligatoria,
  horarioReglamentario,
} from '../../common/business/reglas-asistencia';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { RoleCode } from '../../common/constants/roles.constants';
import { AuthzService } from '../roles/authz.service';

const COMPANIA_ID = 1;

/** Contraseña temporal legible (sin 0/O, 1/l/I) para entregar al nuevo encargado */
function generarPasswordTemporal(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digitos = '23456789';
  const elegir = (fuente: string, n: number) =>
    Array.from({ length: n }, () => fuente[randomInt(fuente.length)]).join('');
  return `R21-${elegir(letras, 4)}${elegir(digitos, 2)}${elegir(letras, 2)}`;
}

/** Nombre completo en SQL con el mismo formato que Persona.nombreCompleto */
const NOMBRE_SQL = (p: string) =>
  `LTRIM(RTRIM(${p}.apellido_paterno + ISNULL(' ' + ${p}.apellido_materno, '') + ' ' + ${p}.nombres))`;

const SELECT_GRUPO = `
  SELECT g.grupo_id AS id, g.codigo, g.nombre, g.periodo, g.etapa_id AS etapaId,
         e.nombre AS etapa, e.codigo AS etapaCodigo, e.orden AS etapaOrden, g.estado,
         g.fecha_inicio AS fechaInicio, g.fecha_fin AS fechaFin,
         (SELECT COUNT(*) FROM grupo_integrantes gi
           WHERE gi.grupo_id = g.grupo_id AND gi.estado = 'ACTIVO') AS totalIntegrantes,
         enc.usuario_id AS encUsuarioId, enc.nombre AS encNombre, enc.fecha_inicio AS encDesde
  FROM grupos_formacion g
  JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
  OUTER APPLY (SELECT TOP 1 ge.usuario_id, ge.fecha_inicio, ${NOMBRE_SQL('p')} AS nombre
               FROM grupo_encargados ge
               JOIN usuarios u ON u.usuario_id = ge.usuario_id
               JOIN personas p ON p.persona_id = u.persona_id
               WHERE ge.grupo_id = g.grupo_id AND ge.estado = 'ACTIVO'
               ORDER BY ge.fecha_inicio DESC) enc`;

/**
 * Grupos (cohortes) de formación.
 * - Nunca se borra historia: cerrar/cancelar finaliza integrantes, encargado y programación.
 * - Solo se elimina físicamente un grupo recién creado, sin integrantes, asistencias ni reportes.
 * - Una persona integra como máximo un grupo activo, y siempre de su etapa vigente.
 * - Un usuario encarga como máximo un grupo activo, y debe tener el permiso de encargado.
 */
@Injectable()
export class GroupsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(GrupoFormacion)
    private readonly grupoRepo: Repository<GrupoFormacion>,
    @InjectRepository(GrupoEncargado)
    private readonly encargadoRepo: Repository<GrupoEncargado>,
    @InjectRepository(GrupoIntegrante)
    private readonly integranteRepo: Repository<GrupoIntegrante>,
    private readonly auditoria: AuditoriaService,
    private readonly authz: AuthzService,
  ) {}

  // ================= Consultas =================

  async listar(estado?: string): Promise<GrupoEtapaView[]> {
    const filtro = estado && estado !== 'TODOS' ? estado : null;
    const rows = await this.ds.query(
      `${SELECT_GRUPO}
       WHERE g.compania_id = @0 AND (@1 IS NULL OR g.estado = @1)
       ORDER BY CASE g.estado WHEN 'ACTIVO' THEN 0 ELSE 1 END, e.orden, g.fecha_inicio DESC, g.nombre`,
      [COMPANIA_ID, filtro],
    );
    return rows.map((r: any) => this.toView(r));
  }

  async detalle(grupoId: number): Promise<GrupoDetalleView> {
    const [row] = await this.ds.query(`${SELECT_GRUPO} WHERE g.grupo_id = @0`, [grupoId]);
    if (!row) throw new NotFoundException('Grupo no encontrado');

    const [historia] = await this.ds.query(
      `SELECT
         (SELECT COUNT(*) FROM grupo_integrantes WHERE grupo_id = @0) AS integrantes,
         (SELECT COUNT(*) FROM persona_etapas WHERE grupo_id = @0) AS etapas,
         (SELECT COUNT(*) FROM asistencias a JOIN jornadas j ON j.jornada_id = a.jornada_id
           WHERE j.grupo_id = @0) AS asistencias,
         (SELECT COUNT(*) FROM reporte_grupos WHERE grupo_id = @0) AS reportes,
         (SELECT COUNT(*) FROM jornadas WHERE grupo_id = @0 AND estado = 'ABIERTA') AS abiertas`,
      [grupoId],
    );
    const sinHistoria =
      historia.integrantes === 0 && historia.etapas === 0 && historia.asistencias === 0;

    const encargados = await this.ds.query(
      `SELECT ge.usuario_id AS usuarioId, ${NOMBRE_SQL('p')} AS nombre,
              ge.fecha_inicio AS desde, ge.fecha_fin AS hasta, ge.estado,
              ge.motivo_finalizacion AS motivo
       FROM grupo_encargados ge
       JOIN usuarios u ON u.usuario_id = ge.usuario_id
       JOIN personas p ON p.persona_id = u.persona_id
       WHERE ge.grupo_id = @0
       ORDER BY ge.fecha_inicio DESC, ge.grupo_encargado_id DESC`,
      [grupoId],
    );
    const exIntegrantes = await this.ds.query(
      `SELECT gi.persona_id AS personaId, ${NOMBRE_SQL('p')} AS nombreCompleto,
              gi.fecha_inicio AS fechaIngreso, gi.fecha_fin AS fechaSalida, gi.estado,
              gi.motivo_salida AS motivo
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id
       WHERE gi.grupo_id = @0 AND gi.estado <> 'ACTIVO'
       ORDER BY gi.fecha_fin DESC, gi.grupo_integrante_id DESC`,
      [grupoId],
    );
    const programacionObligatoria = await this.ds.query(
      `SELECT pd.dia_semana AS diaSemana,
              CONVERT(varchar(5), pd.hora_inicio, 108) AS horaInicio
       FROM programacion_detalles pd
       JOIN programaciones pr ON pr.programacion_id = pd.programacion_id
       WHERE pr.programacion_id = (
         SELECT TOP 1 pr2.programacion_id
         FROM programaciones pr2
         WHERE pr2.grupo_id = @0
         ORDER BY CASE WHEN pr2.estado = 'ACTIVO' THEN 0 ELSE 1 END,
                  pr2.programacion_id DESC
       )
         AND pd.tipo_jornada = 'OBLIGATORIA'
         AND pd.estado = 'ACTIVO'
       ORDER BY pd.dia_semana`,
      [grupoId],
    );

    return {
      ...this.toView(row),
      eliminable: sinHistoria && historia.reportes === 0,
      etapaEditable: sinHistoria && row.estado === 'ACTIVO',
      jornadasAbiertas: historia.abiertas,
      programacionObligatoria: programacionObligatoria.map((h: any) => ({
        diaSemana: Number(h.diaSemana),
        horaInicio: h.horaInicio,
      })),
      integrantes: await this.integrantes(grupoId),
      historialEncargados: encargados,
      exIntegrantes: exIntegrantes.map((x: any) => ({
        ...x,
        fechaIngreso: fechaColumna(x.fechaIngreso),
        fechaSalida: x.fechaSalida ? fechaColumna(x.fechaSalida) : null,
      })),
    };
  }

  async catalogos() {
    const etapas = await this.ds.query(
      `SELECT etapa_id AS id, codigo, nombre, orden FROM etapas_formacion
       WHERE estado = 'ACTIVO' ORDER BY orden`,
    );
    return { etapas };
  }

  /** Personas activas buscables, con su situación respecto de este grupo */
  async candidatosIntegrante(grupoId: number, q?: string): Promise<CandidatoIntegranteView[]> {
    const grupo = await this.grupoActivo(grupoId);
    const texto = q?.trim() ? `%${q.trim()}%` : null;
    const rows = await this.ds.query(
      `SELECT TOP 30 p.persona_id AS personaId, ${NOMBRE_SQL('p')} AS nombreCompleto, p.dni,
              e.etapa_id AS etapaId, e.codigo AS etapaCodigo, e.nombre AS etapa,
              gi.grupo_id AS grupoActualId, ga.nombre AS grupoActual
       FROM personas p
       OUTER APPLY (SELECT TOP 1 pe.etapa_id FROM persona_etapas pe
                    WHERE pe.persona_id = p.persona_id AND pe.estado = 'ACTIVO'
                    ORDER BY pe.fecha_inicio DESC) pe
       LEFT JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       OUTER APPLY (SELECT TOP 1 gi.grupo_id FROM grupo_integrantes gi
                    WHERE gi.persona_id = p.persona_id AND gi.estado = 'ACTIVO') gi
       LEFT JOIN grupos_formacion ga ON ga.grupo_id = gi.grupo_id
       WHERE p.compania_id = @0 AND p.estado = 'ACTIVO'
         AND (@1 IS NULL OR p.nombres LIKE @1 OR p.apellido_paterno LIKE @1
              OR p.apellido_materno LIKE @1 OR p.dni LIKE @1
              OR ${NOMBRE_SQL('p')} LIKE @1)
       ORDER BY CASE WHEN gi.grupo_id IS NULL THEN 0 ELSE 1 END,
                p.apellido_paterno, p.apellido_materno, p.nombres`,
      [COMPANIA_ID, texto],
    );
    return rows.map((r: any) => {
      let situacion: CandidatoIntegranteView['situacion'] = 'AGREGAR';
      if (r.grupoActualId === grupoId) situacion = 'YA_INTEGRA';
      else if (r.etapaId != null && r.etapaId !== grupo.etapaId) situacion = 'OTRA_ETAPA';
      else if (r.grupoActualId != null) situacion = 'TRANSFERIR';
      return {
        personaId: r.personaId,
        nombreCompleto: r.nombreCompleto,
        dni: r.dni,
        etapaCodigo: r.etapaCodigo,
        etapa: r.etapa,
        grupoActualId: r.grupoActualId,
        grupoActual: r.grupoActual,
        situacion,
      };
    });
  }

  /**
   * Candidatos a encargado de un grupo:
   * - sus integrantes activos, tengan o no cuenta (al asignarlos se crea la cuenta
   *   o se otorga el rol «Encargado de grupo»);
   * - otros usuarios activos cuyo rol ya los habilita como encargados.
   */
  async candidatosEncargado(grupoId: number): Promise<CandidatoEncargadoView[]> {
    await this.grupoActivo(grupoId);
    const rows = await this.ds.query(
      `SELECT p.persona_id AS personaId, ${NOMBRE_SQL('p')} AS nombre,
              p.nombres, p.apellido_paterno AS apellidoPaterno,
              u.usuario_id AS usuarioId, u.username, u.estado_cuenta AS estadoCuenta,
              CASE WHEN u.usuario_id IS NOT NULL AND EXISTS (${this.sqlTienePermiso('u.usuario_id')})
                   THEN 1 ELSE 0 END AS habilitado,
              CASE WHEN gi.grupo_integrante_id IS NULL THEN 0 ELSE 1 END AS esIntegrante,
              STUFF((SELECT DISTINCT ', ' + r2.nombre
                     FROM usuario_roles ur2 JOIN roles r2 ON r2.rol_id = ur2.rol_id
                     WHERE ur2.usuario_id = u.usuario_id AND ur2.estado = 'ACTIVO'
                       AND r2.estado = 'ACTIVO'
                     FOR XML PATH('')), 1, 2, '') AS roles,
              ga.grupo_id AS grupoActualId, ga.nombre AS grupoActual
       FROM personas p
       LEFT JOIN usuarios u ON u.persona_id = p.persona_id
       LEFT JOIN grupo_integrantes gi
         ON gi.persona_id = p.persona_id AND gi.grupo_id = @1 AND gi.estado = 'ACTIVO'
       OUTER APPLY (SELECT TOP 1 g.grupo_id, g.nombre FROM grupo_encargados ge
                    JOIN grupos_formacion g ON g.grupo_id = ge.grupo_id
                    WHERE ge.usuario_id = u.usuario_id AND ge.estado = 'ACTIVO') ga
       WHERE p.estado = 'ACTIVO'
         AND (gi.grupo_integrante_id IS NOT NULL
              OR (u.estado_cuenta = 'ACTIVA' AND EXISTS (${this.sqlTienePermiso('u.usuario_id')})))
       ORDER BY esIntegrante DESC, p.apellido_paterno, p.apellido_materno, p.nombres`,
      [PermissionCode.ATTENDANCE_VIEW_GROUP, grupoId],
    );
    const reservados = new Set<string>();
    const candidatos: CandidatoEncargadoView[] = [];
    for (const r of rows) {
      const situacion: CandidatoEncargadoView['situacion'] =
        r.usuarioId == null
          ? 'SIN_CUENTA'
          : r.estadoCuenta !== 'ACTIVA'
            ? 'CUENTA_INACTIVA'
            : r.habilitado
              ? 'LISTO'
              : 'SIN_ROL';
      candidatos.push({
        personaId: r.personaId,
        usuarioId: r.usuarioId ?? null,
        username: r.username ?? null,
        nombre: r.nombre,
        roles: r.roles ? String(r.roles).split(', ') : [],
        esIntegrante: r.esIntegrante === 1,
        situacion,
        usernameSugerido:
          situacion === 'SIN_CUENTA' ? await this.sugerirUsername(r.nombres, r.apellidoPaterno, reservados) : null,
        grupoActualId: r.grupoActualId ?? null,
        grupoActual: r.grupoActual ?? null,
      });
    }
    return candidatos;
  }

  /** «nombre.apellido» en minúsculas y sin tildes; agrega un número si ya existe */
  private async sugerirUsername(nombres: string, apellido: string, reservados: Set<string>): Promise<string> {
    const limpio = (s: string) =>
      (s ?? '')
        .trim()
        .split(/\s+/)[0]
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const base = [limpio(nombres), limpio(apellido)].filter(Boolean).join('.') || 'encargado';
    const usados: { username: string }[] = await this.ds.query(
      `SELECT username FROM usuarios WHERE username = @0 OR username LIKE @1`,
      [base, `${base}%`],
    );
    const ocupados = new Set([...usados.map((u) => u.username.toLowerCase()), ...reservados]);
    let propuesta = base;
    for (let n = 2; ocupados.has(propuesta); n++) propuesta = `${base}${n}`;
    reservados.add(propuesta);
    return propuesta;
  }

  // ================= CRUD de grupo =================

  async crear(dto: CreateGroupDto, usuarioId: number): Promise<GrupoDetalleView> {
    const etapa = await this.etapaActiva(dto.etapaId);
    this.validarProgramacionObligatoria(etapa.codigo, dto.programacionObligatoria);
    this.validarFechas(dto.fechaInicio, dto.fechaFin ?? null);
    await this.validarCodigoLibre(dto.codigo);

    const grupoId = await this.ds.transaction(async (em) => {
      const [insertado] = await em.query(
        `INSERT INTO grupos_formacion
           (compania_id, etapa_id, codigo, nombre, periodo, fecha_inicio, fecha_fin, estado,
            creado_por_usuario_id)
         OUTPUT INSERTED.grupo_id AS id
         VALUES (@0, @1, @2, @3, @4, @5, @6, 'ACTIVO', @7)`,
        [
          COMPANIA_ID,
          dto.etapaId,
          dto.codigo,
          dto.nombre,
          dto.periodo,
          dto.fechaInicio,
          dto.fechaFin ?? null,
          usuarioId,
        ],
      );
      const id = Number(insertado.id);
      await this.crearProgramacion(
        em,
        id,
        etapa.codigo,
        dto.fechaInicio,
        dto.fechaFin ?? null,
        usuarioId,
        dto.programacionObligatoria,
      );
      return id;
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GROUP_CREATED',
      modulo: 'groups',
      entidad: 'grupos_formacion',
      entidadId: grupoId,
      valorNuevo: dto,
    });
    return this.detalle(grupoId);
  }

  async actualizar(grupoId: number, dto: UpdateGroupDto, usuarioId: number): Promise<GrupoDetalleView> {
    const actual = await this.detalle(grupoId);
    if (actual.estado !== 'ACTIVO') {
      throw new UnprocessableEntityException(
        `El grupo está ${actual.estado.toLowerCase()}; solo se editan grupos activos`,
      );
    }
    const cambios: Record<string, unknown> = {};
    const anterior: Record<string, unknown> = {};
    const marcar = (campo: keyof GrupoEtapaView, valor: unknown) => {
      if (valor !== undefined && valor !== actual[campo]) {
        cambios[campo] = valor;
        anterior[campo] = actual[campo];
      }
    };
    marcar('codigo', dto.codigo);
    marcar('nombre', dto.nombre);
    marcar('periodo', dto.periodo);
    marcar('fechaInicio', dto.fechaInicio);
    marcar('fechaFin', dto.fechaFin);
    marcar('etapaId', dto.etapaId);

    const horarioCambia =
      dto.programacionObligatoria !== undefined &&
      !this.mismoHorario(dto.programacionObligatoria, actual.programacionObligatoria);
    if (horarioCambia) {
      cambios.programacionObligatoria = dto.programacionObligatoria;
      anterior.programacionObligatoria = actual.programacionObligatoria;
    }

    if (Object.keys(cambios).length === 0) return actual;

    if (cambios.codigo !== undefined) await this.validarCodigoLibre(dto.codigo!, grupoId);
    const fechaInicio = (cambios.fechaInicio as string | undefined) ?? actual.fechaInicio;
    const fechaFin =
      cambios.fechaFin !== undefined ? (cambios.fechaFin as string | null) : actual.fechaFin;
    this.validarFechas(fechaInicio, fechaFin);

    let nuevaEtapa: { id: number; codigo: string } | null = null;
    if (cambios.etapaId !== undefined) {
      if (!actual.etapaEditable) {
        throw new ConflictException(
          'La etapa ya no se puede cambiar: el grupo tiene integrantes o asistencias registradas. ' +
            'Para mover personas de etapa use «Promover» en Personas.',
        );
      }
      nuevaEtapa = await this.etapaActiva(cambios.etapaId as number);
    }
    const etapaCodigoDestino = nuevaEtapa?.codigo ?? actual.etapaCodigo;
    if (dto.programacionObligatoria !== undefined) {
      this.validarProgramacionObligatoria(etapaCodigoDestino, dto.programacionObligatoria);
    }

    await this.ds.transaction(async (em) => {
      await em.query(
        `UPDATE grupos_formacion
         SET codigo = @1, nombre = @2, periodo = @3, fecha_inicio = @4, fecha_fin = @5,
             etapa_id = @6, fecha_actualizacion = GETDATE()
         WHERE grupo_id = @0`,
        [
          grupoId,
          dto.codigo ?? actual.codigo,
          dto.nombre ?? actual.nombre,
          dto.periodo ?? actual.periodo,
          fechaInicio,
          fechaFin,
          nuevaEtapa?.id ?? actual.etapaId,
        ],
      );
      // La programación sigue la vigencia del grupo…
      await em.query(
        `UPDATE programaciones SET fecha_inicio = @1, fecha_fin = @2
         WHERE grupo_id = @0 AND estado = 'ACTIVO'`,
        [grupoId, fechaInicio, fechaFin],
      );
      // …y el horario reglamentario de su etapa (solo posible sin historia)
      if (nuevaEtapa) {
        await em.query(
          `DELETE FROM jornadas WHERE grupo_id = @0 AND estado = 'PROGRAMADA'
             AND NOT EXISTS (SELECT 1 FROM asistencias a WHERE a.jornada_id = jornadas.jornada_id)
             AND NOT EXISTS (SELECT 1 FROM asistencia_ubicaciones u WHERE u.jornada_id = jornadas.jornada_id)`,
          [grupoId],
        );
        await em.query(
          `DELETE pd FROM programacion_detalles pd
           JOIN programaciones pr ON pr.programacion_id = pd.programacion_id
           WHERE pr.grupo_id = @0
             AND NOT EXISTS (SELECT 1 FROM jornadas j WHERE j.programacion_detalle_id = pd.programacion_detalle_id)`,
          [grupoId],
        );
        await em.query(
          `UPDATE programaciones SET estado = 'FINALIZADO', fecha_fin = @1
           WHERE grupo_id = @0 AND estado = 'ACTIVO'`,
          [grupoId, fechaInicio],
        );
        await this.crearProgramacion(
          em,
          grupoId,
          nuevaEtapa.codigo,
          fechaInicio,
          fechaFin,
          usuarioId,
          dto.programacionObligatoria,
        );
      } else if (horarioCambia) {
        await this.actualizarProgramacionObligatoria(
          em,
          grupoId,
          dto.programacionObligatoria!,
        );
      }
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GROUP_UPDATED',
      modulo: 'groups',
      entidad: 'grupos_formacion',
      entidadId: grupoId,
      valorAnterior: anterior,
      valorNuevo: cambios,
    });
    return this.detalle(grupoId);
  }

  /**
   * Cierra (fin normal del periodo) o cancela un grupo activo.
   * Finaliza integrantes, encargado y programación; cancela las jornadas futuras aún no abiertas.
   */
  async cambiarEstado(grupoId: number, dto: CambiarEstadoGrupoDto, usuarioId: number) {
    const grupo = await this.grupoActivo(grupoId);
    const resultado = await this.ds.transaction(async (em) => {
      const [abiertas] = await em.query(
        `SELECT COUNT(*) AS n FROM jornadas WHERE grupo_id = @0 AND estado = 'ABIERTA'`,
        [grupoId],
      );
      if (abiertas.n > 0) {
        throw new UnprocessableEntityException(
          `El grupo tiene ${abiertas.n} jornada(s) abierta(s). Ciérrelas en Asistencia antes de ${
            dto.estado === 'CERRADO' ? 'cerrar' : 'cancelar'
          } el grupo.`,
        );
      }
      const hoy = await fechaServidor(em);
      const motivoSalida = dto.estado === 'CERRADO' ? 'Cierre del grupo' : 'Grupo cancelado';

      const integrantes = await em.query(
        `UPDATE grupo_integrantes
         SET estado = 'FINALIZADO', fecha_fin = @1, motivo_salida = @2
         OUTPUT INSERTED.persona_id AS personaId
         WHERE grupo_id = @0 AND estado = 'ACTIVO'`,
        [grupoId, hoy, `${motivoSalida}: ${dto.motivo}`.slice(0, 300)],
      );
      await em.query(
        `UPDATE grupo_encargados
         SET estado = 'FINALIZADO', fecha_fin = GETDATE(), motivo_finalizacion = @1
         WHERE grupo_id = @0 AND estado = 'ACTIVO'`,
        [grupoId, motivoSalida],
      );
      // jornadas tiene trigger: no admite OUTPUT sin INTO, se cuenta con @@ROWCOUNT
      const [jornadas] = await em.query(
        `UPDATE jornadas SET estado = 'CANCELADA',
                observacion = LEFT(ISNULL(observacion + ' · ', '') + @1, 500)
         WHERE grupo_id = @0 AND estado = 'PROGRAMADA' AND fecha >= CAST(GETDATE() AS date);
         SELECT @@ROWCOUNT AS n`,
        [grupoId, motivoSalida],
      );
      await em.query(
        `UPDATE programaciones
         SET estado = 'FINALIZADO', fecha_fin = CASE WHEN fecha_inicio > @1 THEN fecha_inicio ELSE @1 END
         WHERE grupo_id = @0 AND estado = 'ACTIVO'`,
        [grupoId, hoy],
      );
      await em.query(
        `UPDATE grupos_formacion
         SET estado = @1,
             -- nunca antes del inicio (grupo cancelado antes de empezar)
             fecha_fin = CASE WHEN fecha_inicio > @2 THEN fecha_inicio
                              WHEN fecha_fin IS NULL OR fecha_fin > @2 THEN @2
                              ELSE fecha_fin END,
             fecha_actualizacion = GETDATE()
         WHERE grupo_id = @0`,
        [grupoId, dto.estado, hoy],
      );
      return { integrantesFinalizados: integrantes.length, jornadasCanceladas: Number(jornadas?.n ?? 0) };
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: dto.estado === 'CERRADO' ? 'GROUP_CLOSED' : 'GROUP_CANCELLED',
      modulo: 'groups',
      entidad: 'grupos_formacion',
      entidadId: grupoId,
      valorAnterior: { estado: grupo.estado },
      valorNuevo: { estado: dto.estado, motivo: dto.motivo, ...resultado },
    });
    return resultado;
  }

  /**
   * Reactiva un grupo cerrado o cancelado: vuelve a ACTIVO sin fecha de fin, abre una
   * programación nueva desde hoy y repone las jornadas futuras que canceló el cierre.
   * Opcionalmente reincorpora a quienes salieron por el último cierre, salvo que hoy
   * integren otro grupo, hayan cambiado de etapa o se hayan retirado.
   * El encargado no se repone: se asigna de nuevo.
   */
  async reactivar(grupoId: number, dto: ReactivarGrupoDto, usuarioId: number) {
    const grupo = await this.grupoRepo.findOne({ where: { id: grupoId }, relations: { etapa: true } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (grupo.estado === 'ACTIVO') throw new ConflictException('El grupo ya está activo');
    const restaurar = dto.restaurarIntegrantes ?? true;
    const horarioAnterior: { diaSemana: number; horaInicio: string }[] = await this.ds.query(
      `SELECT pd.dia_semana AS diaSemana,
              CONVERT(varchar(5), pd.hora_inicio, 108) AS horaInicio
       FROM programacion_detalles pd
       WHERE pd.programacion_id = (
         SELECT TOP 1 programacion_id FROM programaciones
         WHERE grupo_id = @0 ORDER BY programacion_id DESC
       )
         AND pd.tipo_jornada = 'OBLIGATORIA' AND pd.estado = 'ACTIVO'
       ORDER BY pd.dia_semana`,
      [grupoId],
    );
    const SALIDA_POR_CIERRE = `(gi.motivo_salida LIKE 'Cierre del grupo%' OR gi.motivo_salida LIKE 'Grupo cancelado%')`;

    const resultado = await this.ds.transaction(async (em) => {
      const hoy = await fechaServidor(em);
      const inicio = fechaColumna(grupo.fechaInicio);
      await em.query(
        `UPDATE grupos_formacion SET estado = 'ACTIVO', fecha_fin = NULL, fecha_actualizacion = GETDATE()
         WHERE grupo_id = @0`,
        [grupoId],
      );
      await this.crearProgramacion(
        em,
        grupoId,
        grupo.etapa.codigo,
        inicio > hoy ? inicio : hoy,
        null,
        usuarioId,
        horarioAnterior.length > 0 ? horarioAnterior : undefined,
      );
      const [jornadas] = await em.query(
        `UPDATE jornadas
         SET estado = 'PROGRAMADA',
             observacion = NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(observacion,
               ' · Cierre del grupo', ''), ' · Grupo cancelado', ''), 'Cierre del grupo', ''), 'Grupo cancelado', ''), '')
         WHERE grupo_id = @0 AND estado = 'CANCELADA' AND fecha >= CAST(GETDATE() AS date)
           AND (observacion LIKE '%Cierre del grupo' OR observacion LIKE '%Grupo cancelado');
         SELECT @@ROWCOUNT AS n`,
        [grupoId],
      );

      let integrantesRestaurados = 0;
      const omitidos: { nombre: string; motivo: string }[] = [];
      if (restaurar) {
        const salidos = await em.query(
          `SELECT gi.persona_id AS personaId, ${NOMBRE_SQL('p')} AS nombre, p.estado AS estadoPersona,
                  (SELECT TOP 1 g2.nombre FROM grupo_integrantes x JOIN grupos_formacion g2 ON g2.grupo_id = x.grupo_id
                    WHERE x.persona_id = gi.persona_id AND x.estado = 'ACTIVO') AS otroGrupo,
                  (SELECT TOP 1 pe.etapa_id FROM persona_etapas pe
                    WHERE pe.persona_id = gi.persona_id AND pe.estado = 'ACTIVO'
                    ORDER BY pe.fecha_inicio DESC) AS etapaId
           FROM grupo_integrantes gi
           JOIN personas p ON p.persona_id = gi.persona_id
           WHERE gi.grupo_id = @0 AND gi.estado = 'FINALIZADO' AND ${SALIDA_POR_CIERRE}
             AND gi.fecha_fin = (SELECT MAX(gi2.fecha_fin) FROM grupo_integrantes gi2
                                 WHERE gi2.grupo_id = @0 AND gi2.estado = 'FINALIZADO'
                                   AND (gi2.motivo_salida LIKE 'Cierre del grupo%' OR gi2.motivo_salida LIKE 'Grupo cancelado%'))`,
          [grupoId],
        );
        for (const s of salidos) {
          let motivo: string | null = null;
          if (s.estadoPersona !== 'ACTIVO') motivo = 'persona inactiva';
          else if (s.otroGrupo) motivo = `ya integra «${s.otroGrupo}»`;
          else if (s.etapaId == null) motivo = 'ya no tiene una etapa vigente';
          else if (s.etapaId !== grupo.etapaId) motivo = 'ahora está en otra etapa';
          if (motivo) {
            omitidos.push({ nombre: s.nombre, motivo });
            continue;
          }
          await em.query(
            `INSERT INTO grupo_integrantes (grupo_id, persona_id, fecha_inicio, estado, creado_por_usuario_id)
             VALUES (@0, @1, @2, 'ACTIVO', @3)`,
            [grupoId, s.personaId, hoy, usuarioId],
          );
          await em.query(
            `UPDATE persona_etapas SET grupo_id = @1
             WHERE persona_id = @0 AND estado = 'ACTIVO' AND grupo_id IS NULL`,
            [s.personaId, grupoId],
          );
          integrantesRestaurados++;
        }
      }
      return { integrantesRestaurados, omitidos, jornadasRepuestas: Number(jornadas?.n ?? 0) };
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'GROUP_REACTIVATED',
      modulo: 'groups',
      entidad: 'grupos_formacion',
      entidadId: grupoId,
      valorAnterior: { estado: grupo.estado, fechaFin: grupo.fechaFin },
      valorNuevo: { estado: 'ACTIVO', motivo: dto.motivo, ...resultado },
    });
    return resultado;
  }

  /** Borrado físico: solo para grupos creados por error, sin ninguna historia */
  async eliminar(grupoId: number, usuarioId: number): Promise<void> {
    const detalle = await this.detalle(grupoId);
    if (!detalle.eliminable) {
      throw new ConflictException(
        'El grupo ya tiene historia (integrantes, asistencias o reportes) y no se puede eliminar. ' +
          'Use «Cerrar» o «Cancelar» para conservar el historial.',
      );
    }
    await this.ds.transaction(async (em) => {
      await em.query(`DELETE FROM asistencia_ubicaciones WHERE jornada_id IN
                        (SELECT jornada_id FROM jornadas WHERE grupo_id = @0)`, [grupoId]);
      await em.query(`DELETE FROM jornadas WHERE grupo_id = @0`, [grupoId]);
      await em.query(
        `DELETE pd FROM programacion_detalles pd
         JOIN programaciones pr ON pr.programacion_id = pd.programacion_id
         WHERE pr.grupo_id = @0`,
        [grupoId],
      );
      await em.query(`DELETE FROM programaciones WHERE grupo_id = @0`, [grupoId]);
      await em.query(`DELETE FROM grupo_encargados WHERE grupo_id = @0`, [grupoId]);
      await em.query(`DELETE FROM grupos_formacion WHERE grupo_id = @0`, [grupoId]);
    });
    await this.auditoria.registrar({
      usuarioId,
      accion: 'GROUP_DELETED',
      modulo: 'groups',
      entidad: 'grupos_formacion',
      entidadId: grupoId,
      valorAnterior: {
        codigo: detalle.codigo,
        nombre: detalle.nombre,
        etapa: detalle.etapaCodigo,
        periodo: detalle.periodo,
      },
    });
  }

  // ================= Encargado =================

  /**
   * Asigna encargado: finaliza la asignación vigente y crea la nueva.
   * Con `personaId` (integrante del grupo) se usa su cuenta; si no tiene el rol se le otorga
   * «Encargado de grupo» (y nada más), y si no tiene cuenta se crea con contraseña temporal.
   */
  async asignarEncargado(
    grupoId: number,
    dto: AssignManagerDto,
    usuarioId: number,
  ): Promise<ResultadoAsignacionEncargado> {
    await this.grupoActivo(grupoId);
    if (dto.usuarioId == null && dto.personaId == null) {
      throw new BadRequestException('Indique el integrante o el usuario que será encargado');
    }
    let destinoId = 0;
    let credenciales: ResultadoAsignacionEncargado['credenciales'] = null;
    let rolOtorgado = false;

    await this.ds.transaction(async (em) => {
      if (dto.personaId != null) {
        const [p] = await em.query(
          `SELECT p.persona_id AS id, p.estado, ${NOMBRE_SQL('p')} AS nombre,
                  CASE WHEN gi.grupo_integrante_id IS NULL THEN 0 ELSE 1 END AS esIntegrante,
                  u.usuario_id AS usuarioId, u.estado_cuenta AS estadoCuenta,
                  CASE WHEN u.usuario_id IS NOT NULL AND EXISTS (${this.sqlTienePermiso('u.usuario_id')})
                       THEN 1 ELSE 0 END AS habilitado
           FROM personas p
           LEFT JOIN usuarios u ON u.persona_id = p.persona_id
           LEFT JOIN grupo_integrantes gi
             ON gi.persona_id = p.persona_id AND gi.grupo_id = @2 AND gi.estado = 'ACTIVO'
           WHERE p.persona_id = @1`,
          [PermissionCode.ATTENDANCE_VIEW_GROUP, dto.personaId, grupoId],
        );
        if (!p || p.estado !== 'ACTIVO') throw new NotFoundException('Persona no encontrada o inactiva');
        const puedeHabilitar = p.esIntegrante === 1;
        if (p.usuarioId == null) {
          if (!puedeHabilitar) {
            throw new UnprocessableEntityException('Solo se crea cuenta a integrantes activos del grupo');
          }
          if (!dto.username) throw new BadRequestException('Indique el usuario para la cuenta nueva');
          const [ocupado] = await em.query(`SELECT 1 AS x FROM usuarios WHERE username = @0`, [dto.username]);
          if (ocupado) throw new ConflictException(`El usuario «${dto.username}» ya existe; elija otro`);
          const passwordTemporal = generarPasswordTemporal();
          const [nuevo] = await em.query(
            `INSERT INTO usuarios (persona_id, username, password_hash, estado_cuenta, fecha_creacion)
             OUTPUT INSERTED.usuario_id AS id
             VALUES (@0, @1, @2, 'ACTIVA', GETDATE())`,
            [dto.personaId, dto.username, await hash(passwordTemporal)],
          );
          destinoId = Number(nuevo.id);
          await this.otorgarRolEncargado(em, destinoId, usuarioId);
          credenciales = { username: dto.username, passwordTemporal };
          rolOtorgado = true;
        } else {
          if (p.estadoCuenta !== 'ACTIVA') {
            throw new UnprocessableEntityException(
              `La cuenta de ${p.nombre} está ${String(p.estadoCuenta).toLowerCase()}. Reactívela en «Usuarios y permisos».`,
            );
          }
          destinoId = p.usuarioId;
          if (!p.habilitado) {
            if (!puedeHabilitar) {
              throw new UnprocessableEntityException('Solo se otorga el rol de encargado a integrantes del grupo');
            }
            await this.otorgarRolEncargado(em, destinoId, usuarioId);
            rolOtorgado = true;
          }
        }
      } else {
        const [candidato] = await em.query(
          `SELECT u.usuario_id AS id, u.estado_cuenta AS estadoCuenta,
                  CASE WHEN EXISTS (${this.sqlTienePermiso('u.usuario_id')}) THEN 1 ELSE 0 END AS habilitado
           FROM usuarios u WHERE u.usuario_id = @1`,
          [PermissionCode.ATTENDANCE_VIEW_GROUP, dto.usuarioId],
        );
        if (!candidato) throw new NotFoundException('Usuario no encontrado');
        if (candidato.estadoCuenta !== 'ACTIVA') {
          throw new UnprocessableEntityException('La cuenta del usuario no está activa');
        }
        if (!candidato.habilitado) {
          throw new UnprocessableEntityException(
            'El usuario no tiene un rol habilitado para encargarse de un grupo (p. ej. «Encargado de grupo»)',
          );
        }
        destinoId = candidato.id;
      }

      const vigente = await em.findOne(GrupoEncargado, { where: { grupoId, estado: 'ACTIVO' } });
      if (vigente?.usuarioId === destinoId) {
        throw new ConflictException('Esa persona ya es el encargado activo del grupo');
      }
      const [otro] = await em.query(
        `SELECT ge.grupo_encargado_id AS id, g.nombre
         FROM grupo_encargados ge JOIN grupos_formacion g ON g.grupo_id = ge.grupo_id
         WHERE ge.usuario_id = @0 AND ge.estado = 'ACTIVO' AND ge.grupo_id <> @1`,
        [destinoId, grupoId],
      );
      if (otro && !dto.reasignar) {
        throw new ConflictException(
          `El usuario ya es encargado de «${otro.nombre}». Confirme la reasignación para moverlo a este grupo.`,
        );
      }
      if (otro) {
        await em.query(
          `UPDATE grupo_encargados
           SET estado = 'FINALIZADO', fecha_fin = GETDATE(), motivo_finalizacion = 'Reasignado a otro grupo'
           WHERE grupo_encargado_id = @0`,
          [otro.id],
        );
      }
      if (vigente) {
        await em.query(
          `UPDATE grupo_encargados
           SET estado = 'FINALIZADO', fecha_fin = GETDATE(), motivo_finalizacion = 'Reasignación de encargado'
           WHERE grupo_encargado_id = @0`,
          [vigente.id],
        );
      }
      await em.query(
        `INSERT INTO grupo_encargados
           (grupo_id, usuario_id, fecha_inicio, fecha_fin, estado, asignado_por_usuario_id,
            motivo_finalizacion, fecha_creacion)
         VALUES (@0, @1, GETDATE(), NULL, 'ACTIVO', @2, NULL, GETDATE())`,
        [grupoId, destinoId, usuarioId],
      );
      await this.auditoria.registrar({
        usuarioId,
        accion: 'MANAGER_ASSIGNED',
        modulo: 'groups',
        entidad: 'grupo_encargados',
        entidadId: grupoId,
        valorAnterior: vigente ? { usuarioId: vigente.usuarioId } : null,
        valorNuevo: { usuarioId: destinoId, reasignadoDesde: otro?.nombre ?? null },
      });
    });

    if (rolOtorgado) {
      // Los permisos se cachean 30 s: el nuevo encargado debe ver «Mi grupo» de inmediato
      this.authz.invalidar(destinoId);
      await this.auditoria.registrar({
        usuarioId,
        accion: credenciales ? 'USER_CREATED' : 'ROLE_GRANTED',
        modulo: 'users',
        entidad: 'usuarios',
        entidadId: destinoId,
        valorNuevo: {
          rol: RoleCode.ENCARGADO_GRUPO,
          motivo: `Designado encargado del grupo ${grupoId}`,
          ...(credenciales ? { username: (credenciales as { username: string }).username } : {}),
        },
      });
    }
    return { credenciales, rolOtorgado };
  }

  /** Otorga solo el rol «Encargado de grupo» (mínimo privilegio para operar su grupo) */
  private async otorgarRolEncargado(em: EntityManager, usuarioDestino: number, asignadoPor: number): Promise<void> {
    const [r] = await em.query(
      `INSERT INTO usuario_roles (usuario_id, rol_id, fecha_inicio, fecha_fin, estado, asignado_por_usuario_id)
       SELECT @0, r.rol_id, CAST(GETDATE() AS date), NULL, 'ACTIVO', @1
       FROM roles r WHERE r.codigo = @2 AND r.estado = 'ACTIVO';
       SELECT @@ROWCOUNT AS n`,
      [usuarioDestino, asignadoPor, RoleCode.ENCARGADO_GRUPO],
    );
    if (!r || Number(r.n) === 0) {
      throw new UnprocessableEntityException('No existe el rol «Encargado de grupo» activo en el sistema');
    }
  }

  async finalizarEncargado(grupoId: number, motivo: string, usuarioId: number): Promise<void> {
    const vigente = await this.encargadoRepo.findOne({ where: { grupoId, estado: 'ACTIVO' } });
    if (!vigente) throw new NotFoundException('El grupo no tiene encargado activo');
    await this.ds.query(
      `UPDATE grupo_encargados
       SET estado = 'FINALIZADO', fecha_fin = GETDATE(), motivo_finalizacion = @1
       WHERE grupo_encargado_id = @0`,
      [vigente.id, motivo],
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'MANAGER_REMOVED',
      modulo: 'groups',
      entidad: 'grupo_encargados',
      entidadId: grupoId,
      valorAnterior: { usuarioId: vigente.usuarioId },
      valorNuevo: { motivo },
    });
  }

  // ================= Integrantes =================

  /**
   * Incorpora una persona al grupo respetando su etapa:
   * - sin etapa activa → abre la etapa del grupo;
   * - misma etapa sin grupo → vincula la etapa a este grupo;
   * - misma etapa en otro grupo → solo con `transferir` (cierra la membresía anterior);
   * - otra etapa → se rechaza (el cambio de etapa es una promoción).
   */
  async agregarIntegrante(
    grupoId: number,
    personaId: number,
    usuarioId: number,
    transferir = false,
  ): Promise<void> {
    const grupo = await this.grupoActivo(grupoId);
    let transferidoDesde: string | null = null;

    await this.ds.transaction(async (em) => {
      const [persona] = await em.query(
        `SELECT persona_id AS id, estado FROM personas WHERE persona_id = @0`,
        [personaId],
      );
      if (!persona || persona.estado !== 'ACTIVO') {
        throw new NotFoundException('Persona no encontrada o inactiva');
      }
      const hoy = await fechaServidor(em);

      const [membresia] = await em.query(
        `SELECT gi.grupo_integrante_id AS id, gi.grupo_id AS grupoId, g.nombre
         FROM grupo_integrantes gi JOIN grupos_formacion g ON g.grupo_id = gi.grupo_id
         WHERE gi.persona_id = @0 AND gi.estado = 'ACTIVO'`,
        [personaId],
      );
      if (membresia?.grupoId === grupoId) {
        throw new ConflictException('La persona ya es integrante activo del grupo');
      }

      const [etapa] = await em.query(
        `SELECT TOP 1 pe.persona_etapa_id AS id, pe.etapa_id AS etapaId, pe.grupo_id AS grupoId,
                e.nombre AS etapa
         FROM persona_etapas pe JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
         WHERE pe.persona_id = @0 AND pe.estado = 'ACTIVO'
         ORDER BY pe.fecha_inicio DESC`,
        [personaId],
      );
      if (etapa && etapa.etapaId !== grupo.etapaId) {
        throw new UnprocessableEntityException(
          `La persona está en la etapa «${etapa.etapa}» y el grupo es de «${grupo.etapa?.nombre}». ` +
            'Para cambiarla de etapa use «Promover» en Personas.',
        );
      }

      if (membresia) {
        if (!transferir) {
          throw new ConflictException(
            `La persona ya integra el grupo «${membresia.nombre}». Confirme la transferencia para moverla.`,
          );
        }
        transferidoDesde = membresia.nombre;
        await em.query(
          `UPDATE grupo_integrantes
           SET estado = 'FINALIZADO', fecha_fin = @1, motivo_salida = @2
           WHERE grupo_integrante_id = @0`,
          [membresia.id, hoy, `Transferencia a ${grupo.nombre}`.slice(0, 300)],
        );
      }

      if (!etapa) {
        await em.query(
          `INSERT INTO persona_etapas
             (persona_id, etapa_id, grupo_id, fecha_inicio, fecha_fin, estado, observacion, registrado_por_usuario_id)
           VALUES (@0, @1, @2, @3, NULL, 'ACTIVO', @4, @5)`,
          [personaId, grupo.etapaId, grupoId, hoy, `Ingreso al grupo ${grupo.nombre}`.slice(0, 500), usuarioId],
        );
      } else if (etapa.grupoId == null) {
        // Ya tenía la etapa (sin grupo): se vincula al grupo; la observación lo deja claro y
        // evita que un «Quitar» posterior le borre una etapa que no nació en este grupo
        await em.query(
          `UPDATE persona_etapas SET grupo_id = @1, observacion = @2 WHERE persona_etapa_id = @0`,
          [etapa.id, grupoId, `Cambio al grupo ${grupo.nombre} (ya tenía la etapa)`.slice(0, 500)],
        );
      } else if (etapa.grupoId !== grupoId) {
        // Misma etapa, otro grupo: se conserva el tramo anterior en el historial
        await em.query(
          `UPDATE persona_etapas SET estado = 'FINALIZADO', fecha_fin = @1, observacion = @2
           WHERE persona_etapa_id = @0`,
          [etapa.id, hoy, `Transferencia a ${grupo.nombre}`.slice(0, 500)],
        );
        await em.query(
          `INSERT INTO persona_etapas
             (persona_id, etapa_id, grupo_id, fecha_inicio, fecha_fin, estado, observacion, registrado_por_usuario_id)
           VALUES (@0, @1, @2, @3, NULL, 'ACTIVO', @4, @5)`,
          [
            personaId,
            grupo.etapaId,
            grupoId,
            hoy,
            (transferidoDesde ? `Transferido desde ${transferidoDesde}` : `Cambio al grupo ${grupo.nombre} (ya tenía la etapa)`).slice(0, 500),
            usuarioId,
          ],
        );
      }

      await em.query(
        `INSERT INTO grupo_integrantes (grupo_id, persona_id, fecha_inicio, estado, creado_por_usuario_id)
         VALUES (@0, @1, @2, 'ACTIVO', @3)`,
        [grupoId, personaId, hoy, usuarioId],
      );
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: transferidoDesde ? 'MEMBER_TRANSFERRED' : 'MEMBER_ADDED',
      modulo: 'groups',
      entidad: 'grupo_integrantes',
      entidadId: `${grupoId}/${personaId}`,
      valorNuevo: transferidoDesde ? { desde: transferidoDesde, hacia: grupo.nombre } : undefined,
    });
  }

  async retirarIntegrante(
    grupoId: number,
    personaId: number,
    dto: RetirarIntegranteDto,
    usuarioId: number,
  ): Promise<{ etapa: 'RETIRADA' | 'SIN_ETAPA' | 'CONSERVA' | null }> {
    const grupo = await this.grupoActivo(grupoId);
    let etapaResultante: 'RETIRADA' | 'SIN_ETAPA' | 'CONSERVA' | null = null;
    await this.ds.transaction(async (em) => {
      const hoy = await fechaServidor(em);
      const actualizadas = await em.query(
        `UPDATE grupo_integrantes
         SET estado = @2, fecha_fin = @3, motivo_salida = @4
         OUTPUT INSERTED.grupo_integrante_id AS id
         WHERE grupo_id = @0 AND persona_id = @1 AND estado = 'ACTIVO'`,
        [grupoId, personaId, dto.tipo === 'RETIRO' ? 'RETIRADO' : 'FINALIZADO', hoy, dto.motivo],
      );
      if (actualizadas.length === 0) {
        throw new NotFoundException('La persona no es integrante activo del grupo');
      }
      if (dto.tipo === 'RETIRO') {
        // Abandona la formación: su etapa vigente también termina
        await em.query(
          `UPDATE persona_etapas SET estado = 'RETIRADO', fecha_fin = @1, observacion = @2
           WHERE persona_id = @0 AND estado = 'ACTIVO'`,
          [personaId, hoy, dto.motivo],
        );
        etapaResultante = 'RETIRADA';
        return;
      }
      // Quitar del grupo: la etapa vigente deja de estar ligada a este grupo, con constancia.
      // Si esa etapa nació al ingresar al grupo («Ingreso al grupo…»: no tenía etapa antes)
      // queda SIN etapa; si ya la tenía (promoción, transferencia), la conserva sin grupo.
      const [etapa] = await em.query(
        `SELECT TOP 1 pe.persona_etapa_id AS id, pe.etapa_id AS etapaId, pe.grupo_id AS grupoId,
                CASE WHEN pe.observacion LIKE 'Ingreso al grupo%' THEN 0 ELSE 1 END AS previas
         FROM persona_etapas pe
         WHERE pe.persona_id = @0 AND pe.estado = 'ACTIVO'
         ORDER BY pe.fecha_inicio DESC, pe.persona_etapa_id DESC`,
        [personaId],
      );
      if (!etapa || etapa.grupoId !== grupoId) return;
      await em.query(
        `UPDATE persona_etapas SET estado = 'FINALIZADO', fecha_fin = @1, observacion = @2
         WHERE persona_etapa_id = @0`,
        [etapa.id, hoy, `Quitado del grupo ${grupo.nombre}: ${dto.motivo}`.slice(0, 500)],
      );
      if (etapa.previas > 0) {
        await em.query(
          `INSERT INTO persona_etapas
             (persona_id, etapa_id, grupo_id, fecha_inicio, fecha_fin, estado, observacion, registrado_por_usuario_id)
           VALUES (@0, @1, NULL, @2, NULL, 'ACTIVO', @3, @4)`,
          [personaId, etapa.etapaId, hoy, `Sin grupo tras salir de ${grupo.nombre}`.slice(0, 500), usuarioId],
        );
        etapaResultante = 'CONSERVA';
      } else {
        etapaResultante = 'SIN_ETAPA';
      }
    });
    await this.auditoria.registrar({
      usuarioId,
      accion: dto.tipo === 'RETIRO' ? 'MEMBER_RETIRED' : 'MEMBER_REMOVED',
      modulo: 'groups',
      entidad: 'grupo_integrantes',
      entidadId: `${grupoId}/${personaId}`,
      valorNuevo: { motivo: dto.motivo, etapa: etapaResultante },
    });
    return { etapa: etapaResultante };
  }

  // ================= Encargado operativo =================

  /** El encargado operativo solo puede operar sobre SU grupo activo */
  async validarEncargadoActivo(usuarioId: number, grupoId: number): Promise<void> {
    const asignacion = await this.encargadoRepo.findOne({
      where: { grupoId, usuarioId, estado: 'ACTIVO' },
    });
    if (!asignacion) {
      throw new ForbiddenException('No tiene asignación activa como encargado de este grupo');
    }
  }

  async esEncargadoActivo(usuarioId: number, grupoId: number): Promise<boolean> {
    const asignacion = await this.encargadoRepo.findOne({
      where: { grupoId, usuarioId, estado: 'ACTIVO' },
    });
    return asignacion !== null;
  }

  async grupoDelEncargado(usuarioId: number): Promise<GrupoFormacion | null> {
    const asignacion = await this.encargadoRepo.findOne({
      where: { usuarioId, estado: 'ACTIVO' },
      relations: { grupo: { etapa: true } },
    });
    return asignacion?.grupo ?? null;
  }

  async integrantes(grupoId: number): Promise<IntegranteView[]> {
    const rows = await this.integranteRepo.find({
      where: { grupoId, estado: 'ACTIVO' },
      relations: { persona: true },
      order: { persona: { apellidoPaterno: 'ASC', nombres: 'ASC' } },
    });
    return rows.map((r) => ({
      id: r.id,
      personaId: r.personaId,
      nombreCompleto: r.persona.nombreCompleto,
      dni: r.persona.dni,
      fechaIngreso: fechaColumna(r.fechaInicio),
      estado: r.estado,
    }));
  }

  // ================= Apoyo =================

  private async grupoActivo(grupoId: number): Promise<GrupoFormacion> {
    const grupo = await this.grupoRepo.findOne({ where: { id: grupoId }, relations: { etapa: true } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    if (grupo.estado !== 'ACTIVO') {
      throw new UnprocessableEntityException(
        `El grupo está ${grupo.estado.toLowerCase()}; no admite cambios`,
      );
    }
    return grupo;
  }

  private async etapaActiva(etapaId: number): Promise<{ id: number; codigo: string }> {
    const [etapa] = await this.ds.query(
      `SELECT etapa_id AS id, codigo FROM etapas_formacion WHERE etapa_id = @0 AND estado = 'ACTIVO'`,
      [etapaId],
    );
    if (!etapa) throw new UnprocessableEntityException('La etapa indicada no existe o está inactiva');
    return etapa;
  }

  private async validarCodigoLibre(codigo: string, excluirId?: number): Promise<void> {
    const [existente] = await this.ds.query(
      `SELECT grupo_id AS id, nombre FROM grupos_formacion
       WHERE compania_id = @0 AND codigo = @1 AND (@2 IS NULL OR grupo_id <> @2)`,
      [COMPANIA_ID, codigo, excluirId ?? null],
    );
    if (existente) {
      throw new ConflictException(`El código ${codigo} ya lo usa el grupo «${existente.nombre}»`);
    }
  }

  private validarFechas(inicio: string, fin: string | null): void {
    if (fin && fin < inicio) {
      throw new UnprocessableEntityException('La fecha de fin no puede ser anterior a la de inicio');
    }
  }

  private validarProgramacionObligatoria(
    etapaCodigo: string,
    horario?: { diaSemana: number; horaInicio: string }[],
  ): void {
    if (!aplicaAsistenciaObligatoria(etapaCodigo)) {
      if (horario && horario.length > 0) {
        throw new UnprocessableEntityException(
          'ESBAS no admite jornadas obligatorias; su participación es voluntaria.',
        );
      }
      return;
    }
    if (horario !== undefined && horario.length === 0) {
      throw new UnprocessableEntityException(
        'Seleccione al menos un día de asistencia obligatoria.',
      );
    }
  }

  private mismoHorario(
    a: { diaSemana: number; horaInicio: string }[],
    b: { diaSemana: number; horaInicio: string }[],
  ): boolean {
    const clave = (lista: { diaSemana: number; horaInicio: string }[]) =>
      [...lista]
        .sort((x, y) => x.diaSemana - y.diaSemana)
        .map((h) => `${h.diaSemana}:${h.horaInicio.slice(0, 5)}`)
        .join('|');
    return clave(a) === clave(b);
  }

  private async actualizarProgramacionObligatoria(
    em: EntityManager,
    grupoId: number,
    horario: { diaSemana: number; horaInicio: string }[],
  ): Promise<void> {
    const [programacion] = await em.query(
      `SELECT TOP 1 programacion_id AS id
       FROM programaciones
       WHERE grupo_id = @0 AND estado = 'ACTIVO'
       ORDER BY programacion_id DESC`,
      [grupoId],
    );
    if (!programacion) throw new NotFoundException('El grupo no tiene una programación activa');

    // El horario nuevo rige desde el día siguiente. Se conservan la jornada de
    // hoy y toda la historia; solo se regeneran jornadas futuras aún vacías.
    await em.query(
      `DELETE FROM jornadas
       WHERE grupo_id = @0
         AND tipo_jornada = 'OBLIGATORIA'
         AND fecha > CAST(GETDATE() AS date)
         AND estado = 'PROGRAMADA'
         AND NOT EXISTS (
           SELECT 1 FROM asistencias a WHERE a.jornada_id = jornadas.jornada_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM asistencia_ubicaciones au WHERE au.jornada_id = jornadas.jornada_id
         )`,
      [grupoId],
    );
    await em.query(
      `UPDATE programacion_detalles
       SET estado = 'INACTIVO'
       WHERE programacion_id = @0 AND tipo_jornada = 'OBLIGATORIA' AND estado = 'ACTIVO'`,
      [programacion.id],
    );
    for (const h of horario) {
      await em.query(
        `INSERT INTO programacion_detalles
           (programacion_id, dia_semana, hora_inicio, hora_fin, tipo_jornada, estado)
         VALUES (@0, @1, @2, NULL, 'OBLIGATORIA', 'ACTIVO')`,
        [programacion.id, h.diaSemana, h.horaInicio],
      );
    }
  }

  private async crearProgramacion(
    em: EntityManager,
    grupoId: number,
    etapaCodigo: string,
    fechaInicio: string,
    fechaFin: string | null,
    usuarioId: number,
    obligatorios?: { diaSemana: number; horaInicio: string }[],
  ): Promise<void> {
    const [programacion] = await em.query(
      `INSERT INTO programaciones (grupo_id, fecha_inicio, fecha_fin, estado, creado_por_usuario_id)
       OUTPUT INSERTED.programacion_id AS id
       VALUES (@0, @1, @2, 'ACTIVO', @3)`,
      [grupoId, fechaInicio, fechaFin, usuarioId],
    );
    // INSERT directo: el driver transforma mal las cadenas TIME con repository.save()
    for (const h of horarioReglamentario(etapaCodigo, obligatorios)) {
      await em.query(
        `INSERT INTO programacion_detalles
           (programacion_id, dia_semana, hora_inicio, hora_fin, tipo_jornada, estado)
         VALUES (@0, @1, @2, @3, @4, 'ACTIVO')`,
        [programacion.id, h.dia, h.inicio, h.fin, h.tipo],
      );
    }
  }

  /** Subconsulta: el usuario (expresión SQL) tiene el permiso @0 por algún rol vigente */
  private sqlTienePermiso(usuarioExpr: string): string {
    return `SELECT 1 FROM usuario_roles ur
            JOIN roles r ON r.rol_id = ur.rol_id AND r.estado = 'ACTIVO'
            JOIN rol_permisos rp ON rp.rol_id = r.rol_id
            JOIN permisos pm ON pm.permiso_id = rp.permiso_id AND pm.estado = 'ACTIVO'
            WHERE ur.usuario_id = ${usuarioExpr} AND ur.estado = 'ACTIVO'
              AND (ur.fecha_fin IS NULL OR ur.fecha_fin >= CAST(GETDATE() AS date))
              AND pm.codigo = @0`;
  }

  private toView(r: any): GrupoEtapaView {
    return {
      id: r.id,
      codigo: r.codigo,
      nombre: r.nombre,
      periodo: r.periodo,
      etapaId: r.etapaId,
      etapa: r.etapa ?? '',
      etapaCodigo: r.etapaCodigo ?? '',
      estado: r.estado,
      fechaInicio: fechaColumna(r.fechaInicio),
      fechaFin: r.fechaFin ? fechaColumna(r.fechaFin) : null,
      totalIntegrantes: r.totalIntegrantes ?? 0,
      encargado: r.encUsuarioId
        ? { usuarioId: r.encUsuarioId, nombre: r.encNombre, desde: r.encDesde }
        : null,
    };
  }
}
