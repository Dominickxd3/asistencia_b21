import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SedeVertice } from './sede-vertice.entity';

/** Transformer: SQL Server devuelve DECIMAL como string con msnodesqlv8 */
export const decimal = {
  to: (v: number | null) => v,
  from: (v: string | number | null) => (v === null || v === undefined ? null : Number(v)),
};

/**
 * Sede de la compañía y la configuración de su geocerca.
 * La geocerca es un polígono (tipo POLYGON) cuyos vértices están en sede_geocerca_vertices.
 */
@Entity('sedes')
export class Sede {
  @PrimaryGeneratedColumn({ name: 'sede_id' })
  id: number;

  @Column({ name: 'compania_id', type: 'int' })
  companiaId: number;

  @Column({ name: 'nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'direccion', type: 'nvarchar', length: 250, nullable: true })
  direccion: string | null;

  /** Centro de referencia (centroide del polígono); solo para centrar el mapa */
  @Column({ name: 'latitud', type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimal })
  latitud: number | null;

  @Column({ name: 'longitud', type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimal })
  longitud: number | null;

  /** Legado de la geocerca circular; no se usa con POLYGON */
  @Column({ name: 'radio_geocerca_metros', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimal })
  radioGeocercaMetros: number | null;

  /** POLYGON | CIRCLE */
  @Column({ name: 'tipo_geocerca', type: 'varchar', length: 20 })
  tipoGeocerca: string;

  @Column({ name: 'validacion_geografica_activa', type: 'bit' })
  validacionActiva: boolean;

  /** Distancia fuera del borde que aún se considera "dentro" */
  @Column({ name: 'tolerancia_metros', type: 'decimal', precision: 8, scale: 2, transformer: decimal })
  toleranciaMetros: number;

  /** Precisión GPS peor que este valor → "precisión insuficiente" */
  @Column({ name: 'precision_maxima_metros', type: 'decimal', precision: 8, scale: 2, transformer: decimal })
  precisionMaximaMetros: number;

  /** ADVERTIR | JUSTIFICAR | BLOQUEAR */
  @Column({ name: 'politica_fuera_zona', type: 'varchar', length: 30 })
  politicaFueraZona: string;

  @Column({ name: 'es_principal', type: 'bit' })
  esPrincipal: boolean;

  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'fecha_actualizacion', type: 'datetime2', nullable: true })
  fechaActualizacion: Date | null;

  @OneToMany(() => SedeVertice, (v) => v.sede)
  vertices: SedeVertice[];
}
