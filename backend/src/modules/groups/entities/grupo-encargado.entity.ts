import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GrupoFormacion } from './grupo-formacion.entity';
import { Usuario } from '../../users/entities/usuario.entity';

/** Encargado dinamico de grupo: historial completo con vigencias. */
@Entity('grupo_encargados')
export class GrupoEncargado {
  @PrimaryGeneratedColumn({ name: 'grupo_encargado_id' })
  id: number;

  @Column({ name: 'grupo_id', type: 'int' })
  @Index()
  grupoId: number;

  @Column({ name: 'usuario_id', type: 'int' })
  @Index()
  usuarioId: number;

  @ManyToOne(() => GrupoFormacion, (g) => g.encargados)
  @JoinColumn({ name: 'grupo_id' })
  grupo: GrupoFormacion;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'fecha_inicio', type: 'datetime2' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'datetime2', nullable: true })
  fechaFin: Date | null;

  /** ACTIVO | FINALIZADO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'asignado_por_usuario_id', type: 'int', nullable: true })
  asignadoPorUsuarioId: number | null;

  @Column({ name: 'motivo_finalizacion', type: 'nvarchar', length: 300, nullable: true })
  motivoFinalizacion: string | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;
}
