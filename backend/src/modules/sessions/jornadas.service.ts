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
import { JornadaView } from './views/jornada.view';
import { CreateJornadaDto } from './dto/jornada.dto';
import { PermissionCode } from '../../common/constants/permissions.constants';

@Injectable()
export class JornadasService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    private readonly groups: GroupsService,
    private readonly authz: AuthzService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Jornadas del día. Quien no tiene vista global solo ve
   * las jornadas de los grupos que encabeza actualmente.
   */
  async listarPorFecha(fecha: string, usuarioId: number): Promise<JornadaView[]> {
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
    const jornada = await this.jornadaRepo.save(
      this.jornadaRepo.create({
        grupoId: dto.grupoId,
        fecha: dto.fecha,
        tipoJornada: dto.tipoJornada,
        origen: dto.origen ?? 'PROGRAMADA',
        // Se envia como cadena ISO: el driver la convierte sin desfase horario
        inicioProgramada: dto.horaInicio ? (`${dto.fecha}T${dto.horaInicio}:00` as unknown as Date) : null,
        finProgramada: dto.horaFin ? (`${dto.fecha}T${dto.horaFin}:00` as unknown as Date) : null,
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
      valorNuevo: dto,
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
}
