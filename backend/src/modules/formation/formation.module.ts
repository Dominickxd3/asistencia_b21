import { Module } from '@nestjs/common';
import { FormationController } from './formation.controller';
import { FormationService } from './formation.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FormationController],
  providers: [FormationService],
})
export class FormationModule {}
