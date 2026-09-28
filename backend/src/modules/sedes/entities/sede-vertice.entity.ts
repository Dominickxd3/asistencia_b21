import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sede, decimal } from './sede.entity';

/** Vértice del perímetro de la geocerca; el polígono se cierra uniendo el último con el primero. */
@Entity('sede_geocerca_vertices')
export class SedeVertice {
  @PrimaryGeneratedColumn({ name: 'vertice_id' })
  id: number;

  @Column({ name: 'sede_id', type: 'int' })
  sedeId: number;

  @ManyToOne(() => Sede, (s) => s.vertices)
  @JoinColumn({ name: 'sede_id' })
  sede: Sede;

  @Column({ name: 'orden', type: 'int' })
  orden: number;

  @Column({ name: 'latitud', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  latitud: number;

  @Column({ name: 'longitud', type: 'decimal', precision: 10, scale: 7, transformer: decimal })
  longitud: number;
}
