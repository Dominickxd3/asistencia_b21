import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Persona } from './entities/persona.entity';
import { CreatePersonaDto, UpdatePersonaDto } from './dto/persona.dto';
import { AuditoriaService } from '../audit/auditoria.service';

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepo: Repository<Persona>,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(busqueda?: string, pagina = 1, tamano = 25) {
    const where = busqueda
      ? [
          { nombres: ILike(`%${busqueda}%`), estado: 'ACTIVO' },
          { apellidoPaterno: ILike(`%${busqueda}%`), estado: 'ACTIVO' },
          { apellidoMaterno: ILike(`%${busqueda}%`), estado: 'ACTIVO' },
          { dni: ILike(`%${busqueda}%`), estado: 'ACTIVO' },
        ]
      : { estado: 'ACTIVO' };

    const [items, total] = await this.personaRepo.findAndCount({
      where,
      order: { apellidoPaterno: 'ASC', nombres: 'ASC' },
      skip: (pagina - 1) * tamano,
      take: tamano,
    });
    return { items, total, pagina, tamano };
  }

  async crear(dto: CreatePersonaDto, usuarioId: number): Promise<Persona> {
    if (dto.dni) {
      const existente = await this.personaRepo.findOne({ where: { dni: dto.dni, companiaId: 1 } });
      if (existente) {
        throw new ConflictException(`Ya existe una persona con DNI ${dto.dni}: ${existente.nombreCompleto}`);
      }
    }
    const persona = await this.personaRepo.save(
      this.personaRepo.create({ ...dto, companiaId: 1, estado: 'ACTIVO' }),
    );
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PERSON_CREATED',
      modulo: 'persons',
      entidad: 'personas',
      entidadId: persona.id,
      valorNuevo: { nombres: persona.nombres, apellidoPaterno: persona.apellidoPaterno, dni: persona.dni },
    });
    return persona;
  }

  async actualizar(id: number, dto: UpdatePersonaDto, usuarioId: number): Promise<Persona> {
    const persona = await this.personaRepo.findOne({ where: { id } });
    if (!persona) throw new NotFoundException('Persona no encontrada');
    const anterior = { ...persona };
    Object.assign(persona, dto);
    const guardada = await this.personaRepo.save(persona);
    await this.auditoria.registrar({
      usuarioId,
      accion: 'PERSON_UPDATED',
      modulo: 'persons',
      entidad: 'personas',
      entidadId: id,
      valorAnterior: anterior,
      valorNuevo: guardada,
    });
    return guardada;
  }

  async obtener(id: number): Promise<Persona> {
    const persona = await this.personaRepo.findOne({ where: { id } });
    if (!persona) throw new NotFoundException('Persona no encontrada');
    return persona;
  }
}
