import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JornadasController } from './sessions.controller';
import { JornadasService } from './jornadas.service';
import { AuditModule } from '../audit/audit.module';
import { GroupsModule } from '../groups/groups.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { Jornada } from './entities/jornada.entity';
import { Programacion, ProgramacionDetalle } from './entities/programacion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Jornada, Programacion, ProgramacionDetalle]),
    GroupsModule,
    AuditModule,
    RealtimeModule,
  ],
  controllers: [JornadasController],
  providers: [JornadasService],
  exports: [JornadasService],
})
export class SessionsModule {}
