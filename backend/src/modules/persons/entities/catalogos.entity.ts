import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('companias')
export class Compania {
  @PrimaryGeneratedColumn({ name: 'compania_id' })
  id: number;

  @Column({ name: 'nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'codigo', type: 'nvarchar', length: 50, nullable: true })
  codigo: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;
}

@Entity('etapas_formacion')
export class EtapaFormacion {
  @PrimaryGeneratedColumn({ name: 'etapa_id' })
  id: number;

  /** POSTULANTE | ASPIRANTE_COMPANIA | ASPIRANTE_ESBAS */
  @Column({ name: 'codigo', type: 'varchar', length: 60 })
  codigo: string;

  @Column({ name: 'nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'orden', type: 'int' })
  orden: number;

  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;
}

@Entity('sedes')
export class Sede {
  @PrimaryGeneratedColumn({ name: 'sede_id' })
  id: number;

  @Column({ name: 'compania_id', type: 'int' })
  companiaId: number;

  @Column({ name: 'nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'latitud', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ name: 'longitud', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  @Column({ name: 'radio_geocerca_metros', type: 'decimal', precision: 10, scale: 2, nullable: true })
  radioGeocercaMetros: number | null;

  /** BLOQUEAR | JUSTIFICAR | ADVERTIR */
  @Column({ name: 'politica_fuera_zona', type: 'varchar', length: 30 })
  politicaFueraZona: string;

  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;
}
