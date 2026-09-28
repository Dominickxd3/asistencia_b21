import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { Asistencia } from '../entities/asistencia.entity';
import { AsistenciaUbicacion } from '../entities/asistencia-ubicacion.entity';
import { GroupsService } from '../../groups/groups.service';
import { AuthzService } from '../../roles/authz.service';
import { EvaluacionGeografica, GeocercaService } from '../../sedes/geocerca.service';
import { GeoDto } from '../dto/asistencia.dto';
import { PermissionCode } from '../../../common/constants/permissions.constants';
import { fechaColumna, fechaHoraLocalIso } from '../../../common/utils/fecha.util';
import { ETIQUETA_ESTADO_JORNADA, ETIQUETA_ESTADO_ASISTENCIA } from '../../../common/enums/attendance-status.enum';

export type TipoEventoGeo = 'ENTRADA' | 'SALIDA' | 'MODIFICACION' | 'ANULACION';

/** Resumen geográfico que se devuelve al frontend tras cada acción */
export interface ResumenUbicacion {
  estado: EvaluacionGeografica['estado'];
  sede: string | null;
  distanciaMetros: number | null;
  precisionMetros: number | null;
}

/**
 * Reglas compartidas de los casos de uso de asistencia, en este orden:
 * acceso a la jornada (alcance por grupo) → estado de la jornada →
 * validación geográfica (geocerca de la sede) → registro → evidencia.
 */
@Injectable()
export class AsistenciaBaseService {
  constructor(
    @InjectRepository(Jornada)
    protected readonly jornadaRepo: Repository<Jornada>,
    @InjectRepository(Asistencia)
    protected readonly asistenciaRepo: Repository<Asistencia>,
    @InjectRepository(AsistenciaUbicacion)
    protected readonly ubicacionRepo: Repository<AsistenciaUbicacion>,
    protected readonly groups: GroupsService,
    protected readonly authz: AuthzService,
    protected readonly geocerca: GeocercaService,
  ) {}

