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
import { GeoService } from './geo.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { GeoDto } from '../dto/asistencia.dto';
import { PizarraItemView } from '../views/asistencia.view';

/** La columna date puede llegar como string o Date según el driver */
function jornadaFecha(asistencia: Asistencia): string {
  const f: any = asistencia.jornada?.fecha;
  return f instanceof Date ? f.toISOString().slice(0, 10) : String(f).slice(0, 10);
}

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
    geo: GeoService,
    private readonly auditoria: AuditoriaService,
    private readonly realtime: RealtimeService,
  ) {
    super(jornadaRepo, asistenciaRepo, ubicacionRepo, groups, authz, geo);
  }

  /** Pizarra operativa: pendientes primero. */
  async pizarra(jornadaId: number, usuarioId: number): Promise<PizarraItemView[]> {
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);

    const integrantes = await this.integranteRepo.find({
      where: { grupoId: jornada.grupoId, estado: 'ACTIVO' },
      relations: { persona: true },
    });
    const asistencias = await this.asistenciaRepo.find({
      where: {
        jornadaId,
        personaId: In(integrantes.map((i) => i.personaId)),
      },
    });
    const porPersona = new Map(asistencias.map((a) => [a.personaId, a]));

    const items: PizarraItemView[] = integrantes.map((i) => {
      const a = porPersona.get(i.personaId);
      return {
        personaId: i.personaId,
        nombreCompleto: i.persona.nombreCompleto,
        asistenciaId: a?.id ?? null,
        estado: a?.estadoAsistencia ?? null,
        fechaHoraEntrada: a?.fechaHoraEntrada ?? null,
        fechaHoraSalida: a?.fechaHoraSalida ?? null,
        tipoRegistro: a?.tipoRegistro ?? null,
        observacion: a?.observacion ?? null,
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
    this.validarJornadaAbierta(jornada);
    await this.validarIntegranteActivo(jornada.grupoId, personaId);
    await this.validarSinRegistro(jornadaId, personaId);

    const reactivado = await this.reactivarSiAnulada(jornadaId, personaId, {
      nuevoEstado: 'PRESENTE',
      usuarioId,
      tipoRegistro: 'AUTOMATICO',
      entrada: 'SERVIDOR',
    });
    if (reactivado) {
      return this.finalizarEntrada(reactivado, jornada, personaId, usuarioId, geo);
    }

    const insertado: { id: number }[] = await this.asistenciaRepo.query(
      `INSERT INTO asistencias
         (jornada_id, persona_id, fecha_hora_entrada, estado_asistencia, tipo_registro,
          registrado_por_usuario_id)
       OUTPUT INSERTED.asistencia_id AS id
       VALUES (@0, @1, GETDATE(), 'PRESENTE', 'AUTOMATICO', @2)`,
      [jornadaId, personaId, usuarioId],
    );
    return this.finalizarEntrada(insertado[0].id, jornada, personaId, usuarioId, geo);
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
    this.validarJornadaAbierta(jornada);
    await this.validarIntegranteActivo(jornada.grupoId, personaId);
    await this.validarSinRegistro(jornadaId, personaId);

    const entradaIso = `${typeof jornada.fecha === 'string' ? jornada.fecha : new Date(jornada.fecha).toISOString().slice(0, 10)}T${horaEntrada}:00`;

    const reactivado = await this.reactivarSiAnulada(jornadaId, personaId, {
      nuevoEstado: 'PRESENTE',
      usuarioId,
      tipoRegistro: 'MANUAL',
      entrada: entradaIso,
      motivoManual: motivo,
    });
    if (reactivado) {
      return this.finalizarEntrada(reactivado, jornada, personaId, usuarioId, geo);
    }

    const insertado: { id: number }[] = await this.asistenciaRepo.query(
      `INSERT INTO asistencias
         (jornada_id, persona_id, fecha_hora_entrada, estado_asistencia, tipo_registro,
          motivo_registro_manual, registrado_por_usuario_id)
       OUTPUT INSERTED.asistencia_id AS id
       VALUES (@0, @1, @2, 'PRESENTE', 'MANUAL', @3, @4)`,
      [jornadaId, personaId, entradaIso, motivo, usuarioId],
    );
    return this.finalizarEntrada(insertado[0].id, jornada, personaId, usuarioId, geo);
  }

  /** Salida: requiere entrada previa; hora del servidor. */
  async registrarSalida(asistenciaId: number, usuarioId: number, geo?: GeoDto) {
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
    this.validarEstado(asistencia, ['PRESENTE']);

    await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET fecha_hora_salida = GETDATE(), estado_asistencia = 'FINALIZADO', fecha_actualizacion = GETDATE()
       WHERE asistencia_id = @0 AND fecha_hora_entrada <= GETDATE()`,
      [asistenciaId],
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_EXIT',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorNuevo: { estado: 'FINALIZADO' },
    });
    await this.capturarUbicacion(asistenciaId, usuarioId, 'SALIDA', geo);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'SALIDA',
      estado: 'FINALIZADO',
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
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
      entrada: asistencia.fechaHoraEntrada,
      salida: asistencia.fechaHoraSalida,
    };

    await this.asistenciaRepo.query(
      `UPDATE asistencias
       SET fecha_hora_entrada = COALESCE(@1, fecha_hora_entrada),
           fecha_hora_salida = COALESCE(@2, fecha_hora_salida),
           tipo_registro = 'MANUAL',
           motivo_registro_manual = @3,
           fecha_actualizacion = GETDATE()
       WHERE asistencia_id = @0`,
      [
        asistenciaId,
        horaEntrada ? `${jornadaFecha(asistencia)}T${horaEntrada}:00` : null,
        horaSalida ? `${jornadaFecha(asistencia)}T${horaSalida}:00` : null,
        motivo,
      ],
    );

    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_MODIFIED',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorAnterior: anterior,
      valorNuevo: { horaEntrada, horaSalida, motivo },
    });
    await this.capturarUbicacion(asistenciaId, usuarioId, 'MODIFICACION', geo);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(asistencia.jornadaId),
      grupoId: asistencia.jornada.grupoId,
      asistenciaId,
      personaId: asistencia.personaId,
      accion: 'ENTRADA',
      estado: asistencia.estadoAsistencia,
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
  }

  async agregarObservacion(asistenciaId: number, observacion: string, usuarioId: number) {
    await this.obtenerAsistencia(asistenciaId, usuarioId);
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
      valorNuevo: { observacion },
    });
    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
  }

  private async finalizarEntrada(
    asistenciaId: number,
    jornada: Jornada,
    personaId: number,
    usuarioId: number,
    geo?: GeoDto,
  ) {
    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_ENTRY',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistenciaId,
      valorNuevo: { jornadaId: jornada.id, personaId, estado: 'PRESENTE' },
    });
    await this.capturarUbicacion(asistenciaId, usuarioId, 'ENTRADA', geo);

    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(jornada.id),
      grupoId: jornada.grupoId,
      asistenciaId,
      personaId,
      accion: 'ENTRADA',
      estado: 'PRESENTE',
      fechaHora: new Date(),
    });

    return this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
  }

  private async validarIntegranteActivo(grupoId: number, personaId: number): Promise<void> {
    const integrante = await this.integranteRepo.findOne({
      where: { grupoId, personaId, estado: 'ACTIVO' },
    });
    if (!integrante) {
      throw new UnprocessableEntityException(
        'La persona no es integrante activo del grupo de esta jornada',
      );
    }
  }

  private async validarSinRegistro(jornadaId: number, personaId: number): Promise<void> {
    const existente = await this.asistenciaRepo.findOne({
      where: { jornadaId, personaId },
    });
    if (existente && existente.estadoAsistencia !== 'ANULADO') {
      throw new ConflictException(
        `La persona ya tiene un registro (${existente.estadoAsistencia}) en esta jornada`,
      );
    }
  }
}
