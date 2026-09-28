import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sede } from './entities/sede.entity';
import { SedeVertice } from './entities/sede-vertice.entity';
import { GrupoFormacion } from '../groups/entities/grupo-formacion.entity';
import { GeocercaService } from './geocerca.service';
import { SedesService } from './sedes.service';
import { SedesController } from './sedes.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sede, SedeVertice, GrupoFormacion]), AuditModule],
  controllers: [SedesController],
  providers: [GeocercaService, SedesService],
  exports: [GeocercaService],
})
export class SedesModule {}
