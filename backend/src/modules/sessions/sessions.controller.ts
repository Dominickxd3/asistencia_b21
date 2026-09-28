import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JornadasService } from './jornadas.service';
import { CreateJornadaDto } from './dto/jornada.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { FECHA_REGEX } from '../../common/utils/fecha.util';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class JornadasController {
  constructor(private readonly jornadas: JornadasService) {}

  /** Jornadas de una fecha (por defecto, hoy según el reloj de SQL Server) */
  @Get()
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW)
  async listarPorFecha(@Query('fecha') fecha: string | undefined, @CurrentUser() user: CurrentUserData) {
    if (fecha !== undefined && !FECHA_REGEX.test(fecha)) {
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    }
    const fechaObjetivo = fecha ?? (await this.jornadas.fechaHoy());
    return this.jornadas.listarPorFecha(fechaObjetivo, user.id);
  }

  @Post()
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_GROUPS)
  crear(@Body() dto: CreateJornadaDto, @CurrentUser() user: CurrentUserData) {
    return this.jornadas.crear(dto, user.id);
  }

  @Post(':id/open')
  @RequirePermissions(PermissionCode.ATTENDANCE_REGISTER)
  abrir(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: CurrentUserData) {
    return this.jornadas.abrir(id, user.id);
  }
}
