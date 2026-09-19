import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { RegistroService } from './services/registro.service';
import { IncidenciasService } from './services/incidencias.service';
import { CierreJornadaService } from './services/cierre-jornada.service';
import { GeoService } from './services/geo.service';
import { AuditModule } from '../audit/audit.module';
import { GroupsModule } from '../groups/groups.module';
import { Asistencia } from './entities/asistencia.entity';
import { AsistenciaUbicacion } from './entities/asistencia-ubicacion.entity';
import { Justificacion } from './entities/justificacion.entity';
import { Jornada } from '../sessions/entities/jornada.entity';
import { GrupoIntegrante } from '../groups/entities/grupo-integrante.entity';
import { Sede } from '../persons/entities/catalogos.entity';
import { Persona } from '../persons/entities/persona.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asistencia,
      AsistenciaUbicacion,
      Justificacion,
      Jornada,
      GrupoIntegrante,
      Sede,
      Persona,
    ]),
    GroupsModule,
    AuditModule,
  ],
  controllers: [AttendanceController],
  providers: [RegistroService, IncidenciasService, CierreJornadaService, GeoService],
  exports: [RegistroService],
})
export class AttendanceModule {}
