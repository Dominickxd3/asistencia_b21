import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FormationService } from './formation.service';
import { ActualizarHistorialDto, CorregirPromocionDto, PromoverDto } from './dto/formacion.dto';
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

  @Post('promotion/correct')
  @RequirePermissions(PermissionCode.FORMATION_PROMOTE)
  corregirPromocion(@Body() dto: CorregirPromocionDto, @CurrentUser() user: CurrentUserData) {
    return this.formation.corregirUltimaPromocion(dto, user.id);
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

  @Patch('historial/:id')
  @RequirePermissions(PermissionCode.FORMATION_PROMOTE)
  actualizarHistorial(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarHistorialDto, @CurrentUser() user: CurrentUserData) {
    return this.formation.actualizarHistorial(id, dto, user.id);
  }
}
