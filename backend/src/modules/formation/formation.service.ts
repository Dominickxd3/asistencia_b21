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
import { ActualizarHistorialDto, CorregirPromocionDto, PromoverDto } from './dto/formacion.dto';

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

      const hoy = new Date().toISOString().slice(0, 10);

      // 1) cerrar etapa actual
      await em.query(
        `UPDATE persona_etapas
         SET estado = 'FINALIZADO', fecha_fin = @1, observacion = @2
         WHERE persona_etapa_id = @0`,
        [actual.id, hoy, dto.observacion ?? `Promovido a ${destino.codigo}`],
      );

      // 2) salir del grupo actual (si estaba)
      await em.query(
        `UPDATE grupo_integrantes
         SET estado = 'FINALIZADO', fecha_fin = @1,
             motivo_salida = 'Promoción de etapa'
         WHERE persona_id = @0 AND estado = 'ACTIVO'`,
        [dto.personaId, hoy],
      );

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

  async corregirUltimaPromocion(dto: CorregirPromocionDto, usuarioId: number) {
    const resultado = await this.ds.transaction(async (em) => {
      const etapas = await em.query(
        `SELECT TOP 2 pe.persona_etapa_id AS id, pe.grupo_id AS grupoId,
                pe.estado, e.codigo AS etapaCodigo
         FROM persona_etapas pe
         JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
         WHERE pe.persona_id = @0 AND pe.estado IN ('ACTIVO','FINALIZADO')
         ORDER BY CASE WHEN pe.estado = 'ACTIVO' THEN 0 ELSE 1 END,
                  pe.fecha_inicio DESC, pe.persona_etapa_id DESC`,
        [dto.personaId],
      );
      const actual = etapas.find((item: any) => item.estado === 'ACTIVO');
      const anterior = etapas.find((item: any) => item.estado === 'FINALIZADO');
      if (!actual || !anterior) {
        throw new UnprocessableEntityException('No existe una promoción anterior que pueda corregirse');
      }

      const hoy = new Date().toISOString().slice(0, 10);
      await em.query(
        `UPDATE persona_etapas SET estado = 'RETIRADO', fecha_fin = @1,
           observacion = CONCAT(ISNULL(observacion + ' | ', ''), 'Promoción corregida: ', @2)
         WHERE persona_etapa_id = @0;
         UPDATE persona_etapas SET estado = 'ACTIVO', fecha_fin = NULL,
           observacion = CONCAT(ISNULL(observacion + ' | ', ''), 'Reactivada por corrección: ', @2)
         WHERE persona_etapa_id = @3`,
        [actual.id, hoy, dto.motivo, anterior.id],
      );
      if (actual.grupoId) {
        await em.query(
          `UPDATE grupo_integrantes SET estado = 'FINALIZADO', fecha_fin = @2,
             motivo_salida = 'Corrección de promoción: ' + @3
           WHERE grupo_id = @0 AND persona_id = @1 AND estado = 'ACTIVO'`,
          [actual.grupoId, dto.personaId, hoy, dto.motivo],
        );
      }
      if (anterior.grupoId) {
        await em.query(
          `UPDATE grupo_integrantes SET estado = 'ACTIVO', fecha_fin = NULL, motivo_salida = NULL
           WHERE grupo_integrante_id = (
             SELECT TOP 1 grupo_integrante_id FROM grupo_integrantes
             WHERE grupo_id = @0 AND persona_id = @1
             ORDER BY fecha_inicio DESC, grupo_integrante_id DESC
           )`,
          [anterior.grupoId, dto.personaId],
        );
      }
      return { deEtapa: actual.etapaCodigo, aEtapa: anterior.etapaCodigo };
    });
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PROMOTION_CORRECTED',
      modulo: 'formation',
      entidad: 'persona_etapas',
      entidadId: dto.personaId,
      valorAnterior: { etapa: resultado.deEtapa },
      valorNuevo: { etapa: resultado.aEtapa, motivo: dto.motivo },
    });
    return { personaId: dto.personaId, ...resultado };
  }

  async historial(personaId: number) {
    const rows = await this.ds.query(
      `SELECT pe.persona_etapa_id AS id, pe.persona_id AS personaId,
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
              p.apellido_paterno + ' ' + p.apellido_materno + ' ' + p.nombres AS persona,
              e.nombre AS etapa, ISNULL(g.nombre, '—') AS grupo,
              e.codigo AS etapaCodigo,
              pe.fecha_inicio AS fechaInicio, pe.fecha_fin AS fechaFin, pe.estado, pe.observacion
       FROM persona_etapas pe
       JOIN personas p ON p.persona_id = pe.persona_id
       JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       LEFT JOIN grupos_formacion g ON g.grupo_id = pe.grupo_id
       ORDER BY pe.fecha_inicio DESC`,
      [],
    );
  }

  async actualizarHistorial(id: number, dto: ActualizarHistorialDto, usuarioId: number) {
    const [actual] = await this.ds.query(
      `SELECT persona_etapa_id AS id, persona_id AS personaId, fecha_inicio AS fechaInicio,
              fecha_fin AS fechaFin, estado, observacion
       FROM persona_etapas WHERE persona_etapa_id = @0`,
      [id],
    );
    if (!actual) throw new NotFoundException('Registro de formación no encontrado');
    const fechaInicio = dto.fechaInicio ?? String(actual.fechaInicio).slice(0, 10);
    const fechaFin = dto.fechaFin !== undefined ? dto.fechaFin : actual.fechaFin;
    if (fechaFin && fechaInicio > String(fechaFin).slice(0, 10)) {
      throw new UnprocessableEntityException('La fecha final no puede ser anterior a la fecha inicial');
    }
    await this.ds.query(
      `UPDATE persona_etapas SET fecha_inicio = @1, fecha_fin = @2, observacion = @3
       WHERE persona_etapa_id = @0`,
      [id, fechaInicio, fechaFin || null, dto.observacion.trim()],
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'FORMATION_HISTORY_UPDATED',
      modulo: 'formation',
      entidad: 'persona_etapas',
      entidadId: id,
      valorAnterior: { fechaInicio: actual.fechaInicio, fechaFin: actual.fechaFin, observacion: actual.observacion },
      valorNuevo: { fechaInicio, fechaFin: fechaFin || null, observacion: dto.observacion.trim() },
    });
    return { id, fechaInicio, fechaFin: fechaFin || null, observacion: dto.observacion.trim() };
  }
}
