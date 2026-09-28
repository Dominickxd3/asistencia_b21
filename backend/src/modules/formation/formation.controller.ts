import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { FormationService } from './formation.service';
import { PromoverDto, CrearHistorialDto, ActualizarHistorialDto } from './dto/formacion.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('formation')
@ApiBearerAuth()
@Controller('formation')
export class FormationController {
  constructor(private readonly formation: FormationService) {}

  @Post('promote')
  @RequirePermissions(PermissionCode.FORMATION_PROMOTE)
  promover(@Body() dto: PromoverDto, @CurrentUser() user: CurrentUserData) {
    return this.formation.promover(dto, user.id);
  }

  @Get('catalogos')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  catalogos() {
    return this.formation.catalogos();
  }

  @Get('personas/:id/historial')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.formation.historial(id);
  }

  @Get('historial')
  @RequirePermissions(PermissionCode.FORMATION_VIEW)
  historialGeneral() {
    return this.formation.historialGeneral();
  }

  @Post('historial')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  crearHistorial(
    @Body() dto: CrearHistorialDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    // Con «trust proxy» configurado, req.ip ya es la IP real; X-Forwarded-For solo lo decide el proxy
    const ip = req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    return this.formation.crearHistorial(dto, user.id, ip, userAgent);
  }

  @Put('historial/:id')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  actualizarHistorial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarHistorialDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    // Con «trust proxy» configurado, req.ip ya es la IP real; X-Forwarded-For solo lo decide el proxy
    const ip = req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    return this.formation.actualizarHistorial(id, dto, user.id, ip, userAgent);
  }

  @Delete('historial/:id')
  @RequirePermissions(PermissionCode.FORMATION_MANAGE_PEOPLE)
  eliminarHistorial(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    // Con «trust proxy» configurado, req.ip ya es la IP real; X-Forwarded-For solo lo decide el proxy
    const ip = req.ip ?? null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    return this.formation.eliminarHistorial(id, user.id, ip, userAgent);
  }
}

