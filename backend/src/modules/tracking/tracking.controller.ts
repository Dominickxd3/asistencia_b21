import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { TrackingQueryDto } from './dto/tracking.dto';
import { RequirePermissions } from '../auth/decorators/auth.decorators';
import { PermissionCode } from '../../common/constants/permissions.constants';

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get()
  @RequirePermissions(PermissionCode.TRACKING_VIEW)
  resumen(@Query() query: TrackingQueryDto) {
    return this.tracking.resumen(query);
  }
}
