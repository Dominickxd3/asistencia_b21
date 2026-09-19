import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { Asistencia } from '../entities/asistencia.entity';
import { GrupoIntegrante } from '../../groups/entities/grupo-integrante.entity';
import { AuditoriaService } from '../../audit/auditoria.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { resolverReglaAsistencia } from '../../../common/domain/attendance-rule';

export interface PendienteView {
  personaId: number;
  nombreCompleto: string;
}

/**
 * Cierre de jornada: si quedan personas sin registro, es obligatorio
 * convertirlas explicitamente a FALTA_INJUSTIFICADA (con confirmacion).
 */
@Injectable()
export class CierreJornadaService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    @InjectRepository(Asistencia)
    private readonly asistenciaRepo: Repository<Asistencia>,
    @InjectRepository(GrupoIntegrante)
    private readonly integranteRepo: Repository<GrupoIntegrante>,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Personas del grupo sin registro (o con registro anulado) en la jornada */
  async pendientes(jornadaId: number): Promise<PendienteView[]> {
    const [jornada] = await this.jornadaRepo.query(
      `SELECT j.fecha, j.tipo_jornada AS tipoJornada, e.codigo AS etapaCodigo
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE j.jornada_id = @0`,
      [jornadaId],
    );
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.tipoJornada !== 'OBLIGATORIA' || resolverReglaAsistencia(jornada.etapaCodigo, jornada.fecha).tipoJornada !== 'OBLIGATORIA') return [];
    return this.jornadaRepo.query(
      `SELECT gi.persona_id AS personaId,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id
       JOIN jornadas j ON j.jornada_id = @0 AND j.grupo_id = gi.grupo_id
       LEFT JOIN asistencias a
         ON a.jornada_id = @0 AND a.persona_id = gi.persona_id
        AND a.estado_asistencia <> 'ANULADO'
       WHERE gi.estado = 'ACTIVO' AND a.asistencia_id IS NULL
       ORDER BY p.apellido_paterno, p.nombres`,
      [jornadaId],
    );
  }

  /**
   * Cierra la jornada. Si hay pendientes y no se confirmó la conversión,
   * responde 422 con la lista para que la UI la muestre y confirme.
   */
  async cerrar(
    jornadaId: number,
    usuarioId: number,
    convertirPendientes: boolean,
  ): Promise<{ id: number; estado: string; convertidas: number }> {
    const jornada = await this.jornadaRepo.findOne({ where: { id: jornadaId } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.estado !== 'ABIERTA') {
      throw new UnprocessableEntityException(`La jornada está ${jornada.estado}; debe estar ABIERTA`);
    }

    const [clasificacion] = await this.jornadaRepo.query(
      `SELECT j.fecha, j.tipo_jornada AS tipoJornada, e.codigo AS etapaCodigo
       FROM jornadas j JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id WHERE j.jornada_id = @0`,
      [jornadaId],
    );
    const esObligatoria = clasificacion.tipoJornada === 'OBLIGATORIA' && resolverReglaAsistencia(
      clasificacion.etapaCodigo,
      clasificacion.fecha,
    ).tipoJornada === 'OBLIGATORIA';
    const pendientes = esObligatoria ? await this.pendientes(jornadaId) : [];
    if (pendientes.length > 0 && !convertirPendientes) {
      throw new UnprocessableEntityException({
        message: `Quedan ${pendientes.length} persona(s) sin registro`,
        pendientes,
      });
    }

    await this.jornadaRepo.manager.transaction(async (em) => {
      if (esObligatoria && convertirPendientes) {
        for (const p of pendientes) {
          // UQ(jornada, persona): reactivar fila anulada o insertar una nueva
          await em.query(
            `UPDATE asistencias
             SET estado_asistencia = 'FALTA_INJUSTIFICADA',
                 tipo_registro = 'AUTOMATICO',
                 observacion = 'Convertida al cerrar la jornada',
                 anulado_por_usuario_id = NULL,
                 fecha_anulacion = NULL,
                 motivo_anulacion = NULL,
                 registrado_por_usuario_id = @2,
                 fecha_actualizacion = GETDATE()
             WHERE jornada_id = @0 AND persona_id = @1 AND estado_asistencia = 'ANULADO';

             IF @@ROWCOUNT = 0
               INSERT INTO asistencias
                 (jornada_id, persona_id, estado_asistencia, tipo_registro,
                  observacion, registrado_por_usuario_id)
               VALUES (@0, @1, 'FALTA_INJUSTIFICADA', 'AUTOMATICO',
                       'Convertida al cerrar la jornada', @2)`,
            [jornadaId, p.personaId, usuarioId],
          );
        }
      }
      await em.query(
        `UPDATE jornadas
         SET estado = 'CERRADA', fecha_cierre = GETDATE(), cerrada_por_usuario_id = @1
         WHERE jornada_id = @0`,
        [jornadaId, usuarioId],
      );
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'SESSION_CLOSED',
      modulo: 'sessions',
      entidad: 'jornadas',
      entidadId: jornadaId,
      valorNuevo: { estado: 'CERRADA', faltasConvertidas: esObligatoria && convertirPendientes ? pendientes.length : 0 },
    });

    this.realtime.emitirJornada('jornada.cerrada', {
      jornadaId,
      grupoId: jornada.grupoId,
    });

    return { id: jornadaId, estado: 'CERRADA', convertidas: pendientes.length };
  }
}
