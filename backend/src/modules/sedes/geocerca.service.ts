import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from './entities/sede.entity';
import { GrupoFormacion } from '../groups/entities/grupo-formacion.entity';
import { EstadoGeografico, clasificar, posicionRespectoPoligono } from './geocerca.util';

/** Ubicación reportada por el navegador */
export interface UbicacionDispositivo {
  latitud: number;
  longitud: number;
  precisionMetros?: number;
  capturadoEn?: string;
}

/** Resultado auditable de la validación geográfica */
export interface EvaluacionGeografica {
  estado: EstadoGeografico;
  sedeId: number | null;
  sedeNombre: string | null;
  politica: string | null;
  latitud: number | null;
  longitud: number | null;
  precisionMetros: number | null;
  /** Distancia al perímetro (0 si está dentro); null si no se pudo evaluar */
  distanciaMetros: number | null;
  toleranciaMetros: number | null;
  capturadoEn: string | null;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Validación geográfica única del sistema. Todos los registros de asistencia
 * (1 clic, hora manual, salidas, incidencias y el futuro registro por QR) deben
 * pasar por aquí: la validación es del backend, nunca solo del navegador.
 */
@Injectable()
export class GeocercaService {
  constructor(
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectRepository(GrupoFormacion)
    private readonly grupoRepo: Repository<GrupoFormacion>,
  ) {}

  /** Sede aplicable: la del grupo, o la principal activa de la compañía */
  async sedeDeGrupo(grupoId: number): Promise<Sede | null> {
    const grupo = await this.grupoRepo.findOne({ where: { id: grupoId } });
    if (!grupo) return null;
    if (grupo.sedeId) {
      const propia = await this.cargarSede(grupo.sedeId);
      if (propia && propia.estado === 'ACTIVO') return propia;
    }
    const principal = await this.sedeRepo.findOne({
      where: { companiaId: grupo.companiaId, estado: 'ACTIVO' },
      order: { esPrincipal: 'DESC', id: 'ASC' },
    });
    return principal ? this.cargarSede(principal.id) : null;
  }

  async cargarSede(sedeId: number): Promise<Sede | null> {
    const sede = await this.sedeRepo.findOne({ where: { id: sedeId }, relations: { vertices: true } });
    if (sede) sede.vertices = [...(sede.vertices ?? [])].sort((a, b) => a.orden - b.orden);
    return sede;
  }

  async evaluarParaGrupo(grupoId: number, geo?: UbicacionDispositivo): Promise<EvaluacionGeografica> {
    return this.evaluar(await this.sedeDeGrupo(grupoId), geo);
  }

  /** Clasifica un punto respecto del polígono de la sede, tolerando el error del GPS */
  evaluar(sede: Sede | null, geo?: UbicacionDispositivo): EvaluacionGeografica {
    const base: EvaluacionGeografica = {
      estado: 'NO_DISPONIBLE',
      sedeId: sede?.id ?? null,
      sedeNombre: sede?.nombre ?? null,
      politica: sede?.politicaFueraZona ?? null,
      latitud: geo?.latitud ?? null,
      longitud: geo?.longitud ?? null,
      precisionMetros: geo?.precisionMetros != null ? redondear(geo.precisionMetros) : null,
      distanciaMetros: null,
      toleranciaMetros: sede?.toleranciaMetros ?? null,
      capturadoEn: geo?.capturadoEn ?? null,
    };
    if (!geo) return base;

    const vertices = sede?.vertices ?? [];
    if (!sede || !sede.validacionActiva || sede.tipoGeocerca !== 'POLYGON' || vertices.length < 3) {
      return { ...base, estado: 'SIN_GEOCERCA' };
    }

    const posicion = posicionRespectoPoligono(geo, vertices);
    return {
      ...base,
      distanciaMetros: redondear(posicion.distanciaMetros),
      estado: clasificar({
        dentro: posicion.dentro,
        distanciaMetros: posicion.distanciaMetros,
        precisionMetros: geo.precisionMetros ?? null,
        toleranciaMetros: sede.toleranciaMetros,
        precisionMaximaMetros: sede.precisionMaximaMetros,
      }),
    };
  }
}
