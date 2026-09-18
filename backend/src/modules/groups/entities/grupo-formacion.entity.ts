import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EtapaFormacion, Compania } from '../../persons/entities/catalogos.entity';
import { GrupoIntegrante } from './grupo-integrante.entity';
import { GrupoEncargado } from './grupo-encargado.entity';

@Entity('grupos_formacion')
export class GrupoFormacion {
  @PrimaryGeneratedColumn({ name: 'grupo_id' })
  id: number;

  @Column({ name: 'compania_id', type: 'int' })
  companiaId: number;

  @ManyToOne(() => Compania)
  @JoinColumn({ name: 'compania_id' })
  compania: Compania;

  @Column({ name: 'etapa_id', type: 'int' })
  etapaId: number;

  @ManyToOne(() => EtapaFormacion)
  @JoinColumn({ name: 'etapa_id' })
  etapa: EtapaFormacion;

  @Column({ name: 'codigo', type: 'varchar', length: 60, unique: true })
  codigo: string;

  @Column({ name: 'nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'periodo', type: 'nvarchar', length: 30 })
  periodo: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  /** ACTIVO | CERRADO | CANCELADO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'creado_por_usuario_id', type: 'int', nullable: true })
  creadoPorUsuarioId: number | null;

  @OneToMany(() => GrupoIntegrante, (gi) => gi.grupo)
  integrantes: GrupoIntegrante[];

  @OneToMany(() => GrupoEncargado, (ge) => ge.grupo)
  encargados: GrupoEncargado[];

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime2', nullable: true })
  fechaActualizacion: Date | null;
}
