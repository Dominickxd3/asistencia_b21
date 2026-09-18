import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { AuditModule } from '../audit/audit.module';
import { GrupoFormacion } from './entities/grupo-formacion.entity';
import { GrupoIntegrante } from './entities/grupo-integrante.entity';
import { GrupoEncargado } from './entities/grupo-encargado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GrupoFormacion, GrupoIntegrante, GrupoEncargado]),
    AuditModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
