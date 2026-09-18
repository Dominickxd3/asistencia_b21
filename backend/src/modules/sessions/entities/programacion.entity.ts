import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GrupoFormacion } from '../../groups/entities/grupo-formacion.entity';

/** Horario vigente por temporada. Nunca se sobrescribe: se cierra con fecha_fin. */
@Entity('programaciones')
export class Programacion {
  @PrimaryGeneratedColumn({ name: 'programacion_id' })
  id: number;

  @Column({ name: 'grupo_id', type: 'int' })
  @Index()
  grupoId: number;

  @ManyToOne(() => GrupoFormacion)
  @JoinColumn({ name: 'grupo_id' })
  grupo: GrupoFormacion;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  /** ACTIVO | FINALIZADO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'creado_por_usuario_id', type: 'int', nullable: true })
  creadoPorUsuarioId: number | null;

  @OneToMany(() => ProgramacionDetalle, (d) => d.programacion)
  detalles: ProgramacionDetalle[];

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;
}

@Entity('programacion_detalles')
export class ProgramacionDetalle {
  @PrimaryGeneratedColumn({ name: 'programacion_detalle_id' })
  id: number;

  @Column({ name: 'programacion_id', type: 'int' })
  programacionId: number;

  @ManyToOne(() => Programacion, (p) => p.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programacion_id' })
  programacion: Programacion;

  /** 1 = lunes ... 7 = domingo */
  @Column({ name: 'dia_semana', type: 'tinyint' })
  diaSemana: number;

  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  horaInicio: string | null;

  @Column({ name: 'hora_fin', type: 'time', nullable: true })
  horaFin: string | null;

  /** OBLIGATORIA | VOLUNTARIA */
  @Column({ name: 'tipo_jornada', type: 'varchar', length: 20 })
  tipoJornada: string;

  /** ACTIVO | INACTIVO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;
}
