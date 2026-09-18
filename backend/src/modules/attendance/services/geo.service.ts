import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sede } from '../../persons/entities/catalogos.entity';
import { GeoDto } from '../dto/asistencia.dto';

export interface GeoResultado {
  estado: 'DENTRO_ZONA' | 'FUERA_ZONA' | 'NO_DISPONIBLE';
  distanciaMetros: number | null;
}

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
  ) {}

  /** Evalúa la geolocalización del dispositivo contra la geocerca de la sede. */
  async evaluar(geo?: GeoDto): Promise<GeoResultado> {
    const sede = await this.sedeRepo.findOne({
      where: { companiaId: 1, estado: 'ACTIVO' },
    });

    if (!geo) {
      return { estado: 'NO_DISPONIBLE', distanciaMetros: null };
    }
    if (!sede || sede.latitud == null || sede.longitud == null) {
      // Sede sin coordenadas configuradas: no se puede evaluar la zona
      return { estado: 'NO_DISPONIBLE', distanciaMetros: null };
    }

    const distancia = this.haversine(
      geo.latitud,
      geo.longitud,
      sede.latitud,
      sede.longitud,
    );
    const radio = sede.radioGeocercaMetros ?? 150;
    return {
      estado: distancia <= radio ? 'DENTRO_ZONA' : 'FUERA_ZONA',
      distanciaMetros: Math.round(distancia * 100) / 100,
    };
  }

  /** Distancia en metros entre dos coordenadas (fórmula de Haversine) */
  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const toRad = (g: number) => (g * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
