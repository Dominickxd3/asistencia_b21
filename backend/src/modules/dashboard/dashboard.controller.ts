import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { FECHA_REGEX } from '../../common/utils/fecha.util';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('today')
  @RequirePermissions(PermissionCode.INICIO_VIEW)
  @ApiQuery({ name: 'fecha', required: false, description: 'YYYY-MM-DD (por defecto, hoy)' })
  hoy(@Query('fecha') fecha: string | undefined, @CurrentUser() user: CurrentUserData) {
    if (fecha !== undefined && !FECHA_REGEX.test(fecha)) {
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    }
    return this.dashboard.resumenDelDia(fecha, user.id);
  }
}
