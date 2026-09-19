import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { GenerarReporteDto } from './dto/reporte.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('history')
  @RequirePermissions(PermissionCode.REPORTS_VIEW)
  historial() {
    return this.reports.historial();
  }

  @Get('journeys')
  @RequirePermissions(PermissionCode.REPORTS_VIEW)
  jornadas(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reports.jornadas(desde, hasta);
  }

  @Post('generate')
  @RequirePermissions(PermissionCode.REPORTS_GENERATE)
  async generar(@Body() dto: GenerarReporteDto, @CurrentUser() user: CurrentUserData, @Res() res: Response) {
    const { pdf, nombre } = await this.reports.generar(dto, user.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  @Post('generate-excel')
  @RequirePermissions(PermissionCode.REPORTS_GENERATE)
  async generarExcel(@Body() dto: GenerarReporteDto, @CurrentUser() user: CurrentUserData, @Res() res: Response) {
    const { archivo, nombre } = await this.reports.generarExcel(dto, user.id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Content-Length': archivo.length,
    });
    res.send(archivo);
  }
}
