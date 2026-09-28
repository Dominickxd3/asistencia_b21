import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { RegistroService } from './services/registro.service';
import { IncidenciasService } from './services/incidencias.service';
import { CierreJornadaService } from './services/cierre-jornada.service';
import { SedesModule } from '../sedes/sedes.module';
import { AuditModule } from '../audit/audit.module';
import { GroupsModule } from '../groups/groups.module';
import { Asistencia } from './entities/asistencia.entity';
import { AsistenciaUbicacion } from './entities/asistencia-ubicacion.entity';
import { Justificacion } from './entities/justificacion.entity';
import { Jornada } from '../sessions/entities/jornada.entity';
import { GrupoIntegrante } from '../groups/entities/grupo-integrante.entity';
import { PersonaQr } from './entities/persona-qr.entity';
import { QrAsistenciaService } from './services/qr-asistencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asistencia,
      AsistenciaUbicacion,
      Justificacion,
      Jornada,
      GrupoIntegrante,
      PersonaQr,
    ]),
    GroupsModule,
    SedesModule,
    AuditModule,
  ],
  controllers: [AttendanceController],
  providers: [RegistroService, IncidenciasService, CierreJornadaService, QrAsistenciaService],
  exports: [RegistroService],
})
export class AttendanceModule {}
