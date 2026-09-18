import {
  ConflictException,
  Injectable,
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
import { GeoService } from './geo.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { GeoDto } from '../dto/asistencia.dto';

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
    geo: GeoService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {
    super(jornadaRepo, asistenciaRepo, ubicacionRepo, groups, authz, geo);
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
    this.validarJornadaAbierta(jornada);

    const integrante = await this.integranteRepo.findOne({
      where: { grupoId: jornada.grupoId, personaId, estado: 'ACTIVO' },
    });
    if (!integrante) {
      throw new ConflictException('La persona no es integrante activo del grupo');
    }
    const existente = await this.asistenciaRepo.findOne({ where: { jornadaId, personaId } });
    if (existente && existente.estadoAsistencia !== 'ANULADO') {
      throw new ConflictException(`Ya existe un registro (${existente.estadoAsistencia})`);
    }

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
    await this.capturarUbicacion(asistenciaId, usuarioId, 'MODIFICACION', geo);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId,
      grupoId: jornada.grupoId,
      asistenciaId,
      personaId,
      accion: 'ENTRADA',
      estado: 'FALTA_JUSTIFICADA',
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
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

    await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET fecha_hora_salida = GETDATE(), estado_asistencia = 'SALIDA_ANTICIPADA',
           observacion = @1, fecha_actualizacion = GETDATE()
       WHERE asistencia_id = @0 AND fecha_hora_entrada <= GETDATE()`,
      [asistenciaId, motivo],
    );

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
    await this.capturarUbicacion(asistenciaId, usuarioId, 'SALIDA', geo);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'SALIDA',
      estado: 'SALIDA_ANTICIPADA',
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
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
    await this.capturarUbicacion(asistenciaId, usuarioId, 'ANULACION', geo);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'ENTRADA',
      estado: 'ANULADO',
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
  }
}
