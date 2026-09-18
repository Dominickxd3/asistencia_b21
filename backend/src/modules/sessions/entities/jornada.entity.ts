import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GrupoFormacion } from '../../groups/entities/grupo-formacion.entity';

/** Jornada de instruccion. Estado: PROGRAMADA | ABIERTA | CERRADA | CANCELADA */
@Entity('jornadas')
export class Jornada {
  @PrimaryGeneratedColumn({ name: 'jornada_id', type: 'bigint' })
  id: number;

  @Column({ name: 'grupo_id', type: 'int' })
  @Index()
  grupoId: number;

  @ManyToOne(() => GrupoFormacion)
  @JoinColumn({ name: 'grupo_id' })
  grupo: GrupoFormacion;

  @Column({ name: 'programacion_detalle_id', type: 'int', nullable: true })
  programacionDetalleId: number | null;

  @Column({ name: 'fecha', type: 'date' })
  @Index()
  fecha: string;

  @Column({ name: 'fecha_hora_inicio_programada', type: 'datetime2', nullable: true })
  inicioProgramada: Date | null;

  @Column({ name: 'fecha_hora_fin_programada', type: 'datetime2', nullable: true })
  finProgramada: Date | null;

  /** OBLIGATORIA | VOLUNTARIA */
  @Column({ name: 'tipo_jornada', type: 'varchar', length: 20 })
  tipoJornada: string;

  /** PROGRAMADA | EXTRAORDINARIA */
  @Column({ name: 'origen', type: 'varchar', length: 20 })
  origen: string;

  @Column({ name: 'titulo', type: 'nvarchar', length: 180, nullable: true })
  titulo: string | null;

  @Column({ name: 'observacion', type: 'nvarchar', length: 500, nullable: true })
  observacion: string | null;

  /** PROGRAMADA | ABIERTA | CERRADA | CANCELADA */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'abierta_por_usuario_id', type: 'int', nullable: true })
  abiertaPorUsuarioId: number | null;

  @Column({ name: 'cerrada_por_usuario_id', type: 'int', nullable: true })
  cerradaPorUsuarioId: number | null;

  @Column({ name: 'fecha_apertura', type: 'datetime2', nullable: true })
  fechaApertura: Date | null;

  @Column({ name: 'fecha_cierre', type: 'datetime2', nullable: true })
  fechaCierre: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;
}
