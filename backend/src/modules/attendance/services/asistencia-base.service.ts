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
import { GeoService } from './geo.service';
import { GeoDto } from '../dto/asistencia.dto';
import { PermissionCode } from '../../../common/constants/permissions.constants';

/**
 * Reglas compartidas de los casos de uso de asistencia:
 * acceso a la jornada (alcance por grupo) y captura geográfica.
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
    protected readonly geo: GeoService,
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

  /** Solo sobre jornadas abiertas */
  validarJornadaAbierta(jornada: Jornada): void {
    if (jornada.estado !== 'ABIERTA') {
      throw new UnprocessableEntityException(
        `La jornada está ${jornada.estado}; debe estar ABIERTA para registrar`,
      );
    }
  }

  protected validarEstado(asistencia: Asistencia, permitidos: string[]): void {
    if (!permitidos.includes(asistencia.estadoAsistencia)) {
      throw new UnprocessableEntityException(
        `Operación inválida: la asistencia está en estado ${asistencia.estadoAsistencia}`,
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
      tipoRegistro: 'AUTOMATICO' | 'MANUAL' | 'QR' | string;
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

  /** Registra la captura geográfica del dispositivo (una por evento) */
  async capturarUbicacion(
    asistenciaId: number,
    usuarioId: number,
    tipoEvento: 'ENTRADA' | 'SALIDA' | 'MODIFICACION' | 'ANULACION',
    geo?: GeoDto,
  ): Promise<void> {
    const evaluacion = await this.geo.evaluar(geo);
    await this.ubicacionRepo.query(
      `INSERT INTO asistencia_ubicaciones
         (asistencia_id, usuario_id, tipo_evento, latitud, longitud, precision_metros,
          distancia_sede_metros, estado_geografico, fecha_captura)
       VALUES (@0, @1, @2, @3, @4, @5, @6, @7, GETDATE())`,
      [
        asistenciaId,
        usuarioId,
        tipoEvento,
        geo?.latitud ?? null,
        geo?.longitud ?? null,
        geo?.precisionMetros ?? null,
        evaluacion.distanciaMetros,
        evaluacion.estado,
      ],
    );
  }
}
