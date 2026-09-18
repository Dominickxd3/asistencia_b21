import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { GrupoFormacion } from './entities/grupo-formacion.entity';
import { GrupoEncargado } from './entities/grupo-encargado.entity';
import { GrupoIntegrante } from './entities/grupo-integrante.entity';
import { GrupoEtapaView } from './views/grupo.view';
import { CreateGroupDto, AssignManagerDto } from './dto/group.dto';
import { AuditoriaService } from '../audit/auditoria.service';

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
  ) {}

  async listar(): Promise<GrupoEtapaView[]> {
    const grupos = await this.grupoRepo.find({
      relations: { etapa: true },
      order: { estado: 'ASC', fechaInicio: 'DESC' },
    });
    const resultado: GrupoEtapaView[] = [];
    for (const g of grupos) {
      const total = await this.integranteRepo.count({
        where: { grupoId: g.id, estado: 'ACTIVO' },
      });
      const encargado = await this.encargadoRepo.findOne({
        where: { grupoId: g.id, estado: 'ACTIVO' },
        relations: { usuario: { persona: true } },
      });
      resultado.push({
        ...this.toView(g, total),
        encargado: encargado
          ? {
              usuarioId: encargado.usuarioId,
              nombre: encargado.usuario.persona.nombreCompleto,
              desde: encargado.fechaInicio,
            }
          : null,
      });
    }
    return resultado;
  }

  async crear(dto: CreateGroupDto, usuarioId: number): Promise<GrupoFormacion> {
    const existente = await this.grupoRepo.findOne({ where: { codigo: dto.codigo } });
    if (existente) {
      throw new ConflictException(`Ya existe un grupo con código ${dto.codigo}`);
    }
    const grupo = await this.grupoRepo.save(
      this.grupoRepo.create({
        ...dto,
        companiaId: 1,
        estado: 'ACTIVO',
        creadoPorUsuarioId: usuarioId,
      }),
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'GROUP_CREATED',
      modulo: 'groups',
      entidad: 'grupos_formacion',
      entidadId: grupo.id,
      valorNuevo: dto,
    });
    return grupo;
  }

  /** Asigna encargado: finaliza la asignacion vigente y crea la nueva. */
  async asignarEncargado(grupoId: number, dto: AssignManagerDto, usuarioId: number): Promise<void> {
    await this.ds.transaction(async (em) => {
      const grupo = await em.findOne(GrupoFormacion, { where: { id: grupoId } });
      if (!grupo || grupo.estado !== 'ACTIVO') {
        throw new NotFoundException('Grupo no encontrado o no está activo');
      }
      const vigente = await em.findOne(GrupoEncargado, {
        where: { grupoId, estado: 'ACTIVO' },
      });
      if (vigente?.usuarioId === dto.usuarioId) {
        throw new ConflictException('Ese usuario ya es el encargado activo del grupo');
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
        [grupoId, dto.usuarioId, usuarioId],
      );
      await this.auditoria.registrar({
        usuarioId,
        accion: 'MANAGER_ASSIGNED',
        modulo: 'groups',
        entidad: 'grupo_encargados',
        entidadId: grupoId,
        valorAnterior: vigente ? { usuarioId: vigente.usuarioId } : null,
        valorNuevo: { usuarioId: dto.usuarioId },
      });
    });
  }

  async agregarIntegrante(grupoId: number, personaId: number, usuarioId: number): Promise<void> {
    const grupo = await this.grupoRepo.findOne({ where: { id: grupoId, estado: 'ACTIVO' } });
    if (!grupo) throw new NotFoundException('Grupo no encontrado o no está activo');
    const duplicado = await this.integranteRepo.findOne({
      where: { grupoId, personaId, estado: 'ACTIVO' },
    });
    if (duplicado) throw new ConflictException('La persona ya es integrante activo del grupo');
    await this.integranteRepo.save(
      this.integranteRepo.create({
        grupoId,
        personaId,
        fechaInicio: new Date().toISOString().slice(0, 10),
        estado: 'ACTIVO',
        creadoPorUsuarioId: usuarioId,
      }),
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'MEMBER_ADDED',
      modulo: 'groups',
      entidad: 'grupo_integrantes',
      entidadId: `${grupoId}/${personaId}`,
    });
  }

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

  async integrantes(grupoId: number) {
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
      fechaIngreso: r.fechaInicio,
      estado: r.estado,
    }));
  }

  private toView(g: GrupoFormacion, totalIntegrantes: number): GrupoEtapaView {
    return {
      id: g.id,
      codigo: g.codigo,
      nombre: g.nombre,
      periodo: g.periodo,
      etapa: g.etapa?.nombre ?? '',
      etapaCodigo: g.etapa?.codigo ?? '',
      estado: g.estado,
      fechaInicio: g.fechaInicio,
      fechaFin: g.fechaFin,
      totalIntegrantes,
      encargado: null,
    };
  }
}
