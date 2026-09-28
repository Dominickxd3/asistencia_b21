import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Asistencia } from '../entities/asistencia.entity';
import { GrupoIntegrante } from '../../groups/entities/grupo-integrante.entity';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { AsistenciaUbicacion } from '../entities/asistencia-ubicacion.entity';
import { AsistenciaBaseService } from './asistencia-base.service';
import { GroupsService } from '../../groups/groups.service';
import { AuthzService } from '../../roles/authz.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { GeoDto } from '../dto/asistencia.dto';
import { PizarraItemView, UbicacionPizarraView } from '../views/asistencia.view';
import { EvaluacionGeografica, GeocercaService } from '../../sedes/geocerca.service';
import { fechaColumna } from '../../../common/utils/fecha.util';
import { ETIQUETA_ESTADO_ASISTENCIA } from '../../../common/enums/attendance-status.enum';

/**
 * Casos de uso de registro: entrada, salida, hora manual,
 * ajuste manual (con motivo) y observacion.
 */
@Injectable()
export class RegistroService extends AsistenciaBaseService {
  constructor(
    @InjectRepository(Jornada) jornadaRepo: Repository<Jornada>,
    @InjectRepository(Asistencia) asistenciaRepo: Repository<Asistencia>,
    @InjectRepository(AsistenciaUbicacion) ubicacionRepo: Repository<AsistenciaUbicacion>,
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

  /** Pizarra operativa: pendientes primero. */
  async pizarra(jornadaId: number, usuarioId: number): Promise<PizarraItemView[]> {
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);

    const integrantes: { personaId: number; nombreCompleto: string }[] =
      await this.integranteRepo.query(
        `SELECT DISTINCT gi.persona_id AS personaId,
                p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto
         FROM grupo_integrantes gi
         JOIN personas p ON p.persona_id = gi.persona_id
         WHERE gi.grupo_id = @0
           AND gi.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
           AND gi.fecha_inicio <= @1`,
        [jornada.grupoId, fechaColumna(jornada.fecha)],
      );
    const asistencias = await this.asistenciaRepo.find({
      where: {
        jornadaId,
        personaId: In(integrantes.map((i) => i.personaId)),
      },
    });
    const porPersona = new Map(asistencias.map((a) => [a.personaId, a]));

    // Última evidencia geográfica de entrada y de salida de cada registro
    const ubicaciones: { asistenciaId: number; tipo: string; estado: string; precision: unknown; distancia: unknown }[] =
      await this.asistenciaRepo.query(
        `SELECT u.asistencia_id AS asistenciaId, u.tipo_evento AS tipo, u.estado_geografico AS estado,
                u.precision_metros AS precision, u.distancia_sede_metros AS distancia
         FROM asistencia_ubicaciones u
         JOIN asistencias a ON a.asistencia_id = u.asistencia_id
         WHERE a.jornada_id = @0 AND u.tipo_evento IN ('ENTRADA', 'SALIDA')
           AND u.ubicacion_id = (SELECT MAX(u2.ubicacion_id) FROM asistencia_ubicaciones u2
                                 WHERE u2.asistencia_id = u.asistencia_id AND u2.tipo_evento = u.tipo_evento)`,
        [jornadaId],
      );
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const geo = (asistenciaId: number, tipo: string): UbicacionPizarraView | null => {
      const u = ubicaciones.find((x) => Number(x.asistenciaId) === Number(asistenciaId) && x.tipo === tipo);
      return u ? { estado: u.estado, precisionMetros: num(u.precision), distanciaMetros: num(u.distancia) } : null;
    };

    const items: PizarraItemView[] = integrantes.map((i) => {
      const a = porPersona.get(i.personaId);
      return {
        personaId: i.personaId,
        nombreCompleto: i.nombreCompleto,
        asistenciaId: a?.id ?? null,
        estado: a?.estadoAsistencia ?? null,
        fechaHoraEntrada: a?.fechaHoraEntrada ?? null,
        fechaHoraSalida: a?.fechaHoraSalida ?? null,
        tipoRegistro: a?.tipoRegistro ?? null,
        observacion: a?.observacion ?? null,
        geoEntrada: a ? geo(a.id, 'ENTRADA') : null,
        geoSalida: a ? geo(a.id, 'SALIDA') : null,
      };
    });

    return items.sort((a, b) => {
      const pa = !a.estado || a.estado === 'PENDIENTE' ? 0 : 1;
      const pb = !b.estado || b.estado === 'PENDIENTE' ? 0 : 1;
      return pa - pb || a.nombreCompleto.localeCompare(b.nombreCompleto);
    });
  }

