import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FormationService } from './formation.service';
import { PromoverDto } from './dto/formacion.dto';
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
}
