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
import { PromoverDto } from './dto/formacion.dto';

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
              p.apellido_paterno + ' ' + p.apellido_materno + ' ' + p.nombres AS persona,
              e.nombre AS etapa, ISNULL(g.nombre, '—') AS grupo,
              pe.fecha_inicio AS fechaInicio, pe.fecha_fin AS fechaFin, pe.estado
       FROM persona_etapas pe
       JOIN personas p ON p.persona_id = pe.persona_id
       JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       LEFT JOIN grupos_formacion g ON g.grupo_id = pe.grupo_id
       ORDER BY pe.fecha_inicio DESC`,
      [],
    );
  }
}
