import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { GroupsService } from '../../groups/groups.service';
import { AuthzService } from '../../roles/authz.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { PermissionCode } from '../../../common/constants/permissions.constants';

export interface PendienteView {
  personaId: number;
  nombreCompleto: string;
}

export interface ResumenCierreView {
  tipoJornada: string;
  generaFaltas: boolean;
  /** Sin registro: se convertirán en FALTA_INJUSTIFICADA */
  pendientes: PendienteView[];
  /** Siguen PRESENTE: se les registrará la salida al cerrar */
  presentes: PendienteView[];
}

const NOMBRE_SQL = `p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres`;

/**
 * Cierre de jornada:
 * - solo en jornadas OBLIGATORIAS, quienes quedaron sin registro pasan a
 *   FALTA_INJUSTIFICADA (con confirmación explícita);
 * - quienes siguen PRESENTE reciben su salida (hora de fin programada o la actual, la menor)
 *   para que ninguna asistencia quede abierta en una jornada cerrada.
 */
@Injectable()
export class CierreJornadaService {
  constructor(
    @InjectRepository(Jornada)
    private readonly jornadaRepo: Repository<Jornada>,
    private readonly groups: GroupsService,
    private readonly authz: AuthzService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Lo que ocurrirá al cerrar: pendientes y presentes sin salida */
  async resumen(jornadaId: number, usuarioId: number): Promise<ResumenCierreView> {
    const jornada = await this.validarAcceso(jornadaId, usuarioId);
    return {
      tipoJornada: jornada.tipoJornada,
      generaFaltas: jornada.tipoJornada === 'OBLIGATORIA',
      pendientes: await this.pendientes(jornadaId, this.jornadaRepo.manager),
      presentes: await this.presentes(jornadaId, this.jornadaRepo.manager),
    };
  }

  /**
   * Cierra la jornada. Si hay pendientes y no se confirmó la conversión,
   * responde 422 con la lista para que la UI la muestre y confirme.
   */
  async cerrar(
    jornadaId: number,
    usuarioId: number,
    convertirPendientes: boolean,
  ): Promise<{ id: number; estado: string; convertidas: number; salidasRegistradas: number }> {
    const jornada = await this.validarAcceso(jornadaId, usuarioId);
    if (jornada.estado !== 'ABIERTA') {
      throw new UnprocessableEntityException(`La jornada está ${jornada.estado}; debe estar ABIERTA`);
    }

    const resultado = await this.jornadaRepo.manager.transaction(async (em) => {
      const pendientes = await this.pendientes(jornadaId, em);
      if (pendientes.length > 0 && !convertirPendientes) {
        throw new UnprocessableEntityException({
          message: `Quedan ${pendientes.length} persona(s) sin registro`,
          pendientes,
        });
      }

      for (const p of pendientes) {
        // UQ(jornada, persona): reactivar fila anulada o insertar una nueva
        await em.query(
          `UPDATE asistencias
           SET estado_asistencia = 'FALTA_INJUSTIFICADA',
               tipo_registro = 'AUTOMATICO',
               fecha_hora_entrada = NULL,
               fecha_hora_salida = NULL,
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

      const finalizadas: { id: number }[] = await em.query(
        `UPDATE a
         SET a.fecha_hora_salida = CASE
               WHEN j.fecha_hora_fin_programada IS NOT NULL
                AND j.fecha_hora_fin_programada < GETDATE()
                AND j.fecha_hora_fin_programada > a.fecha_hora_entrada
               THEN j.fecha_hora_fin_programada
               WHEN GETDATE() >= DATEADD(DAY, 1, CAST(j.fecha AS datetime2))
               THEN DATEADD(SECOND, -1, DATEADD(DAY, 1, CAST(j.fecha AS datetime2)))
               ELSE GETDATE() END,
             a.estado_asistencia = 'FINALIZADO',
             a.observacion = ISNULL(a.observacion, 'Salida registrada al cerrar la jornada'),
             a.fecha_actualizacion = GETDATE()
         OUTPUT INSERTED.asistencia_id AS id
         FROM asistencias a
         JOIN jornadas j ON j.jornada_id = a.jornada_id
         WHERE a.jornada_id = @0 AND a.estado_asistencia = 'PRESENTE'`,
        [jornadaId],
      );

      await em.query(
        `UPDATE jornadas
         SET estado = 'CERRADA', fecha_cierre = GETDATE(), cerrada_por_usuario_id = @1
         WHERE jornada_id = @0`,
        [jornadaId, usuarioId],
      );

      return { convertidas: pendientes.length, salidasRegistradas: finalizadas.length };
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'SESSION_CLOSED',
      modulo: 'sessions',
      entidad: 'jornadas',
      entidadId: jornadaId,
      valorNuevo: {
        estado: 'CERRADA',
        faltasConvertidas: resultado.convertidas,
        salidasRegistradas: resultado.salidasRegistradas,
      },
    });

    this.realtime.emitirJornada('jornada.cerrada', {
      jornadaId,
      grupoId: jornada.grupoId,
      tipoJornada: jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
    });

    return { id: jornadaId, estado: 'CERRADA', ...resultado };
  }

  /**
   * Personas obligadas en esa fecha sin registro. Una jornada voluntaria o un
   * grupo ESBAS nunca produce pendientes ni faltas.
   */
  private pendientes(jornadaId: number, db: EntityManager): Promise<PendienteView[]> {
    return db.query(
      `SELECT gi.persona_id AS personaId, ${NOMBRE_SQL} AS nombreCompleto
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id
       JOIN jornadas j ON j.jornada_id = @0 AND j.grupo_id = gi.grupo_id
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       LEFT JOIN asistencias a
         ON a.jornada_id = @0 AND a.persona_id = gi.persona_id
        AND a.estado_asistencia <> 'ANULADO'
       WHERE j.tipo_jornada = 'OBLIGATORIA'
         AND e.codigo IN ('POSTULANTE', 'ASPIRANTE_COMPANIA')
         AND gi.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
         AND gi.fecha_inicio <= j.fecha
         AND a.asistencia_id IS NULL
       ORDER BY p.apellido_paterno, p.nombres`,
      [jornadaId],
    );
  }

  private presentes(jornadaId: number, db: EntityManager): Promise<PendienteView[]> {
    return db.query(
      `SELECT a.persona_id AS personaId, ${NOMBRE_SQL} AS nombreCompleto
       FROM asistencias a
       JOIN personas p ON p.persona_id = a.persona_id
       WHERE a.jornada_id = @0 AND a.estado_asistencia = 'PRESENTE'
       ORDER BY p.apellido_paterno, p.nombres`,
      [jornadaId],
    );
  }

  /** Quien no tiene vista global solo cierra jornadas de su grupo activo */
  private async validarAcceso(jornadaId: number, usuarioId: number): Promise<Jornada> {
    const jornada = await this.jornadaRepo.findOne({ where: { id: jornadaId } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    const vistaGlobal = await this.authz.tienePermiso(usuarioId, PermissionCode.ATTENDANCE_VIEW_ALL);
    if (!vistaGlobal) await this.groups.validarEncargadoActivo(usuarioId, jornada.grupoId);
    return jornada;
  }
}
