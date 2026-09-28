import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asistencia } from '../entities/asistencia.entity';
import { AsistenciaUbicacion } from '../entities/asistencia-ubicacion.entity';
import { Justificacion } from '../entities/justificacion.entity';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { GrupoIntegrante } from '../../groups/entities/grupo-integrante.entity';
import { AsistenciaBaseService } from './asistencia-base.service';
import { GroupsService } from '../../groups/groups.service';
import { AuthzService } from '../../roles/authz.service';
import { GeocercaService } from '../../sedes/geocerca.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { GeoDto } from '../dto/asistencia.dto';
import { fechaColumna } from '../../../common/utils/fecha.util';
import { ETIQUETA_ESTADO_ASISTENCIA } from '../../../common/enums/attendance-status.enum';

/**
 * Casos de uso de incidencias: falta justificada, salida anticipada,
 * anulacion (nunca borrado fisico).
 */
@Injectable()
export class IncidenciasService extends AsistenciaBaseService {
  constructor(
    @InjectRepository(Jornada) jornadaRepo: Repository<Jornada>,
    @InjectRepository(Asistencia) asistenciaRepo: Repository<Asistencia>,
    @InjectRepository(AsistenciaUbicacion) ubicacionRepo: Repository<AsistenciaUbicacion>,
    @InjectRepository(Justificacion)
    private readonly justificacionRepo: Repository<Justificacion>,
    @InjectRepository(GrupoIntegrante)
    private readonly integranteRepo: Repository<GrupoIntegrante>,
    groups: GroupsService,
    authz: AuthzService,
    geocerca: GeocercaService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {
    super(jornadaRepo, asistenciaRepo, ubicacionRepo, groups, authz, geocerca);
  }

  /** Falta justificada: sin hora de entrada; no cuenta como asistencia efectiva. */
  async registrarFaltaJustificada(
    jornadaId: number,
    personaId: number,
    motivo: string,
    usuarioId: number,
    geo?: GeoDto,
  ) {
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);
    await this.validarJornadaAbierta(jornada);

    if (jornada.tipoJornada !== 'OBLIGATORIA') {
      throw new UnprocessableEntityException(
        'Las jornadas voluntarias no generan faltas ni requieren justificación.',
      );
    }

    const [contexto] = await this.integranteRepo.query(
      `SELECT e.codigo AS etapaCodigo
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE g.grupo_id = @0`,
      [jornada.grupoId],
    );
    if (!contexto || contexto.etapaCodigo === 'ASPIRANTE_ESBAS') {
      throw new UnprocessableEntityException(
        'ESBAS solo registra participación voluntaria y no genera faltas justificadas.',
      );
    }

    const [integrante] = await this.integranteRepo.query(
      `SELECT TOP 1 grupo_integrante_id
       FROM grupo_integrantes
       WHERE grupo_id = @0 AND persona_id = @1
         AND fecha_inicio <= @2
         AND (fecha_fin IS NULL OR fecha_fin >= @2)`,
      [jornada.grupoId, personaId, fechaColumna(jornada.fecha)],
    );
    if (!integrante) {
      throw new UnprocessableEntityException('La persona no pertenecía al grupo en la fecha de esta jornada');
    }
    const existente = await this.asistenciaRepo.findOne({ where: { jornadaId, personaId } });
    if (existente && existente.estadoAsistencia !== 'ANULADO') {
      throw new ConflictException(`La persona ya tiene un registro en esta jornada: ${ETIQUETA_ESTADO_ASISTENCIA[existente.estadoAsistencia] ?? existente.estadoAsistencia}`);
    }
    // La falta se registra aunque el encargado esté fuera: solo se guarda la evidencia
    const evaluacion = await this.validarUbicacion(jornada.grupoId, geo, false);

    let asistenciaId: number;
    const reactivada = await this.reactivarSiAnulada(jornadaId, personaId, {
      nuevoEstado: 'FALTA_JUSTIFICADA',
      usuarioId,
      tipoRegistro: 'MANUAL',
      entrada: null,
      observacion: motivo,
    });
    if (reactivada) {
      asistenciaId = reactivada;
    } else {
      const insertado: { id: number }[] = await this.asistenciaRepo.query(
        `INSERT INTO asistencias
           (jornada_id, persona_id, estado_asistencia, tipo_registro, observacion,
            registrado_por_usuario_id)
         OUTPUT INSERTED.asistencia_id AS id
         VALUES (@0, @1, 'FALTA_JUSTIFICADA', 'MANUAL', @2, @3)`,
        [jornadaId, personaId, motivo, usuarioId],
      );
      asistenciaId = insertado[0].id;
    }

    await this.justificacionRepo.save(
      this.justificacionRepo.create({
        asistenciaId,
        tipo: 'FALTA',
        descripcion: motivo,
        estado: 'PENDIENTE',
        registradoPorUsuarioId: usuarioId,
      }),
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_JUSTIFIED',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorNuevo: { jornadaId, personaId, motivo },
    });
    const ubicacion = await this.guardarUbicacion(asistenciaId, usuarioId, 'MODIFICACION', jornadaId, evaluacion);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId,
      grupoId: jornada.grupoId,
      tipoJornada: jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
      asistenciaId,
      personaId,
      accion: 'FALTA',
      estado: 'FALTA_JUSTIFICADA',
      fechaHora: new Date(),
    });

    return { ...(await this.asistenciaRepo.findOne({ where: { id: asistenciaId } })), ubicacion };
  }

  /** Salida anticipada: solo si la persona está presente (con entrada). */
  async registrarSalidaAnticipada(
    asistenciaId: number,
    motivo: string,
    usuarioId: number,
    geo?: GeoDto,
  ) {
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
    this.validarEstado(asistencia, ['PRESENTE']);
    const evaluacion = await this.validarUbicacion(asistencia.jornada.grupoId, geo, true);

    const actualizados: { id: number }[] = await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET fecha_hora_salida = GETDATE(), estado_asistencia = 'SALIDA_ANTICIPADA',
           observacion = @1, fecha_actualizacion = GETDATE()
       OUTPUT INSERTED.asistencia_id AS id
       WHERE asistencia_id = @0 AND estado_asistencia = 'PRESENTE' AND fecha_hora_entrada <= GETDATE()`,
      [asistenciaId, motivo],
    );
    if (actualizados.length === 0) {
      throw new UnprocessableEntityException(
        'La hora de entrada registrada es posterior a la hora actual; corrija la entrada antes de registrar la salida',
      );
    }

    await this.justificacionRepo.save(
      this.justificacionRepo.create({
        asistenciaId,
        tipo: 'SALIDA_ANTICIPADA',
        descripcion: motivo,
        estado: 'PENDIENTE',
        registradoPorUsuarioId: usuarioId,
      }),
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_EARLY_EXIT',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorNuevo: { estado: 'SALIDA_ANTICIPADA', motivo },
    });
    const ubicacion = await this.guardarUbicacion(
      asistenciaId,
      usuarioId,
      'SALIDA',
      Number(asistencia.jornadaId),
      evaluacion,
    );

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      tipoJornada: asistencia.jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'SALIDA',
      estado: 'SALIDA_ANTICIPADA',
      fechaHora: new Date(),
    });

    return { ...(await this.asistenciaRepo.findOne({ where: { id: asistenciaId } })), ubicacion };
  }

  /**
   * Anulación: nunca borra el registro. Marca ANULADO y conserva
   * quien lo hizo, cuándo y por qué.
   */
  async anular(asistenciaId: number, motivo: string, usuarioId: number, geo?: GeoDto) {
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
    this.validarEstado(asistencia, [
      'PENDIENTE',
      'PRESENTE',
      'FINALIZADO',
      'FALTA_JUSTIFICADA',
      'FALTA_INJUSTIFICADA',
      'SALIDA_ANTICIPADA',
    ]);
    const evaluacion = await this.validarUbicacion(asistencia.jornada.grupoId, geo, false);

    await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET estado_asistencia = 'ANULADO', anulado_por_usuario_id = @1,
           fecha_anulacion = GETDATE(), motivo_anulacion = @2, fecha_actualizacion = GETDATE()
       WHERE asistencia_id = @0`,
      [asistenciaId, usuarioId, motivo],
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_ANNULLED',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorAnterior: { estado: asistencia.estadoAsistencia },
      valorNuevo: { estado: 'ANULADO', motivo },
    });
    await this.guardarUbicacion(asistenciaId, usuarioId, 'ANULACION', Number(asistencia.jornadaId), evaluacion);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      tipoJornada: asistencia.jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'ANULACION',
      estado: 'ANULADO',
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
  }
}
