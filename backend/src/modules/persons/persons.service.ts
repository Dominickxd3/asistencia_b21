import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async listar(busqueda?: string, pagina = 1, tamano = 25, etapa?: string) {
    const limite = Math.min(Math.max(tamano, 1), 100);
    const paginaActual = Math.max(pagina, 1);
    const parametros: unknown[] = [];
    const filtros = [`p.estado = 'ACTIVO'`];
    if (busqueda?.trim()) {
      parametros.push(`%${busqueda.trim()}%`);
      const i = parametros.length - 1;
      filtros.push(`(p.dni LIKE @${i} OR p.nombres LIKE @${i} OR p.apellido_paterno LIKE @${i} OR p.apellido_materno LIKE @${i})`);
    }
    if (etapa?.trim()) {
      parametros.push(etapa.trim());
      filtros.push(`e.codigo = @${parametros.length - 1}`);
    }
    const where = filtros.join(' AND ');
    const [conteo] = await this.personaRepo.query(
      `SELECT COUNT(DISTINCT p.persona_id) AS total
       FROM personas p
       LEFT JOIN persona_etapas pe ON pe.persona_id = p.persona_id AND pe.estado = 'ACTIVO'
       LEFT JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       WHERE ${where}`,
      parametros,
    );
    parametros.push((paginaActual - 1) * limite, limite);
    const offsetIndex = parametros.length - 2;
    const limiteIndex = parametros.length - 1;
    const items = await this.personaRepo.query(
      `SELECT p.persona_id AS id, p.dni, p.nombres,
              p.apellido_paterno AS apellidoPaterno, p.apellido_materno AS apellidoMaterno,
              p.telefono, p.correo, p.estado,
              e.codigo AS etapaCodigo, e.nombre AS etapaNombre,
              g.nombre AS grupo
       FROM personas p
       LEFT JOIN persona_etapas pe ON pe.persona_id = p.persona_id AND pe.estado = 'ACTIVO'
       LEFT JOIN etapas_formacion e ON e.etapa_id = pe.etapa_id
       LEFT JOIN grupos_formacion g ON g.grupo_id = pe.grupo_id
       WHERE ${where}
       ORDER BY p.apellido_paterno, p.apellido_materno, p.nombres
       OFFSET @${offsetIndex} ROWS FETCH NEXT @${limiteIndex} ROWS ONLY`,
      parametros,
    );
    return { items, total: Number(conteo?.total ?? 0), pagina: paginaActual, tamano: limite };
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
