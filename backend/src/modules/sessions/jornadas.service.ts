import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jornada } from './entities/jornada.entity';
import { GroupsService } from '../groups/groups.service';
import { AuditoriaService } from '../audit/auditoria.service';
import { AuthzService } from '../roles/authz.service';
import { JornadaView } from './views/jornada.view';
import { CreateJornadaDto } from './dto/jornada.dto';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { Programacion, ProgramacionDetalle } from './entities/programacion.entity';
import { resolverReglaAsistencia } from '../../common/domain/attendance-rule';

@Injectable()
export class JornadasService implements OnModuleInit, OnModuleDestroy {
  private cicloTimer?: NodeJS.Timeout;
  private sincronizando = false;

  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    @InjectRepository(Programacion)
    private readonly programacionRepo: Repository<Programacion>,
    @InjectRepository(ProgramacionDetalle)
    private readonly detalleRepo: Repository<ProgramacionDetalle>,
    private readonly groups: GroupsService,
    private readonly authz: AuthzService,
    private readonly auditoria: AuditoriaService,
  ) {}

  onModuleInit(): void {
    void this.sincronizarCicloAutomatico();
    this.cicloTimer = setInterval(() => void this.sincronizarCicloAutomatico(), 60_000);
    this.cicloTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cicloTimer) clearInterval(this.cicloTimer);
  }

  /**
   * Jornadas del día. Quien no tiene vista global solo ve
   * las jornadas de los grupos que encabeza actualmente.
   */
  async listarPorFecha(fecha: string, usuarioId: number): Promise<JornadaView[]> {
    await this.asegurarJornadasProgramadas(fecha);
    await this.sincronizarCicloAutomatico();
    const vistaGlobal = await this.authz.tienePermiso(usuarioId, PermissionCode.ATTENDANCE_VIEW_ALL);
    let jornadas: Jornada[];

    if (vistaGlobal) {
      jornadas = await this.jornadaRepo.find({
        where: { fecha },
        relations: { grupo: { etapa: true } },
        order: { inicioProgramada: 'ASC' },
      });
    } else {
      const rows = await this.jornadaRepo.query(
        `SELECT j.jornada_id AS id, j.grupo_id AS grupoId, g.nombre AS grupo, e.nombre AS etapa,
                j.fecha, j.fecha_hora_inicio_programada AS inicioProgramada,
                j.fecha_hora_fin_programada AS finProgramada, j.tipo_jornada AS tipoJornada,
                j.origen, j.estado, j.fecha_apertura AS fechaApertura, j.fecha_cierre AS fechaCierre
         FROM jornadas j
         JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
         JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
         JOIN grupo_encargados ge ON ge.grupo_id = j.grupo_id AND ge.estado = 'ACTIVO'
         WHERE j.fecha = @0 AND ge.usuario_id = @1
         ORDER BY j.fecha_hora_inicio_programada`,
        [fecha, usuarioId],
      );
      return rows.map((r: any) => ({
        id: r.id,
        grupoId: r.grupoId,
        grupo: r.grupo,
        etapa: r.etapa,
        fecha: r.fecha,
        tipoJornada: r.tipoJornada,
        origen: r.origen,
        estado: r.estado,
        inicioProgramada: r.inicioProgramada,
        finProgramada: r.finProgramada,
        fechaApertura: r.fechaApertura,
        fechaCierre: r.fechaCierre,
      }));
    }
    return jornadas.map((j) => this.toView(j));
  }

  async crear(dto: CreateJornadaDto, usuarioId: number): Promise<JornadaView> {
    const resolucion = await this.resolverProgramacion(dto.grupoId, dto.fecha);
    const duplicada = await this.jornadaRepo.findOne({
      where: {
        grupoId: dto.grupoId,
        fecha: dto.fecha,
        tipoJornada: resolucion.regla.tipoJornada,
      },
    });
    if (duplicada) {
      throw new ConflictException('Ya existe una jornada de ese tipo para el grupo en esa fecha');
    }
    const jornada = await this.jornadaRepo.save(
      this.jornadaRepo.create({
        grupoId: dto.grupoId,
        fecha: dto.fecha,
        programacionDetalleId: resolucion.detalle?.id ?? null,
        tipoJornada: resolucion.regla.tipoJornada,
        origen: dto.origen ?? 'PROGRAMADA',
        // Se envia como cadena ISO: el driver la convierte sin desfase horario
        inicioProgramada: this.fechaHora(dto.fecha, resolucion.regla.horaIngreso ?? dto.horaInicio ?? resolucion.detalle?.horaInicio),
        finProgramada: this.fechaHora(dto.fecha, dto.horaFin ?? resolucion.detalle?.horaFin),
        titulo: dto.titulo ?? null,
        observacion: dto.observacion ?? null,
        estado: 'PROGRAMADA',
      }),
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'SESSION_CREATED',
      modulo: 'sessions',
      entidad: 'jornadas',
      entidadId: jornada.id,
      valorNuevo: { ...dto, tipoJornada: resolucion.regla.tipoJornada, horaIngreso: resolucion.regla.horaIngreso },
    });
    const completa = await this.jornadaRepo.findOneOrFail({
      where: { id: jornada.id },
      relations: { grupo: { etapa: true } },
    });
    return this.toView(completa);
  }

  async abrir(jornadaId: number, usuarioId: number): Promise<JornadaView> {
    const jornada = await this.obtenerOperable(jornadaId, usuarioId);
    if (jornada.estado !== 'PROGRAMADA') {
      throw new UnprocessableEntityException(`La jornada está en estado ${jornada.estado}, no se puede abrir`);
    }
    if (jornada.tipoJornada === 'OBLIGATORIA') {
      throw new UnprocessableEntityException('Las jornadas obligatorias se abren automáticamente en su hora reglamentaria');
    }
    await this.jornadaRepo.query(
      `UPDATE jornadas
       SET estado = 'ABIERTA', fecha_apertura = GETDATE(), abierta_por_usuario_id = @1
       WHERE jornada_id = @0`,
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
      fecha: j.fecha,
      tipoJornada: j.tipoJornada,
      origen: j.origen,
      estado: j.estado,
      inicioProgramada: j.inicioProgramada,
      finProgramada: j.finProgramada,
      fechaApertura: j.fechaApertura,
      fechaCierre: j.fechaCierre,
    };
  }

  private async asegurarJornadasProgramadas(fecha: string): Promise<void> {
    const programaciones: Array<{ programacionId: number; grupoId: number; etapaCodigo: string }> =
      await this.programacionRepo.query(
        `SELECT p.programacion_id AS programacionId, p.grupo_id AS grupoId, e.codigo AS etapaCodigo
         FROM programaciones p
         JOIN grupos_formacion g ON g.grupo_id = p.grupo_id AND g.estado = 'ACTIVO'
         JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
         WHERE p.estado = 'ACTIVO' AND p.fecha_inicio <= @0
           AND (p.fecha_fin IS NULL OR p.fecha_fin >= @0)
           AND g.fecha_inicio <= @0 AND (g.fecha_fin IS NULL OR g.fecha_fin >= @0)`,
        [fecha],
      );

    for (const programacion of programaciones) {
      const regla = resolverReglaAsistencia(programacion.etapaCodigo, fecha);
      const detalle = await this.detalleRepo.findOne({
        where: { programacionId: programacion.programacionId, diaSemana: regla.diaSemana, estado: 'ACTIVO' },
      });

      // Todos los grupos pueden registrar participacion voluntaria durante todo el dia.
      await this.crearSiNoExiste({
        grupoId: programacion.grupoId,
        fecha,
        tipoJornada: 'VOLUNTARIA',
        inicioProgramada: this.fechaHora(fecha, '00:00'),
        finProgramada: this.fechaHora(fecha, '23:59'),
        programacionDetalleId: null,
      });

      // Postulantes y Aspirantes de compania tienen ademas su bloque obligatorio.
      if (regla.tipoJornada === 'OBLIGATORIA') {
        await this.crearSiNoExiste({
          grupoId: programacion.grupoId,
          fecha,
          tipoJornada: 'OBLIGATORIA',
          inicioProgramada: this.fechaHora(fecha, regla.horaIngreso),
          finProgramada: this.fechaHora(fecha, detalle?.horaFin),
          programacionDetalleId: detalle?.id ?? null,
        });
      }
    }
  }

  private async resolverProgramacion(grupoId: number, fecha: string) {
    const [programacion] = await this.programacionRepo.query(
      `SELECT TOP 1 p.programacion_id AS programacionId, e.codigo AS etapaCodigo
       FROM programaciones p
       JOIN grupos_formacion g ON g.grupo_id = p.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE p.grupo_id = @0 AND p.estado = 'ACTIVO' AND p.fecha_inicio <= @1
         AND (p.fecha_fin IS NULL OR p.fecha_fin >= @1)
       ORDER BY p.fecha_inicio DESC`,
      [grupoId, fecha],
    );
    if (!programacion) throw new UnprocessableEntityException('El grupo no tiene una programacion vigente para la fecha');
    const regla = resolverReglaAsistencia(programacion.etapaCodigo, fecha);
    const detalle = await this.detalleRepo.findOne({
      where: { programacionId: programacion.programacionId, diaSemana: regla.diaSemana, estado: 'ACTIVO' },
    });
    return { regla, detalle };
  }

  private async crearSiNoExiste(data: {
    grupoId: number;
    fecha: string;
    tipoJornada: string;
    inicioProgramada: Date | null;
    finProgramada: Date | null;
    programacionDetalleId: number | null;
  }): Promise<void> {
    const existe = await this.jornadaRepo.findOne({
      where: { grupoId: data.grupoId, fecha: data.fecha, tipoJornada: data.tipoJornada },
    });
    if (existe) return;
    await this.jornadaRepo.save(this.jornadaRepo.create({
      ...data,
      origen: 'PROGRAMADA',
      estado: 'PROGRAMADA',
    }));
  }

  private fechaHora(fecha: string, hora?: string | null): Date | null {
    if (!hora) return null;
    return `${fecha}T${hora.slice(0, 5)}:00` as unknown as Date;
  }

  /** Abre por horario y cierra al cambiar el día, siempre con hora de Lima. */
  private async sincronizarCicloAutomatico(): Promise<void> {
    if (this.sincronizando) return;
    this.sincronizando = true;
    try {
      const ahora = this.ahoraLima();
      await this.asegurarJornadasProgramadas(ahora.fecha);

      const abiertas: Array<{ id: number }> = await this.jornadaRepo.query(
        `UPDATE jornadas
         SET estado = 'ABIERTA',
             fecha_apertura = CASE WHEN fecha_apertura IS NULL THEN GETDATE() ELSE fecha_apertura END,
             fecha_cierre = NULL, cerrada_por_usuario_id = NULL,
             abierta_por_usuario_id = NULL
         OUTPUT INSERTED.jornada_id AS id
         WHERE fecha = @0
           AND ((tipo_jornada = 'VOLUNTARIA' AND estado IN ('PROGRAMADA','CERRADA')) OR
             (tipo_jornada = 'OBLIGATORIA' AND estado = 'PROGRAMADA'
              AND fecha_hora_inicio_programada IS NOT NULL
              AND CONVERT(varchar(5), fecha_hora_inicio_programada, 108) <= @1))`,
        [ahora.fecha, ahora.hora],
      );
      for (const jornada of abiertas) {
        await this.auditoria.registrar({
          accion: 'SESSION_AUTO_OPENED',
          modulo: 'sessions',
          entidad: 'jornadas',
          entidadId: jornada.id,
          valorNuevo: { estado: 'ABIERTA', zonaHoraria: 'America/Lima' },
        });
      }

      const vencidas: Array<{ id: number; tipoJornada: string }> = await this.jornadaRepo.query(
        `SELECT j.jornada_id AS id,
           CASE WHEN j.tipo_jornada = 'OBLIGATORIA'
                  AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
                  AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5)
                THEN 'OBLIGATORIA' ELSE 'VOLUNTARIA' END AS tipoJornada
         FROM jornadas j
         JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
         JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
         WHERE j.fecha < @0 AND j.estado IN ('PROGRAMADA','ABIERTA')`,
        [ahora.fecha],
      );
      for (const jornada of vencidas) {
        await this.cerrarAutomaticamente(jornada.id, jornada.tipoJornada === 'OBLIGATORIA');
      }
    } catch (error) {
      console.error('No se pudo sincronizar el ciclo automático de jornadas:', (error as Error).message);
    } finally {
      this.sincronizando = false;
    }
  }

  private async cerrarAutomaticamente(jornadaId: number, convertirFaltas: boolean): Promise<void> {
    await this.jornadaRepo.manager.transaction(async (em) => {
      if (convertirFaltas) {
        await em.query(
          `INSERT INTO asistencias
             (jornada_id, persona_id, estado_asistencia, tipo_registro, observacion,
              registrado_por_usuario_id)
           SELECT j.jornada_id, gi.persona_id, 'FALTA_INJUSTIFICADA', 'AUTOMATICO',
                  'Generada automáticamente al finalizar el día',
                   COALESCE(j.abierta_por_usuario_id,
                     (SELECT TOP 1 u.usuario_id FROM usuarios u WHERE u.estado_cuenta = 'ACTIVA' ORDER BY u.usuario_id))
            FROM jornadas j
            JOIN grupo_integrantes gi ON gi.grupo_id = j.grupo_id AND gi.estado = 'ACTIVO'
              AND gi.fecha_inicio <= j.fecha AND (gi.fecha_fin IS NULL OR gi.fecha_fin >= j.fecha)
           WHERE j.jornada_id = @0
             AND NOT EXISTS (
               SELECT 1 FROM asistencias a WHERE a.jornada_id = j.jornada_id
                 AND a.persona_id = gi.persona_id AND a.estado_asistencia <> 'ANULADO'
             )`,
          [jornadaId],
        );
      }
      await em.query(
        `UPDATE jornadas SET estado = 'CERRADA', fecha_cierre = GETDATE(), cerrada_por_usuario_id = NULL
         WHERE jornada_id = @0 AND estado IN ('PROGRAMADA','ABIERTA')`,
        [jornadaId],
      );
    });
    await this.auditoria.registrar({
      accion: 'SESSION_AUTO_CLOSED',
      modulo: 'sessions',
      entidad: 'jornadas',
      entidadId: jornadaId,
      valorNuevo: { estado: 'CERRADA', faltasAutomaticas: convertirFaltas, zonaHoraria: 'America/Lima' },
    });
  }

  private ahoraLima(): { fecha: string; hora: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return {
      fecha: `${value('year')}-${value('month')}-${value('day')}`,
      hora: `${value('hour')}:${value('minute')}`,
    };
  }
}
