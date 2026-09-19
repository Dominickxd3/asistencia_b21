import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RegistroService } from './services/registro.service';
import { IncidenciasService } from './services/incidencias.service';
import { CierreJornadaService } from './services/cierre-jornada.service';
import {
  AjustarManualDto,
  AnularDto,
  FaltaJustificadaDto,
  ObservacionDto,
  RegistrarEntradaDto,
  RegistrarManualDto,
  RegistrarSalidaDto,
  SalidaAnticipadaDto,
  ScanQrDto,
} from './dto/asistencia.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly registro: RegistroService,
    private readonly incidencias: IncidenciasService,
    private readonly cierre: CierreJornadaService,
  ) {}

  // ---------- Consulta ----------

  @Get('board/:jornadaId')
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW)
  pizarra(@Param('jornadaId', ParseIntPipe) jornadaId: number, @CurrentUser() user: CurrentUserData) {
    return this.registro.pizarra(jornadaId, user.id);
  }

  @Get('sessions/:jornadaId/pending')
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW)
  pendientes(@Param('jornadaId', ParseIntPipe) jornadaId: number) {
    return this.cierre.pendientes(jornadaId);
  }

  // ---------- Registro normal ----------

  @Post('entry')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  entrada(@Body() dto: RegistrarEntradaDto, @CurrentUser() user: CurrentUserData) {
    return this.registro.registrarEntrada(dto.jornadaId, dto.personaId, user.id, dto.geo);
  }

  @Post('exit')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  salida(@Body() dto: RegistrarSalidaDto, @CurrentUser() user: CurrentUserData) {
    return this.registro.registrarSalida(dto.asistenciaId, user.id, dto.geo);
  }

  @Post('manual-entry')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  entradaManual(@Body() dto: RegistrarManualDto, @CurrentUser() user: CurrentUserData) {
    return this.registro.registrarManual(
      dto.jornadaId,
      dto.personaId,
      dto.horaEntrada,
      dto.motivo,
      user.id,
      dto.geo,
    );
  }

  // ---------- Incidencias ----------

  @Post('justified-absence')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  faltaJustificada(@Body() dto: FaltaJustificadaDto, @CurrentUser() user: CurrentUserData) {
    return this.incidencias.registrarFaltaJustificada(
      dto.jornadaId,
      dto.personaId,
      dto.motivo,
      user.id,
      dto.geo,
    );
  }

  @Post('early-exit')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  salidaAnticipada(@Body() dto: SalidaAnticipadaDto, @CurrentUser() user: CurrentUserData) {
    return this.incidencias.registrarSalidaAnticipada(
      dto.asistenciaId,
      dto.motivo,
      user.id,
      dto.geo,
    );
  }

  @Post(':id/annul')
  @RequirePermissions(PermissionCode.ATTENDANCE_CANCEL)
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.incidencias.anular(id, dto.motivo, user.id, dto.geo);
  }

  // ---------- Correcciones ----------

  @Patch(':id/manual-adjust')
  @RequirePermissions(PermissionCode.ATTENDANCE_UPDATE)
  ajusteManual(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjustarManualDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.registro.ajustarManual(
      id,
      dto.horaEntrada,
      dto.horaSalida,
      dto.motivo,
      user.id,
      dto.geo,
    );
  }

  @Patch(':id/observation')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  observacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObservacionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.registro.agregarObservacion(id, dto.observacion, user.id);
  }

  @Post('sessions/:jornadaId/scan-qr')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  escanearQr(
    @Param('jornadaId', ParseIntPipe) jornadaId: number,
    @Body() dto: ScanQrDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.registro.escanearQr(jornadaId, dto.qrCode, user.id, dto.geo);
  }

  @Post('sessions/:jornadaId/persons/:personaId/observation')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  observacionPersona(
    @Param('jornadaId', ParseIntPipe) jornadaId: number,
    @Param('personaId', ParseIntPipe) personaId: number,
    @Body() dto: ObservacionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.registro.agregarObservacionPersona(jornadaId, personaId, dto.observacion, user.id);
  }

  // ---------- Cierre ----------

  @Post('sessions/:jornadaId/close')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  cerrarJornada(
    @Param('jornadaId', ParseIntPipe) jornadaId: number,
    @Body() body: { convertirPendientes?: boolean },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.cierre.cerrar(jornadaId, user.id, body?.convertirPendientes === true);
  }
}
