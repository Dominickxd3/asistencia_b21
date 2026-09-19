import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Asistencia } from '../entities/asistencia.entity';
import { GrupoIntegrante } from '../../groups/entities/grupo-integrante.entity';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { AsistenciaUbicacion } from '../entities/asistencia-ubicacion.entity';
import { Persona } from '../../persons/entities/persona.entity';
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
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
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
        dni: i.persona.dni ?? null,
        fotoUrl: i.persona.fotoUrl ?? null,
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
    await this.abrirVoluntariaAlParticipar(jornada, usuarioId);
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
    await this.abrirVoluntariaAlParticipar(jornada, usuarioId);
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
    const asistencia = await this.obtenerAsistencia(asistenciaId, usuarioId);
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

  async agregarObservacionPersona(
    jornadaId: number,
    personaId: number,
    observacion: string,
    usuarioId: number,
  ) {
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);
    let asistencia = await this.asistenciaRepo.findOne({ where: { jornadaId, personaId } });
    if (!asistencia) {
      const insertado: { id: number }[] = await this.asistenciaRepo.query(
        `INSERT INTO asistencias
           (jornada_id, persona_id, estado_asistencia, tipo_registro, observacion,
            registrado_por_usuario_id)
         OUTPUT INSERTED.asistencia_id AS id
         VALUES (@0, @1, 'PENDIENTE', 'MANUAL', @2, @3)`,
        [jornadaId, personaId, observacion, usuarioId],
      );
      asistencia = await this.asistenciaRepo.findOne({ where: { id: insertado[0].id } });
    } else {
      await this.asistenciaRepo.query(
        `UPDATE asistencias SET observacion = @1, fecha_actualizacion = GETDATE()
         WHERE asistencia_id = @0`,
        [asistencia.id, observacion],
      );
    }
    await this.auditoria.registrar({
      usuarioId,
      accion: 'ATTENDANCE_MODIFIED',
      modulo: 'attendance',
      entidad: 'asistencias',
      entidadId: asistencia!.id,
      valorNuevo: { observacion },
    });
    this.realtime.emitirAsistenciaRegistrada({
      jornadaId: Number(jornada.id),
      grupoId: jornada.grupoId,
      asistenciaId: asistencia!.id,
      personaId,
      accion: 'ENTRADA',
      estado: asistencia!.estadoAsistencia,
      fechaHora: new Date(),
    });
    return this.asistenciaRepo.findOne({ where: { id: asistencia!.id } });
  }

  /**
   * Resuelve la entidad Persona a partir de la lectura QR.
   * Admite DNI, ID numérico, objeto JSON o formatos con prefijo R21/B21.
   */
  async resolverPersonaDesdeQr(qrCode: string): Promise<Persona> {
    const raw = (qrCode || '').trim();
    if (!raw) {
      throw new NotFoundException('Código QR vacío o no legible');
    }

    let candidataDni: string | null = null;
    let candidataId: number | null = null;

    // 1. Intentar JSON
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.personaId && !isNaN(Number(parsed.personaId))) {
          candidataId = Number(parsed.personaId);
        } else if (parsed.id && !isNaN(Number(parsed.id))) {
          candidataId = Number(parsed.id);
        }
        if (parsed.dni) candidataDni = String(parsed.dni).trim();
      } catch {
        // Continuar con resolución por texto plano
      }
    }

    // 2. Prefijo tipo R21:42, B21-42, BOMBERO-42
    if (!candidataId && !candidataDni) {
      const matchPrefijo = raw.match(/^(?:R21|B21|BOMBERO|PERSONA)[:\-_]?(\d+)$/i);
      if (matchPrefijo) {
        candidataId = Number(matchPrefijo[1]);
      }
    }

    // 3. Formato numérico directo
    if (!candidataId && !candidataDni) {
      if (/^\d{8}$/.test(raw)) {
        candidataDni = raw;
      } else if (/^\d+$/.test(raw)) {
        candidataId = Number(raw);
      }
    }

    // Buscar en BD
    let persona: Persona | null = null;
    if (candidataId) {
      persona = await this.personaRepo.findOne({ where: { id: candidataId } });
    }
    if (!persona && candidataDni) {
      persona = await this.personaRepo.findOne({ where: { dni: candidataDni } });
    }
    if (!persona) {
      persona = await this.personaRepo.findOne({
        where: [
          { dni: raw },
          ...(!isNaN(Number(raw)) ? [{ id: Number(raw) }] : []),
        ],
      });
    }

    if (!persona) {
      throw new NotFoundException(`No se encontró ningún integrante con el código QR escaneado (${raw})`);
    }

    return persona;
  }

  /**
   * Modo escáner continuo de asistencia por QR.
   * Lógica por persona: persona + jornada + registro abierto.
   * - Si NO tiene registro abierto en esa jornada -> ENTRADA (origen = QR).
   * - Si YA tiene registro abierto en esa jornada -> SALIDA (origen = QR) con duración calculada en servidor.
   * - Ventana de protección de 7 segundos contra doble lectura accidental.
   */
  async escanearQr(jornadaId: number, qrCode: string, usuarioId: number, geo?: GeoDto) {
    const persona = await this.resolverPersonaDesdeQr(qrCode);
    const jornada = await this.validarAccesoJornada(jornadaId, usuarioId);
    await this.abrirVoluntariaAlParticipar(jornada, usuarioId);
    this.validarJornadaAbierta(jornada);
    await this.validarIntegranteActivo(jornada.grupoId, persona.id);

    // Consultar existencia en esta jornada específica con cálculo de tiempo en el servidor
    const rows: {
      id: number;
      estadoAsistencia: string;
      fechaHoraEntrada: Date | null;
      fechaHoraSalida: Date | null;
      segundosDesdeUltimaOp: number;
      segundosDuracion: number | null;
    }[] = await this.asistenciaRepo.query(
      `SELECT TOP 1
         asistencia_id AS id,
         estado_asistencia AS estadoAsistencia,
         fecha_hora_entrada AS fechaHoraEntrada,
         fecha_hora_salida AS fechaHoraSalida,
         DATEDIFF(second, ISNULL(fecha_actualizacion, ISNULL(fecha_hora_entrada, fecha_creacion)), GETDATE()) AS segundosDesdeUltimaOp,
         DATEDIFF(second, fecha_hora_entrada, GETDATE()) AS segundosDuracion
       FROM asistencias
       WHERE jornada_id = @0 AND persona_id = @1
       ORDER BY asistencia_id DESC`,
      [jornadaId, persona.id],
    );
    const existente = rows[0] ?? null;

    // 1. Protección contra doble lectura accidental (< 7 segundos)
    if (existente && existente.estadoAsistencia !== 'ANULADO') {
      const segs = Number(existente.segundosDesdeUltimaOp);
      if (Math.abs(segs) < 7) {
        return {
          resultado: 'DUPLICADO',
          mensaje: 'QR ya procesado recientemente.',
          persona: {
            id: persona.id,
            nombreCompleto: persona.nombreCompleto,
            dni: persona.dni,
          },
          segundos: segs,
        };
      }
    }

    // 2. Si NO tiene registro abierto -> ENTRADA
    if (!existente || existente.estadoAsistencia === 'PENDIENTE' || existente.estadoAsistencia === 'ANULADO') {
      let asistenciaId: number;

      const reactivado = await this.reactivarSiAnulada(jornadaId, persona.id, {
        nuevoEstado: 'PRESENTE',
        usuarioId,
        tipoRegistro: 'QR',
        entrada: 'SERVIDOR',
      });

      if (reactivado) {
        asistenciaId = reactivado;
      } else if (existente && existente.estadoAsistencia === 'PENDIENTE') {
        await this.asistenciaRepo.query(
          `UPDATE asistencias
           SET fecha_hora_entrada = GETDATE(),
               estado_asistencia = 'PRESENTE',
               tipo_registro = 'QR',
               registrado_por_usuario_id = @1,
               fecha_actualizacion = GETDATE()
           WHERE asistencia_id = @0`,
          [existente.id, usuarioId],
        );
        asistenciaId = existente.id;
      } else {
        const insertado: { id: number }[] = await this.asistenciaRepo.query(
          `INSERT INTO asistencias
             (jornada_id, persona_id, fecha_hora_entrada, estado_asistencia, tipo_registro,
              registrado_por_usuario_id, fecha_actualizacion)
           OUTPUT INSERTED.asistencia_id AS id
           VALUES (@0, @1, GETDATE(), 'PRESENTE', 'QR', @2, GETDATE())`,
          [jornadaId, persona.id, usuarioId],
        );
        asistenciaId = insertado[0].id;
      }

      await this.auditoria.registrar({
        usuarioId,
        accion: 'ATTENDANCE_ENTRY',
        modulo: 'attendance',
        entidad: 'asistencias',
        entidadId: asistenciaId,
        valorNuevo: { jornadaId, personaId: persona.id, estado: 'PRESENTE', origen: 'QR' },
      });
      await this.capturarUbicacion(asistenciaId, usuarioId, 'ENTRADA', geo);

      this.realtime.emitirAsistenciaRegistrada({
        jornadaId: Number(jornada.id),
        grupoId: jornada.grupoId,
        asistenciaId,
        personaId: persona.id,
        accion: 'ENTRADA',
        estado: 'PRESENTE',
        fechaHora: new Date(),
      });

      const regActualizado = await this.asistenciaRepo.findOne({ where: { id: asistenciaId } });
      const horaStr = regActualizado?.fechaHoraEntrada
        ? new Date(regActualizado.fechaHoraEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
        : new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

      return {
        resultado: 'ENTRADA',
        mensaje: 'Entrada registrada',
        asistenciaId,
        persona: {
          id: persona.id,
          nombreCompleto: persona.nombreCompleto,
          dni: persona.dni,
        },
        hora: horaStr,
        fechaHoraEntrada: regActualizado?.fechaHoraEntrada,
      };
    }

    // 3. Si YA tiene registro abierto (PRESENTE) -> SALIDA con cálculo de duración en servidor
    if (existente.estadoAsistencia === 'PRESENTE') {
      const diffSegundos = Math.max(0, Number(existente.segundosDuracion ?? 0));
      const diffMinutos = Math.floor(diffSegundos / 60);
      const horas = Math.floor(diffMinutos / 60);
      const minutos = diffMinutos % 60;
      const duracionTexto = horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;

      await this.asistenciaRepo.query(
        `UPDATE asistencias
         SET fecha_hora_salida = GETDATE(),
             estado_asistencia = 'FINALIZADO',
             tipo_registro = 'QR',
             fecha_actualizacion = GETDATE()
         WHERE asistencia_id = @0`,
        [existente.id],
      );

      await this.auditoria.registrar({
        usuarioId,
        accion: 'ATTENDANCE_EXIT',
        modulo: 'attendance',
        entidad: 'asistencias',
        entidadId: existente.id,
        valorNuevo: { estado: 'FINALIZADO', duracion: duracionTexto, origen: 'QR' },
      });
      await this.capturarUbicacion(existente.id, usuarioId, 'SALIDA', geo);

      this.realtime.emitirAsistenciaRegistrada({
        jornadaId: Number(jornada.id),
        grupoId: jornada.grupoId,
        asistenciaId: existente.id,
        personaId: persona.id,
        accion: 'SALIDA',
        estado: 'FINALIZADO',
        fechaHora: new Date(),
      });

      const regActualizado = await this.asistenciaRepo.findOne({ where: { id: existente.id } });
      const horaSalidaStr = regActualizado?.fechaHoraSalida
        ? new Date(regActualizado.fechaHoraSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
        : new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
      const horaEntradaStr = regActualizado?.fechaHoraEntrada
        ? new Date(regActualizado.fechaHoraEntrada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';

      return {
        resultado: 'SALIDA',
        mensaje: 'Salida registrada',
        asistenciaId: existente.id,
        persona: {
          id: persona.id,
          nombreCompleto: persona.nombreCompleto,
          dni: persona.dni,
        },
        hora: horaSalidaStr,
        horaEntrada: horaEntradaStr,
        duracion: duracionTexto,
        fechaHoraEntrada: regActualizado?.fechaHoraEntrada,
        fechaHoraSalida: regActualizado?.fechaHoraSalida,
      };
    }

    // 4. Si ya estaba FINALIZADO
    if (existente.estadoAsistencia === 'FINALIZADO') {
      return {
        resultado: 'YA_FINALIZADO',
        mensaje: `${persona.nombreCompleto} ya completó su asistencia en esta jornada.`,
        persona: {
          id: persona.id,
          nombreCompleto: persona.nombreCompleto,
          dni: persona.dni,
        },
      };
    }

    // 5. Otros estados (incidencias)
    return {
      resultado: 'INCIDENCIA',
      mensaje: `${persona.nombreCompleto} cuenta con estado especial (${existente.estadoAsistencia}) en esta jornada.`,
      persona: {
        id: persona.id,
        nombreCompleto: persona.nombreCompleto,
        dni: persona.dni,
      },
    };
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

  /** Una jornada voluntaria comienza con el primer participante, sin paso manual previo. */
  private async abrirVoluntariaAlParticipar(jornada: Jornada, usuarioId: number): Promise<void> {
    if (jornada.tipoJornada !== 'VOLUNTARIA' || jornada.estado !== 'PROGRAMADA') return;
    await this.jornadaRepo.query(
      `UPDATE jornadas
       SET estado = 'ABIERTA', fecha_apertura = GETDATE(), abierta_por_usuario_id = @1
       WHERE jornada_id = @0 AND estado = 'PROGRAMADA' AND tipo_jornada = 'VOLUNTARIA'`,
      [jornada.id, usuarioId],
    );
    jornada.estado = 'ABIERTA';
    this.realtime.emitirJornada('jornada.abierta', {
      jornadaId: Number(jornada.id),
      grupoId: jornada.grupoId,
    });
  }
}
