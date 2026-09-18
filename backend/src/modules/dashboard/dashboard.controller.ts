import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('today')
  @RequirePermissions(PermissionCode.INICIO_VIEW)
  hoy(
    @Query('fecha') fecha?: string,
    @Query('mes') mes?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('La fecha debe usar el formato YYYY-MM-DD');
    }
    if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
      throw new BadRequestException('El mes debe usar el formato YYYY-MM');
    }
    if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
      throw new BadRequestException('La fecha inicial debe usar el formato YYYY-MM-DD');
    }
    if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      throw new BadRequestException('La fecha final debe usar el formato YYYY-MM-DD');
    }
    return this.dashboard.hoy(fecha, mes, desde, hasta);
  }
}
