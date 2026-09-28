import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jornada } from './entities/jornada.entity';
import { GroupsService } from '../groups/groups.service';
import { AuditoriaService } from '../audit/auditoria.service';
import { AuthzService } from '../roles/authz.service';
import { RealtimeService } from '../realtime/realtime.service';
import { JornadaView } from './views/jornada.view';
import { CreateJornadaDto } from './dto/jornada.dto';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { fechaColumna, fechaServidor } from '../../common/utils/fecha.util';
import { validarTipoJornada } from '../../common/business/reglas-asistencia';

/** HH:mm de un datetime2 leído como hora local */
function horaDe(valor: Date | string | null): string | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

@Injectable()
export class JornadasService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    private readonly groups: GroupsService,
    private readonly authz: AuthzService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Fecha de negocio de hoy (reloj de SQL Server, no UTC) */
  fechaHoy(): Promise<string> {
    return fechaServidor(this.jornadaRepo.manager);
  }

  /**
   * Jornadas del día. Quien no tiene vista global solo ve
   * las jornadas de los grupos que encabeza actualmente.
   */
  async listarPorFecha(fecha: string, usuarioId: number): Promise<JornadaView[]> {
    await this.asegurarJornadasProgramadas(fecha);
    const vistaGlobal = await this.authz.tienePermiso(usuarioId, PermissionCode.ATTENDANCE_VIEW_ALL);

    if (vistaGlobal) {
      const jornadas = await this.jornadaRepo.find({
        where: { fecha },
        relations: { grupo: { etapa: true } },
        order: { inicioProgramada: 'ASC' },
      });
      return jornadas.map((j) => this.toView(j));
    }

    const rows = await this.jornadaRepo.query(
      `SELECT j.jornada_id AS id, j.grupo_id AS grupoId, g.nombre AS grupo, e.nombre AS etapa,
              j.fecha, j.fecha_hora_inicio_programada AS inicioProgramada,
              j.fecha_hora_fin_programada AS finProgramada, j.tipo_jornada AS tipoJornada,
              j.origen, j.estado, j.fecha_apertura AS fechaApertura, j.fecha_cierre AS fechaCierre
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE j.fecha = @0
         AND EXISTS (SELECT 1 FROM grupo_encargados ge
                     WHERE ge.grupo_id = j.grupo_id AND ge.estado = 'ACTIVO' AND ge.usuario_id = @1)
       ORDER BY j.fecha_hora_inicio_programada`,
      [fecha, usuarioId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      grupoId: r.grupoId,
      grupo: r.grupo,
      etapa: r.etapa,
      fecha: fechaColumna(r.fecha),
      tipoJornada: r.tipoJornada,
      origen: r.origen,
      estado: r.estado,
      inicioProgramada: r.inicioProgramada,
      finProgramada: r.finProgramada,
      horaInicio: horaDe(r.inicioProgramada),
      horaFin: horaDe(r.finProgramada),
      fechaApertura: r.fechaApertura,
      fechaCierre: r.fechaCierre,
    }));
  }

  /**
   * Materializa las jornadas que corresponden a la programación en la fecha
   * consultada. Permite que una voluntaria y una obligatoria coexistan el
   * mismo día como contextos independientes.
   */
  private async asegurarJornadasProgramadas(fecha: string): Promise<void> {
    // El cierre diario es automático. En jornadas obligatorias, quienes no
    // registraron asistencia pasan a falta injustificada al terminar el día.
    await this.jornadaRepo.query(
      `UPDATE a
       SET a.estado_asistencia = 'FALTA_INJUSTIFICADA',
           a.tipo_registro = 'AUTOMATICO',
           a.fecha_hora_entrada = NULL,
           a.fecha_hora_salida = NULL,
           a.observacion = 'Falta generada automáticamente al cierre del día',
           a.anulado_por_usuario_id = NULL,
           a.fecha_anulacion = NULL,
           a.motivo_anulacion = NULL,
           a.fecha_actualizacion = GETDATE()
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       WHERE j.fecha < CAST(GETDATE() AS date)
         AND j.tipo_jornada = 'OBLIGATORIA'
         AND j.estado IN ('ABIERTA', 'PROGRAMADA')
         AND a.estado_asistencia = 'ANULADO'`,
    );

    await this.jornadaRepo.query(
      `INSERT INTO asistencias
         (jornada_id, persona_id, estado_asistencia, tipo_registro,
          observacion, registrado_por_usuario_id)
       SELECT j.jornada_id, gi.persona_id, 'FALTA_INJUSTIFICADA', 'AUTOMATICO',
              'Falta generada automáticamente al cierre del día',
              COALESCE(j.abierta_por_usuario_id, g.creado_por_usuario_id,
                (SELECT TOP 1 u.usuario_id
                 FROM usuarios u
                 JOIN usuario_roles ur ON ur.usuario_id = u.usuario_id AND ur.estado = 'ACTIVO'
                 JOIN roles r ON r.rol_id = ur.rol_id AND r.codigo = 'ADMIN_SISTEMA'
                 WHERE u.estado_cuenta = 'ACTIVA'
                 ORDER BY u.usuario_id))
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       JOIN grupo_integrantes gi ON gi.grupo_id = j.grupo_id
       JOIN personas p ON p.persona_id = gi.persona_id
       WHERE j.fecha < CAST(GETDATE() AS date)
         AND j.tipo_jornada = 'OBLIGATORIA'
         AND j.estado IN ('ABIERTA', 'PROGRAMADA')
         AND e.codigo IN ('POSTULANTE', 'ASPIRANTE_COMPANIA')
         AND p.estado = 'ACTIVO'
         AND gi.fecha_inicio <= j.fecha
         AND (gi.fecha_fin IS NULL OR gi.fecha_fin >= j.fecha)
         AND NOT EXISTS (
           SELECT 1 FROM asistencias a
           WHERE a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
         )`,
    );

    // Ninguna entrada queda abierta después de medianoche. El nuevo día usa una
    // jornada distinta y la salida anterior se limita al último segundo del día.
    await this.jornadaRepo.query(
      `UPDATE a
       SET a.fecha_hora_salida = DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(j.fecha AS datetime2))),
           a.estado_asistencia = 'FINALIZADO',
           a.observacion = ISNULL(a.observacion, 'Salida automática por cierre del día'),
           a.fecha_actualizacion = GETDATE()
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       WHERE a.estado_asistencia = 'PRESENTE'
         AND j.fecha < CAST(GETDATE() AS date)
         AND a.fecha_hora_entrada < DATEADD(DAY, 1, CAST(j.fecha AS datetime2))`,
    );

    await this.jornadaRepo.query(
      `UPDATE jornadas
       SET estado = 'CERRADA',
           fecha_cierre = ISNULL(
             fecha_cierre,
             DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(fecha AS datetime2)))
           )
       WHERE fecha < CAST(GETDATE() AS date)
         AND estado IN ('ABIERTA', 'PROGRAMADA')`,
    );

    await this.jornadaRepo.query(
      `INSERT INTO jornadas
         (grupo_id, programacion_detalle_id, fecha, fecha_hora_inicio_programada,
          fecha_hora_fin_programada, tipo_jornada, origen, estado, fecha_creacion)
       SELECT pr.grupo_id, pd.programacion_detalle_id, CAST(@0 AS date),
              CASE WHEN pd.hora_inicio IS NULL THEN NULL
                   ELSE DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00' AS time), pd.hora_inicio), CAST(@0 AS datetime2)) END,
              CASE WHEN pd.tipo_jornada = 'OBLIGATORIA' OR pd.hora_fin IS NULL THEN NULL
                   ELSE DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00' AS time), pd.hora_fin), CAST(@0 AS datetime2)) END,
              pd.tipo_jornada, 'PROGRAMADA',
              CASE WHEN CAST(@0 AS date) <= CAST(GETDATE() AS date) THEN 'ABIERTA' ELSE 'PROGRAMADA' END,
              GETDATE()
       FROM programaciones pr
       JOIN programacion_detalles pd ON pd.programacion_id = pr.programacion_id
       JOIN grupos_formacion g ON g.grupo_id = pr.grupo_id
       WHERE pr.estado = 'ACTIVO' AND pd.estado = 'ACTIVO' AND g.estado = 'ACTIVO'
         AND CAST(@0 AS date) >= pr.fecha_inicio
         AND (pr.fecha_fin IS NULL OR CAST(@0 AS date) <= pr.fecha_fin)
         AND pd.dia_semana = ((DATEDIFF(DAY, '19000101', CAST(@0 AS date)) % 7) + 1)
         AND NOT EXISTS (
           SELECT 1 FROM jornadas j
           WHERE j.grupo_id = pr.grupo_id AND j.fecha = CAST(@0 AS date)
             AND j.tipo_jornada = pd.tipo_jornada
         )`,
      [fecha],
    );

    // Apertura automática si la fecha es hoy o anterior: el encargado no necesita abrirla manualmente
    await this.jornadaRepo.query(
      `UPDATE jornadas
       SET estado = 'ABIERTA', fecha_apertura = ISNULL(fecha_apertura, GETDATE())
       WHERE fecha = CAST(@0 AS date)
         AND CAST(@0 AS date) <= CAST(GETDATE() AS date)
         AND estado = 'PROGRAMADA'`,
      [fecha],
    );
  }

  async crear(dto: CreateJornadaDto, usuarioId: number): Promise<JornadaView> {
    if (dto.tipoJornada !== 'OBLIGATORIA' && dto.horaInicio && dto.horaFin && dto.horaFin <= dto.horaInicio) {
      throw new UnprocessableEntityException('La hora de fin debe ser posterior a la hora de inicio');
    }
    const [grupo] = await this.jornadaRepo.query(
      `SELECT e.codigo AS etapaCodigo
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE g.grupo_id = @0`,
      [dto.grupoId],
    );
    if (!grupo) throw new NotFoundException('Grupo no encontrado');
    validarTipoJornada(grupo.etapaCodigo, dto.fecha, dto.tipoJornada, dto.horaInicio);

    const duplicada = await this.jornadaRepo.findOne({
      where: {
        grupoId: dto.grupoId,
        fecha: dto.fecha,
        tipoJornada: dto.tipoJornada,
      },
    });
    if (duplicada) {
      throw new ConflictException('Ya existe una jornada de ese tipo para el grupo en esa fecha');
    }
    // INSERT directo con cadenas ISO: repository.save() convierte la cadena a Date
    // y el driver la guarda desplazada +5 h (19:00 → 00:00 del día siguiente).
    const [insertada]: { id: number }[] = await this.jornadaRepo.query(
      `INSERT INTO jornadas
         (grupo_id, fecha, fecha_hora_inicio_programada, fecha_hora_fin_programada,
          tipo_jornada, origen, titulo, observacion, estado, fecha_creacion)
       OUTPUT INSERTED.jornada_id AS id
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7, 'PROGRAMADA', GETDATE())`,
      [
        dto.grupoId,
        dto.fecha,
        dto.horaInicio ? `${dto.fecha}T${dto.horaInicio}:00` : null,
        dto.tipoJornada === 'OBLIGATORIA'
          ? null
          : dto.horaFin ? `${dto.fecha}T${dto.horaFin}:00` : null,
        dto.tipoJornada,
        dto.origen ?? 'PROGRAMADA',
        dto.titulo ?? null,
        dto.observacion ?? null,
      ],
    );
    const jornadaId = Number(insertada.id);
    await this.auditoria.registrar({
      usuarioId,
      accion: 'SESSION_CREATED',
      modulo: 'sessions',
      entidad: 'jornadas',
      entidadId: jornadaId,
      valorNuevo: dto,
    });
    return this.recargar(jornadaId);
  }

  /** Solo se abren jornadas PROGRAMADAS de hoy o de días anteriores (nunca futuras). */
  async abrir(jornadaId: number, usuarioId: number): Promise<JornadaView> {
    const jornada = await this.obtenerOperable(jornadaId, usuarioId);
    if (jornada.estado !== 'PROGRAMADA') {
      throw new UnprocessableEntityException(`La jornada está en estado ${jornada.estado}, no se puede abrir`);
    }
    const hoy = await this.fechaHoy();
    if (fechaColumna(jornada.fecha) > hoy) {
      throw new UnprocessableEntityException('No se puede abrir una jornada de una fecha futura');
    }
    const [grupo] = await this.jornadaRepo.query(
      `SELECT e.codigo AS etapaCodigo,
              CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS horaInicio
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE j.jornada_id = @0`,
      [jornadaId],
    );
    validarTipoJornada(
      grupo.etapaCodigo,
      fechaColumna(jornada.fecha),
      jornada.tipoJornada,
      grupo.horaInicio,
    );
    await this.jornadaRepo.query(
      `UPDATE jornadas
       SET estado = 'ABIERTA', fecha_apertura = GETDATE(), abierta_por_usuario_id = @1
       WHERE jornada_id = @0 AND estado = 'PROGRAMADA'`,
      [jornadaId, usuarioId],
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'SESSION_OPENED',
      modulo: 'sessions',
      entidad: 'jornadas',
      entidadId: jornadaId,
      valorNuevo: { estado: 'ABIERTA' },
    });
    this.realtime.emitirJornada('jornada.abierta', {
      jornadaId: Number(jornadaId),
      grupoId: jornada.grupoId,
      tipoJornada: jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
    });
    return this.recargar(jornadaId);
  }

  /** Quien tiene vista global opera cualquier grupo; si no, debe ser encargado activo */
  private async obtenerOperable(jornadaId: number, usuarioId: number): Promise<Jornada> {
    const jornada = await this.jornadaRepo.findOne({ where: { id: jornadaId } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    const tieneVistaGlobal = await this.authz.tienePermiso(usuarioId, PermissionCode.ATTENDANCE_VIEW_ALL);
    if (!tieneVistaGlobal) {
      await this.groups.validarEncargadoActivo(usuarioId, jornada.grupoId);
    }
    return jornada;
  }

  private async recargar(jornadaId: number): Promise<JornadaView> {
    const j = await this.jornadaRepo.findOneOrFail({
      where: { id: jornadaId },
      relations: { grupo: { etapa: true } },
    });
    return this.toView(j);
  }

  private toView(j: Jornada): JornadaView {
    return {
      id: j.id,
      grupoId: j.grupoId,
      grupo: j.grupo?.nombre ?? '',
      etapa: j.grupo?.etapa?.nombre ?? '',
      fecha: fechaColumna(j.fecha),
      tipoJornada: j.tipoJornada,
      origen: j.origen,
      estado: j.estado,
      inicioProgramada: j.inicioProgramada,
      finProgramada: j.finProgramada,
      horaInicio: horaDe(j.inicioProgramada),
      horaFin: horaDe(j.finProgramada),
      fechaApertura: j.fechaApertura,
      fechaCierre: j.fechaCierre,
    };
  }
}