  /**
   * Acceso: encargado solo opera su grupo con asignación ACTIVA;
   * quien tiene attendance.view_all_groups opera cualquiera.
   */
  async validarAccesoJornada(jornadaId: number, usuarioId: number): Promise<Jornada> {
    const jornada = await this.jornadaRepo.findOne({ where: { id: jornadaId } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    const vistaGlobal = await this.authz.tienePermiso(
      usuarioId,
      PermissionCode.ATTENDANCE_VIEW_ALL,
    );
    if (!vistaGlobal) {
      await this.groups.validarEncargadoActivo(usuarioId, jornada.grupoId);
    }
    return jornada;
  }

  async obtenerAsistencia(asistenciaId: number, usuarioId: number): Promise<Asistencia> {
    const asistencia = await this.asistenciaRepo.findOne({
      where: { id: asistenciaId },
      relations: { jornada: true },
    });
    if (!asistencia) throw new NotFoundException('Registro de asistencia no encontrado');
    await this.validarAccesoJornada(Number(asistencia.jornadaId), usuarioId);
    return asistencia;
  }

  /**
   * Asegura que la jornada esté ABIERTA. Si estaba PROGRAMADA, se abre
   * automáticamente al registrar sin exigir apertura manual al usuario.
   */
  async validarJornadaAbierta(jornada: Jornada): Promise<void> {
    const [reloj] = await this.jornadaRepo.query(
      `SELECT CONVERT(char(10), GETDATE(), 126) AS hoy`,
    );
    if (fechaColumna(jornada.fecha) !== reloj.hoy) {
      throw new UnprocessableEntityException(
        `La jornada corresponde al ${fechaColumna(jornada.fecha)}. El día operativo terminó a medianoche; seleccione la jornada de hoy.`,
      );
    }
    if (jornada.estado === 'PROGRAMADA') {
      await this.jornadaRepo.query(
        `UPDATE jornadas
         SET estado = 'ABIERTA', fecha_apertura = ISNULL(fecha_apertura, GETDATE())
         WHERE jornada_id = @0 AND estado = 'PROGRAMADA'`,
        [jornada.id],
      );
      jornada.estado = 'ABIERTA';
      return;
    }
    if (jornada.estado !== 'ABIERTA') {
      throw new UnprocessableEntityException(
        `La jornada está ${ETIQUETA_ESTADO_JORNADA[jornada.estado] ?? jornada.estado}; no se puede registrar asistencia`,
      );
    }
  }

  /** Una hora registrada a mano nunca puede quedar en el futuro (reloj de SQL Server) */
  protected async validarNoFutura(fechaHoraIso: string, etiqueta: string): Promise<void> {
    const [row] = await this.asistenciaRepo.query(
      `SELECT CASE WHEN CAST(@0 AS datetime2) > GETDATE() THEN 1 ELSE 0 END AS futura`,
      [fechaHoraIso],
    );
    if (Number(row?.futura) === 1) {
      throw new UnprocessableEntityException(`La ${etiqueta} no puede ser posterior a la hora actual`);
    }
  }

  protected validarEstado(asistencia: Asistencia, permitidos: string[]): void {
    if (!permitidos.includes(asistencia.estadoAsistencia)) {
      throw new UnprocessableEntityException(
        `No se puede realizar esta acción porque la asistencia figura como ${ETIQUETA_ESTADO_ASISTENCIA[asistencia.estadoAsistencia] ?? asistencia.estadoAsistencia}`,
      );
    }
  }

  /**
   * UQ(jornada, persona): una persona solo tiene UNA fila por jornada.
   * Si la fila anterior esta ANULADA, se reactiva (nunca se crea otra).
   * Devuelve el id reactivado o null.
   *
   * entrada: 'SERVIDOR' usa GETDATE(); cadena ISO usa esa hora; null deja sin hora.
   */
  protected async reactivarSiAnulada(
    jornadaId: number,
    personaId: number,
    opciones: {
      nuevoEstado: string;
      usuarioId: number;
      tipoRegistro: 'AUTOMATICO' | 'MANUAL';
      entrada: 'SERVIDOR' | string | null;
      motivoManual?: string | null;
      observacion?: string | null;
    },
  ): Promise<number | null> {
    const rows: { id: number }[] = await this.asistenciaRepo.query(
      `UPDATE asistencias SET
         estado_asistencia = @2,
         fecha_hora_entrada = CASE WHEN @3 = 1 THEN GETDATE() ELSE @4 END,
         fecha_hora_salida = NULL,
         tipo_registro = @5,
         motivo_registro_manual = @6,
         observacion = @7,
         registrado_por_usuario_id = @8,
         anulado_por_usuario_id = NULL,
         fecha_anulacion = NULL,
         motivo_anulacion = NULL,
         fecha_actualizacion = GETDATE()
       OUTPUT INSERTED.asistencia_id AS id
       WHERE jornada_id = @0
         AND persona_id = @1
         AND estado_asistencia = 'ANULADO'`,
      [
        jornadaId,
        personaId,
        opciones.nuevoEstado,
        opciones.entrada === 'SERVIDOR' ? 1 : 0,
        opciones.entrada === 'SERVIDOR' ? null : opciones.entrada,
        opciones.tipoRegistro,
        opciones.motivoManual ?? null,
        opciones.observacion ?? null,
        opciones.usuarioId,
      ],
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Validación geográfica en backend, ANTES de escribir la asistencia.
   * En modo BLOQUEAR solo DENTRO_ZONA puede crear un movimiento físico.
   * Sin GPS, sin una geocerca activa o con precisión insuficiente tampoco se
   * puede demostrar la presencia en sede y el movimiento se rechaza.
   */
  protected async validarUbicacion(
    grupoId: number,
    geo: GeoDto | undefined,
    bloqueable: boolean,
  ): Promise<EvaluacionGeografica> {
    const evaluacion = await this.geocerca.evaluarParaGrupo(grupoId, geo);
    if (!bloqueable) return evaluacion;

    // Mensajes para personal no técnico: qué pasó y qué hacer, sin jerga
    const sede = evaluacion.sedeNombre ?? 'la compañía';
    switch (evaluacion.estado) {
      case 'DENTRO_ZONA':
        return evaluacion;
      case 'FUERA_ZONA': {
        const m = Math.round(evaluacion.distanciaMetros ?? 0);
        const distancia = m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`;
        throw new UnprocessableEntityException(
          `Está fuera de ${sede} (a unos ${distancia}). ` +
            'La asistencia solo se puede registrar dentro del local.',
        );
      }
      case 'PRECISION_INSUFICIENTE':
        throw new UnprocessableEntityException(
          `No se pudo confirmar que está en ${sede}: la ubicación del equipo no es lo bastante exacta. ` +
            'Registre desde un celular con el GPS encendido. Si ya lo hace, acérquese a una ventana ' +
            'o salga a un espacio abierto y vuelva a intentarlo.',
        );
      case 'NO_DISPONIBLE':
        throw new UnprocessableEntityException(
          'No se pudo obtener su ubicación. Cuando el navegador pregunte, pulse «Permitir» ' +
            'y vuelva a intentarlo.',
        );
      case 'SIN_GEOCERCA':
        throw new UnprocessableEntityException(
          'Aún no está configurada la zona de la compañía, por eso no se puede registrar asistencia. ' +
            'Avise al Jefe de Instrucción para que la configure.',
        );
    }
    return evaluacion;
  }

  /**
   * Evidencia geográfica del movimiento: coordenadas originales, precisión,
   * resultado, sede, usuario, tipo de acción, jornada, hora del dispositivo
   * y hora del servidor.
   */
  protected async guardarUbicacion(
    asistenciaId: number,
    usuarioId: number,
    tipoEvento: TipoEventoGeo,
    jornadaId: number,
    evaluacion: EvaluacionGeografica,
  ): Promise<ResumenUbicacion> {
    const capturado = evaluacion.capturadoEn ? new Date(evaluacion.capturadoEn) : null;
    await this.ubicacionRepo.query(
      `INSERT INTO asistencia_ubicaciones
         (asistencia_id, usuario_id, tipo_evento, latitud, longitud, precision_metros,
          distancia_sede_metros, tolerancia_aplicada_metros, estado_geografico,
          sede_id, jornada_id, fecha_captura_dispositivo, fecha_captura)
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, GETDATE())`,
      [
        asistenciaId,
        usuarioId,
        tipoEvento,
        evaluacion.latitud,
        evaluacion.longitud,
        evaluacion.precisionMetros,
        evaluacion.distanciaMetros,
        evaluacion.toleranciaMetros,
        evaluacion.estado,
        evaluacion.sedeId,
        jornadaId,
        capturado && !Number.isNaN(capturado.getTime()) ? fechaHoraLocalIso(capturado) : null,
      ],
    );
    return {
      estado: evaluacion.estado,
      sede: evaluacion.sedeNombre,
      distanciaMetros: evaluacion.distanciaMetros,
      precisionMetros: evaluacion.precisionMetros,
    };
  }
}
