import { Body, Controller, Post, Res } from '@nestjs/common';
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
}
