import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Persona } from '../persons/entities/persona.entity';
import { AuditoriaService } from '../audit/auditoria.service';
import { PromoverDto, CrearHistorialDto, ActualizarHistorialDto } from './dto/formacion.dto';
import { fechaServidor } from '../../common/utils/fecha.util';

/**
 * Formación: promover una persona entre etapas.
 * Regla de oro: la persona nunca se duplica; se cierra su etapa activa
 * y se abre una nueva fila en persona_etapas (historial intacto).
 */
@Injectable()
export class FormationService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async promover(dto: PromoverDto, usuarioId: number) {
    return this.ds.transaction(async (em) => {
      const persona = await em.findOne(Persona, { where: { id: dto.personaId } });
      if (!persona || persona.estado !== 'ACTIVO') {
        throw new NotFoundException('Persona no encontrada o inactiva');
      }

      const [actual] = await em.query(
        `SELECT pe.persona_etapa_id AS id, pe.etapa_id AS etapaId, e.codigo AS etapaCodigo,
                e.orden, pe.grupo_id AS grupoId
         FROM persona_etapas pe
         JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
         WHERE pe.persona_id = @0 AND pe.estado = 'ACTIVO'`,
        [dto.personaId],
      );
      if (!actual) {
        throw new UnprocessableEntityException('La persona no tiene una etapa activa');
      }

      const [destino] = await em.query(
        `SELECT etapa_id AS id, codigo, nombre, orden FROM etapas_formacion WHERE codigo = @0`,
        [dto.etapaDestino],
      );
      if (!destino) throw new NotFoundException(`Etapa destino no existe: ${dto.etapaDestino}`);
      if (destino.orden <= actual.orden) {
        throw new ConflictException(
          `No se puede retroceder o permanecer (${actual.etapaCodigo} → ${destino.codigo}). La promoción es hacia adelante.`,
        );
      }

      if (dto.grupoDestinoId) {
        const [grupo] = await em.query(
          `SELECT g.estado, e.codigo AS etapaCodigo, g.nombre
           FROM grupos_formacion g JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
           WHERE g.grupo_id = @0`,
          [dto.grupoDestinoId],
        );
        if (!grupo || grupo.estado !== 'ACTIVO') {
          throw new UnprocessableEntityException('El grupo destino no existe o no está activo');
        }
        if (grupo.etapaCodigo !== destino.codigo) {
          throw new UnprocessableEntityException(
            `El grupo ${grupo.nombre} pertenece a otra etapa (${grupo.etapaCodigo}), no a ${destino.codigo}`,
          );
        }
      }

      const hoy = await fechaServidor(em);

      // 1) cerrar etapa actual
      await em.query(
        `UPDATE persona_etapas
         SET estado = 'FINALIZADO', fecha_fin = @1, observacion = @2
         WHERE persona_etapa_id = @0`,
        [actual.id, hoy, dto.observacion ?? `Promovido a ${destino.codigo}`],
      );

      // 2) salir del grupo actual (si estaba)
      if (actual.grupoId != null) {
        await em.query(
          `UPDATE grupo_integrantes
           SET estado = 'FINALIZADO', fecha_fin = @1,
               motivo_salida = 'Promoción de etapa'
           WHERE grupo_id = @0 AND persona_id = @2 AND estado = 'ACTIVO'`,
          [actual.grupoId, hoy, dto.personaId],
        );
      }

      // 3) abrir nueva etapa
      const nueva = await em.query(
        `INSERT INTO persona_etapas
           (persona_id, etapa_id, grupo_id, fecha_inicio, fecha_fin, estado, observacion, registrado_por_usuario_id)
         VALUES (@0, @1, @2, @3, NULL, 'ACTIVO', @4, @5);
         SELECT SCOPE_IDENTITY() AS id`,
        [
          dto.personaId,
          destino.id,
          dto.grupoDestinoId ?? null,
          hoy,
          dto.observacion ?? null,
          usuarioId,
        ],
      );

      // 4) ingresar al grupo destino (si se indicó)
      if (dto.grupoDestinoId) {
        await em.query(
          `INSERT INTO grupo_integrantes
             (grupo_id, persona_id, fecha_inicio, estado, creado_por_usuario_id)
           VALUES (@0, @1, @2, 'ACTIVO', @3)`,
          [dto.grupoDestinoId, dto.personaId, hoy, usuarioId],
        );
      }

      await this.auditoria.registrar({
        usuarioId,
        accion: 'MEMBER_PROMOTED',
        modulo: 'formation',
        entidad: 'persona_etapas',
        entidadId: dto.personaId,
        valorAnterior: { etapa: actual.etapaCodigo, grupoId: actual.grupoId },
        valorNuevo: { etapa: dto.etapaDestino, grupoId: dto.grupoDestinoId ?? null },
      });

      return {
        personaId: dto.personaId,
        deEtapa: actual.etapaCodigo,
        aEtapa: destino.codigo,
        personaEtapaId: Number(nueva[0]?.id ?? 0),
        fechaInicio: hoy,
      };
    });
  }

  async historial(personaId: number) {
    const rows = await this.ds.query(
      `SELECT pe.persona_etapa_id AS id,
              e.codigo AS etapa, e.nombre AS etapaNombre,
              ISNULL(g.nombre, '—') AS grupo,
              pe.fecha_inicio AS fechaInicio,
              pe.fecha_fin AS fechaFin,
              pe.estado,
              pe.observacion
       FROM persona_etapas pe
       JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       LEFT JOIN grupos_formacion g ON g.grupo_id = pe.grupo_id
       WHERE pe.persona_id = @0
       ORDER BY pe.fecha_inicio DESC, pe.persona_etapa_id DESC`,
      [personaId],
    );
    return rows;
  }

  async historialGeneral() {
    return this.ds.query(
      `SELECT pe.persona_etapa_id AS id,
              pe.persona_id AS personaId,
              pe.etapa_id AS etapaId,
              pe.grupo_id AS grupoId,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS persona,
              p.dni AS documento,
              e.nombre AS etapa,
              e.codigo AS etapaCodigo,
              ISNULL(g.nombre, '—') AS grupo,
              g.codigo AS grupoCodigo,
              CONVERT(VARCHAR(10), pe.fecha_inicio, 120) AS fechaInicio,
              CONVERT(VARCHAR(10), pe.fecha_fin, 120) AS fechaFin,
              pe.estado,
              pe.observacion,
              pe.fecha_creacion AS fechaCreacion
       FROM persona_etapas pe
       JOIN personas p ON p.persona_id = pe.persona_id
       JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       LEFT JOIN grupos_formacion g ON g.grupo_id = pe.grupo_id
       ORDER BY pe.fecha_inicio DESC, pe.persona_etapa_id DESC`,
      [],
    );
  }

  async catalogos() {
    const personas = await this.ds.query(
      `SELECT persona_id AS id,
              apellido_paterno + ' ' + ISNULL(apellido_materno + ' ', '') + nombres AS nombre,
              dni AS documento,
              estado
       FROM personas
       ORDER BY apellido_paterno, nombres`,
    );

    const etapas = await this.ds.query(
      `SELECT etapa_id AS id, codigo, nombre, orden
       FROM etapas_formacion
       ORDER BY orden ASC`,
    );

    const grupos = await this.ds.query(
      `SELECT g.grupo_id AS id, g.nombre, g.codigo, g.etapa_id AS etapaId, e.nombre AS etapaNombre, g.estado
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       ORDER BY g.nombre ASC`,
    );

    return { personas, etapas, grupos };
  }

  async crearHistorial(dto: CrearHistorialDto, usuarioId: number, ip?: string | null, userAgent?: string | null) {
    const persona = await this.ds.query(
      `SELECT persona_id AS id, apellido_paterno + ' ' + ISNULL(apellido_materno + ' ', '') + nombres AS nombre
       FROM personas WHERE persona_id = @0`,
      [dto.personaId],
    );
    if (!persona.length) throw new NotFoundException('Persona no encontrada');

    const etapa = await this.ds.query(
      `SELECT etapa_id AS id, nombre, codigo FROM etapas_formacion WHERE etapa_id = @0`,
      [dto.etapaId],
    );
    if (!etapa.length) throw new NotFoundException('Etapa no encontrada');

    if (dto.estado === 'ACTIVO') {
      const activas = await this.ds.query(
        `SELECT persona_etapa_id AS id FROM persona_etapas WHERE persona_id = @0 AND estado = 'ACTIVO'`,
        [dto.personaId],
      );
      for (const act of activas) {
        await this.ds.query(
          `UPDATE persona_etapas SET estado = 'FINALIZADO', fecha_fin = @1 WHERE persona_etapa_id = @0`,
          [act.id, dto.fechaInicio],
        );
      }
    }

    const res = await this.ds.query(
      `INSERT INTO persona_etapas
         (persona_id, etapa_id, grupo_id, fecha_inicio, fecha_fin, estado, observacion, registrado_por_usuario_id)
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7);
       SELECT SCOPE_IDENTITY() AS id`,
      [
        dto.personaId,
        dto.etapaId,
        dto.grupoId ?? null,
        dto.fechaInicio,
        dto.fechaFin || null,
        dto.estado,
        dto.observacion || null,
        usuarioId,
      ],
    );

    const nuevoId = Number(res[0]?.id ?? 0);

    if (dto.grupoId && dto.estado === 'ACTIVO') {
      const enGrupo = await this.ds.query(
        `SELECT 1 FROM grupo_integrantes WHERE grupo_id = @0 AND persona_id = @1 AND estado = 'ACTIVO'`,
        [dto.grupoId, dto.personaId],
      );
      if (!enGrupo.length) {
        await this.ds.query(
          `INSERT INTO grupo_integrantes (grupo_id, persona_id, fecha_inicio, estado, creado_por_usuario_id)
           VALUES (@0, @1, @2, 'ACTIVO', @3)`,
          [dto.grupoId, dto.personaId, dto.fechaInicio, usuarioId],
        );
      }
    }

    await this.auditoria.registrar({
      usuarioId,
      accion: 'HISTORIAL_CREATED',
      modulo: 'formation',
      entidad: 'persona_etapas',
      entidadId: nuevoId,
      valorNuevo: {
        personaId: dto.personaId,
        persona: persona[0].nombre,
        etapa: etapa[0].nombre,
        etapaId: dto.etapaId,
        grupoId: dto.grupoId ?? null,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin ?? null,
        estado: dto.estado,
        observacion: dto.observacion ?? null,
      },
      descripcion: `Creación de trayectoria para ${persona[0].nombre} en etapa ${etapa[0].nombre}`,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });

    return { id: nuevoId, ok: true };
  }

  async actualizarHistorial(
    id: number,
    dto: ActualizarHistorialDto,
    usuarioId: number,
    ip?: string | null,
    userAgent?: string | null,
  ) {
    const [existente] = await this.ds.query(
      `SELECT pe.persona_etapa_id AS id, pe.persona_id AS personaId, pe.etapa_id AS etapaId,
              pe.grupo_id AS grupoId,
              CONVERT(VARCHAR(10), pe.fecha_inicio, 120) AS fechaInicio,
              CONVERT(VARCHAR(10), pe.fecha_fin, 120) AS fechaFin,
              pe.estado, pe.observacion,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS persona,
              e.nombre AS etapaNombre
       FROM persona_etapas pe
       JOIN personas p ON p.persona_id = pe.persona_id
       JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       WHERE pe.persona_etapa_id = @0`,
      [id],
    );
    if (!existente) throw new NotFoundException('Registro de historial no encontrado');

    const personaId = dto.personaId ?? existente.personaId;
    const etapaId = dto.etapaId ?? existente.etapaId;
    const grupoId = dto.grupoId !== undefined ? dto.grupoId : existente.grupoId;
    const fechaInicio = dto.fechaInicio ?? existente.fechaInicio;
    const fechaFin = dto.fechaFin !== undefined ? (dto.fechaFin || null) : existente.fechaFin;
    const estado = dto.estado ?? existente.estado;
    const observacion = dto.observacion !== undefined ? (dto.observacion || null) : existente.observacion;

    await this.ds.query(
      `UPDATE persona_etapas
       SET persona_id = @1, etapa_id = @2, grupo_id = @3,
           fecha_inicio = @4, fecha_fin = @5, estado = @6, observacion = @7
       WHERE persona_etapa_id = @0`,
      [id, personaId, etapaId, grupoId, fechaInicio, fechaFin, estado, observacion],
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'HISTORIAL_UPDATED',
      modulo: 'formation',
      entidad: 'persona_etapas',
      entidadId: id,
      valorAnterior: {
        personaId: existente.personaId,
        etapaId: existente.etapaId,
        grupoId: existente.grupoId,
        fechaInicio: existente.fechaInicio,
        fechaFin: existente.fechaFin,
        estado: existente.estado,
        observacion: existente.observacion,
      },
      valorNuevo: { personaId, etapaId, grupoId, fechaInicio, fechaFin, estado, observacion },
      descripcion: `Modificación de trayectoria de ${existente.persona} (Etapa: ${existente.etapaNombre})`,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });

    return { id, ok: true };
  }

  async eliminarHistorial(id: number, usuarioId: number, ip?: string | null, userAgent?: string | null) {
    const [existente] = await this.ds.query(
      `SELECT pe.persona_etapa_id AS id, pe.persona_id AS personaId,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS persona,
              e.nombre AS etapaNombre, pe.estado,
              CONVERT(VARCHAR(10), pe.fecha_inicio, 120) AS fechaInicio
       FROM persona_etapas pe
       JOIN personas p ON p.persona_id = pe.persona_id
       JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       WHERE pe.persona_etapa_id = @0`,
      [id],
    );
    if (!existente) throw new NotFoundException('Registro de historial no encontrado');

    await this.ds.query(`DELETE FROM persona_etapas WHERE persona_etapa_id = @0`, [id]);

    await this.auditoria.registrar({
      usuarioId,
      accion: 'HISTORIAL_DELETED',
      modulo: 'formation',
      entidad: 'persona_etapas',
      entidadId: id,
      valorAnterior: existente,
      descripcion: `Eliminación de registro de trayectoria de ${existente.persona} en etapa ${existente.etapaNombre}`,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
    });

    return { id, ok: true };
  }
}
