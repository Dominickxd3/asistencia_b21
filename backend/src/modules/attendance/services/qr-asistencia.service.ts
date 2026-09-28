import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { PersonaQr } from '../entities/persona-qr.entity';
import { Asistencia } from '../entities/asistencia.entity';
import { RegistroService } from './registro.service';
import { GroupsService } from '../../groups/groups.service';
import { AuthzService } from '../../roles/authz.service';
import { AuditoriaService } from '../../audit/auditoria.service';
import { PermissionCode } from '../../../common/constants/permissions.constants';
import { GeoDto } from '../dto/asistencia.dto';
import { ETIQUETA_ESTADO_ASISTENCIA } from '../../../common/enums/attendance-status.enum';

const PREFIJO_QR = 'R21|ASISTENCIA|';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class QrAsistenciaService {
  constructor(
    @InjectRepository(PersonaQr) private readonly qrRepo: Repository<PersonaQr>,
    @InjectRepository(Asistencia) private readonly asistenciaRepo: Repository<Asistencia>,
    private readonly registro: RegistroService,
    private readonly groups: GroupsService,
    private readonly authz: AuthzService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async credencialesGrupo(grupoId: number, usuarioId: number) {
    await this.validarAccesoGrupo(grupoId, usuarioId);
    const rows = await this.qrRepo.query(
      `SELECT p.persona_id AS personaId,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto,
              p.dni, q.codigo, q.fecha_generacion AS fechaGeneracion
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id
       JOIN persona_qr q ON q.persona_id = p.persona_id AND q.estado = 'ACTIVO'
       WHERE gi.grupo_id = @0 AND gi.estado = 'ACTIVO'
       ORDER BY p.apellido_paterno, p.apellido_materno, p.nombres`,
      [grupoId],
    );

    return Promise.all(
      rows.map(async (r: any) => {
        const contenido = `${PREFIJO_QR}${r.codigo}`;
        return {
          personaId: Number(r.personaId),
          nombreCompleto: r.nombreCompleto,
          dni: r.dni ?? null,
          contenido,
          fechaGeneracion: r.fechaGeneracion,
          imagen: await QRCode.toDataURL(contenido, {
            width: 360,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#111827', light: '#ffffff' },
          }),
        };
      }),
    );
  }

  async rotar(grupoId: number, personaId: number, usuarioId: number) {
    await this.validarAccesoGrupo(grupoId, usuarioId);
    const [miembro] = await this.qrRepo.query(
      `SELECT TOP 1 grupo_integrante_id FROM grupo_integrantes
       WHERE grupo_id = @0 AND persona_id = @1 AND estado = 'ACTIVO'`,
      [grupoId, personaId],
    );
    if (!miembro) throw new NotFoundException('La persona no es integrante activo del grupo');

    await this.qrRepo.query(
      `UPDATE persona_qr
       SET codigo = CONVERT(varchar(36), NEWID()), estado = 'ACTIVO',
           generado_por_usuario_id = @1, fecha_actualizacion = GETDATE()
       WHERE persona_id = @0`,
      [personaId, usuarioId],
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PERSON_QR_ROTATED',
      modulo: 'attendance',
      entidad: 'persona_qr',
      entidadId: personaId,
      valorNuevo: { grupoId },
    });
    return { ok: true };
  }

  async registrar(
    jornadaId: number,
    valorLeido: string,
    accion: 'ENTRADA' | 'SALIDA' | 'AUTO' = 'AUTO',
    usuarioId: number,
    geo?: GeoDto,
  ) {
    const codigo = this.extraerCodigo(valorLeido);
    const qr = await this.qrRepo.findOne({
      where: { codigo, estado: 'ACTIVO' },
      relations: { persona: true },
    });
    if (!qr || qr.persona.estado !== 'ACTIVO') {
      throw new NotFoundException('El QR no existe, fue reemplazado o pertenece a una persona inactiva');
    }

    const asistencia = await this.asistenciaRepo.findOne({
      where: { jornadaId, personaId: qr.personaId },
    });

    let accionEfectiva: 'ENTRADA' | 'SALIDA';

    if (!accion || accion === 'AUTO') {
      if (!asistencia || asistencia.estadoAsistencia === 'PENDIENTE') {
        accionEfectiva = 'ENTRADA';
      } else if (asistencia.estadoAsistencia === 'PRESENTE') {
        accionEfectiva = 'SALIDA';
      } else if (
        asistencia.estadoAsistencia === 'FINALIZADO' ||
        asistencia.estadoAsistencia === 'SALIDA_ANTICIPADA'
      ) {
        throw new UnprocessableEntityException(
          `${qr.persona.nombreCompleto} ya cuenta con Entrada y Salida registradas en esta jornada`,
        );
      } else {
        throw new UnprocessableEntityException(
          `${qr.persona.nombreCompleto} ya figura como ${ETIQUETA_ESTADO_ASISTENCIA[asistencia.estadoAsistencia] ?? asistencia.estadoAsistencia} en esta jornada`,
        );
      }
    } else {
      accionEfectiva = accion;
    }

    if (accionEfectiva === 'SALIDA') {
      if (!asistencia || asistencia.estadoAsistencia !== 'PRESENTE') {
        throw new UnprocessableEntityException(
          `${qr.persona.nombreCompleto} no tiene una entrada abierta en esta jornada`,
        );
      }
      const registro = await this.registro.registrarSalida(Number(asistencia.id), usuarioId, geo);
      return {
        accion: 'SALIDA' as const,
        personaId: qr.personaId,
        nombreCompleto: qr.persona.nombreCompleto,
        registro,
      };
    }

    const registro = await this.registro.registrarEntrada(
      jornadaId,
      qr.personaId,
      usuarioId,
      geo,
    );
    return {
      accion: 'ENTRADA' as const,
      personaId: qr.personaId,
      nombreCompleto: qr.persona.nombreCompleto,
      registro,
    };
  }

  private extraerCodigo(valor: string): string {
    const limpio = valor.trim();
    const codigo = limpio.startsWith(PREFIJO_QR) ? limpio.slice(PREFIJO_QR.length) : '';
    if (!UUID.test(codigo)) {
      throw new UnprocessableEntityException('El código leído no es una credencial QR de Rímac 21');
    }
    return codigo.toLowerCase();
  }

  private async validarAccesoGrupo(grupoId: number, usuarioId: number): Promise<void> {
    const global = await this.authz.tienePermiso(usuarioId, PermissionCode.ATTENDANCE_VIEW_ALL);
    if (!global) await this.groups.validarEncargadoActivo(usuarioId, grupoId);
  }
}
