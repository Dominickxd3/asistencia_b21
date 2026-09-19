import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JornadasService } from './jornadas.service';
import { CreateJornadaDto } from './dto/jornada.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class JornadasController {
  constructor(private readonly jornadas: JornadasService) {}

  @Get()
  @RequirePermissions(PermissionCode.ATTENDANCE_VIEW)
  listarPorFecha(@Query('fecha') fecha: string | undefined, @CurrentUser() user: CurrentUserData) {
    const fechaObjetivo = fecha ?? new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
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
