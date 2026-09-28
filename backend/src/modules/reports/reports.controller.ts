import { Body, Controller, Get, Post, Res } from '@nestjs/common';
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

  @Get('recent')
  @RequirePermissions(PermissionCode.REPORTS_VIEW)
  recientes() {
    return this.reports.recientes();
  }

  @Post('generate')
  @RequirePermissions(PermissionCode.REPORTS_GENERATE)
  async generar(@Body() dto: GenerarReporteDto, @CurrentUser() user: CurrentUserData, @Res() res: Response) {
    const { archivo, nombre, mime } = await this.reports.generar(dto, user.id);
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Content-Length': archivo.length,
    });
    res.send(archivo);
  }
}
