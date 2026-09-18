import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { AuditModule } from '../audit/audit.module';
import { Persona } from './entities/persona.entity';
import { PersonaEtapa } from './entities/persona-etapa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Persona, PersonaEtapa]), AuditModule],
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
})
export class PersonsModule {}
