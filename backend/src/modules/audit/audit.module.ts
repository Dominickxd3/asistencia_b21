import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auditoria } from './entities/auditoria.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Auditoria])],
  controllers: [AuditController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditModule {}