  /** Un clic: entrada con hora del servidor. */
  async registrarEntrada(jornadaId: number, personaId: number, usuarioId: number, geo?: GeoDto) {
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);
    await this.validarJornadaAbierta(jornada);
    await this.validarIntegranteEnFecha(jornada.grupoId, personaId, fechaColumna(jornada.fecha));
    await this.validarSinRegistro(jornadaId, personaId);
    const evaluacion = await this.validarUbicacion(jornada.grupoId, geo, true);

    const reactivado = await this.reactivarSiAnulada(jornadaId, personaId, {
      nuevoEstado: 'PRESENTE',
      usuarioId,
      tipoRegistro: 'AUTOMATICO',
      entrada: 'SERVIDOR',
    });
    if (reactivado) {
      return this.finalizarEntrada(reactivado, jornada, personaId, usuarioId, evaluacion);
    }

    const insertado: { id: number }[] = await this.asistenciaRepo.query(
      `INSERT INTO asistencias
         (jornada_id, persona_id, fecha_hora_entrada, estado_asistencia, tipo_registro,
          registrado_por_usuario_id)
       OUTPUT INSERTED.asistencia_id AS id
       VALUES (@0, @1, GETDATE(), 'PRESENTE', 'AUTOMATICO', @2)`,
      [jornadaId, personaId, usuarioId],
    );
    return this.finalizarEntrada(insertado[0].id, jornada, personaId, usuarioId, evaluacion);
  }

  /** Registro manual: hora indicada + motivo obligatorio. Estado PRESENTE. */
  async registrarManual(
    jornadaId: number,
    personaId: number,
    horaEntrada: string,
    motivo: string,
    usuarioId: number,
    geo?: GeoDto,
  ) {
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);
    await this.validarJornadaAbierta(jornada);
    await this.validarIntegranteEnFecha(jornada.grupoId, personaId, fechaColumna(jornada.fecha));
    await this.validarSinRegistro(jornadaId, personaId);

    const entradaIso = `${fechaColumna(jornada.fecha)}T${horaEntrada}:00`;
    await this.validarNoFutura(entradaIso, 'hora de entrada');
    const evaluacion = await this.validarUbicacion(jornada.grupoId, geo, true);

    const reactivado = await this.reactivarSiAnulada(jornadaId, personaId, {
      nuevoEstado: 'PRESENTE',
      usuarioId,
      tipoRegistro: 'MANUAL',
      entrada: entradaIso,
      motivoManual: motivo,
    });
    if (reactivado) {
      return this.finalizarEntrada(reactivado, jornada, personaId, usuarioId, evaluacion);
    }

    const insertado: { id: number }[] = await this.asistenciaRepo.query(
      `INSERT INTO asistencias
         (jornada_id, persona_id, fecha_hora_entrada, estado_asistencia, tipo_registro,
          motivo_registro_manual, registrado_por_usuario_id)
       OUTPUT INSERTED.asistencia_id AS id
       VALUES (@0, @1, @2, 'PRESENTE', 'MANUAL', @3, @4)`,
      [jornadaId, personaId, entradaIso, motivo, usuarioId],
    );
    return this.finalizarEntrada(insertado[0].id, jornada, personaId, usuarioId, evaluacion);
  }

  /** Salida: requiere entrada previa; hora del servidor. */
  async registrarSalida(asistenciaId: number, usuarioId: number, geo?: GeoDto) {
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
    await this.validarJornadaAbierta(asistencia.jornada);
    this.validarEstado(asistencia, ['PRESENTE']);
    const evaluacion = await this.validarUbicacion(asistencia.jornada.grupoId, geo, true);

    const actualizados: { id: number }[] = await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET fecha_hora_salida = GETDATE(), estado_asistencia = 'FINALIZADO', fecha_actualizacion = GETDATE()
       OUTPUT INSERTED.asistencia_id AS id
       WHERE asistencia_id = @0 AND estado_asistencia = 'PRESENTE' AND fecha_hora_entrada <= GETDATE()`,
      [asistenciaId],
    );
    if (actualizados.length === 0) {
      throw new UnprocessableEntityException(
        'La hora de entrada registrada es posterior a la hora actual; corrija la entrada antes de registrar la salida',
      );
    }

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_EXIT',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorNuevo: { estado: 'FINALIZADO' },
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
      estado: 'FINALIZADO',
      fechaHora: new Date(),
    });

    return { ...(await this.asistenciaRepo.findOne({ where: { id: asistenciaId } })), ubicacion };
  }

  /** Ajuste manual de horas; exige motivo y audita valor anterior. */
  async ajustarManual(
    asistenciaId: number,
    horaEntrada: string | undefined,
    horaSalida: string | undefined,
    motivo: string,
    usuarioId: number,
    geo?: GeoDto,
  ) {
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
    this.validarEstado(asistencia, ['PRESENTE', 'FINALIZADO', 'SALIDA_ANTICIPADA']);
    if (!horaEntrada && !horaSalida) {
      throw new UnprocessableEntityException('Debe indicar al menos una hora a ajustar');
    }

    const anterior = {
      estado: asistencia.estadoAsistencia,
      entrada: asistencia.fechaHoraEntrada,
      salida: asistencia.fechaHoraSalida,
    };

    // Correcciones: se guarda la evidencia geográfica, pero nunca se bloquean
    const evaluacion = await this.validarUbicacion(asistencia.jornada.grupoId, geo, false);

    const fecha = fechaColumna(asistencia.jornada?.fecha);
    const entradaIso = horaEntrada ? `${fecha}T${horaEntrada}:00` : null;
    const salidaIso = horaSalida ? `${fecha}T${horaSalida}:00` : null;
    if (entradaIso) await this.validarNoFutura(entradaIso, 'hora de entrada');
    if (salidaIso) await this.validarNoFutura(salidaIso, 'hora de salida');

    // La salida resultante (nueva o existente) debe quedar después de la entrada resultante
    const [coherencia] = await this.asistenciaRepo.query(
      `SELECT CASE
         WHEN COALESCE(CAST(@2 AS datetime2), fecha_hora_salida) IS NOT NULL
          AND COALESCE(CAST(@2 AS datetime2), fecha_hora_salida)
              <= COALESCE(CAST(@1 AS datetime2), fecha_hora_entrada)
         THEN 1 ELSE 0 END AS invalida
       FROM asistencias WHERE asistencia_id = @0`,
      [asistenciaId, entradaIso, salidaIso],
    );
    if (Number(coherencia?.invalida) === 1) {
      throw new UnprocessableEntityException('La hora de salida debe ser posterior a la hora de entrada');
    }

    // Registrar una salida sobre alguien PRESENTE lo deja FINALIZADO
    await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET fecha_hora_entrada = COALESCE(@1, fecha_hora_entrada),
           fecha_hora_salida = COALESCE(@2, fecha_hora_salida),
           estado_asistencia = CASE
             WHEN estado_asistencia = 'PRESENTE' AND COALESCE(@2, fecha_hora_salida) IS NOT NULL
             THEN 'FINALIZADO' ELSE estado_asistencia END,
           tipo_registro = 'MANUAL',
           motivo_registro_manual = @3,
           fecha_actualizacion = GETDATE()
       WHERE asistencia_id = @0`,
      [asistenciaId, entradaIso, salidaIso, motivo],
    );
    const actualizada = await this.asistenciaRepo.findOneOrFail({ where: { id: asistenciaId } });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_MODIFIED',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorAnterior: anterior,
      valorNuevo: { horaEntrada, horaSalida, motivo, estado: actualizada.estadoAsistencia },
    });
    const ubicacion = await this.guardarUbicacion(
      asistenciaId,
      usuarioId,
      'MODIFICACION',
      Number(asistencia.jornadaId),
      evaluacion,
    );

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      tipoJornada: asistencia.jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'MODIFICACION',
      estado: actualizada.estadoAsistencia,
      fechaHora: new Date(),
    });

    return { ...actualizada, ubicacion };
  }

  async agregarObservacion(asistenciaId: number, observacion: string, usuarioId: number) {
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
    this.validarEstado(asistencia, [
      'PRESENTE',
      'FINALIZADO',
      'FALTA_JUSTIFICADA',
      'FALTA_INJUSTIFICADA',
      'SALIDA_ANTICIPADA',
    ]);
    await this.asistenciaRepo.query(
      `UPDATE asistencias SET observacion = @1, fecha_actualizacion = GETDATE()
       WHERE asistencia_id = @0`,
      [asistenciaId, observacion],
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_MODIFIED',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorAnterior: { observacion: asistencia.observacion },
      valorNuevo: { observacion },
    });

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      tipoJornada: asistencia.jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'MODIFICACION',
      estado: asistencia.estadoAsistencia,
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
  }

  private async finalizarEntrada(
    asistenciaId: number,
    jornada: Jornada,
    personaId: number,
    usuarioId: number,
    evaluacion: EvaluacionGeografica,
  ) {
    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_ENTRY',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorNuevo: { jornadaId: jornada.id, personaId, estado: 'PRESENTE' },
    });
    const ubicacion = await this.guardarUbicacion(asistenciaId, usuarioId, 'ENTRADA', Number(jornada.id), evaluacion);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(jornada.id),
      grupoId: jornada.grupoId,
      tipoJornada: jornada.tipoJornada as 'OBLIGATORIA' | 'VOLUNTARIA',
      asistenciaId,
      personaId,
      accion: 'ENTRADA',
      estado: 'PRESENTE',
      fechaHora: new Date(),
    });

    return { ...(await this.asistenciaRepo.findOne({ where: { id: asistenciaId } })), ubicacion };
  }

  private async validarIntegranteEnFecha(
    grupoId: number,
    personaId: number,
    fecha: string,
  ): Promise<void> {
    const [integrante] = await this.integranteRepo.query(
      `SELECT TOP 1 grupo_integrante_id
       FROM grupo_integrantes
       WHERE grupo_id = @0 AND persona_id = @1
         AND fecha_inicio <= @2
         AND (fecha_fin IS NULL OR fecha_fin >= @2)`,
      [grupoId, personaId, fecha],
    );
    if (!integrante) {
      throw new UnprocessableEntityException(
        'La persona no pertenecía al grupo en la fecha de esta jornada',
      );
    }
  }

  private async validarSinRegistro(jornadaId: number, personaId: number): Promise<void> {
    const existente = await this.asistenciaRepo.findOne({
      where: { jornadaId, personaId },
    });
    if (existente && existente.estadoAsistencia !== 'ANULADO') {
      throw new ConflictException(
        `La persona ya tiene un registro en esta jornada: ${ETIQUETA_ESTADO_ASISTENCIA[existente.estadoAsistencia] ?? existente.estadoAsistencia}`,
      );
    }
  }
}
