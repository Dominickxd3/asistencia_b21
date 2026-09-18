import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Asistencia } from './asistencia.entity';
import { Usuario } from '../../users/entities/usuario.entity';

/** Justificacion asociada a una asistencia (falta o salida anticipada). */
@Entity('justificaciones')
export class Justificacion {
  @PrimaryGeneratedColumn({ name: 'justificacion_id', type: 'bigint' })
  id: number;

  @Column({ name: 'asistencia_id', type: 'bigint' })
  asistenciaId: number;

  @ManyToOne(() => Asistencia)
  @JoinColumn({ name: 'asistencia_id' })
  asistencia: Asistencia;

  /** FALTA | SALIDA_ANTICIPADA | OTRA */
  @Column({ name: 'tipo', type: 'varchar', length: 30 })
  tipo: string;

  @Column({ name: 'descripcion', type: 'nvarchar', length: 1000 })
  descripcion: string;

  /** PENDIENTE | APROBADA | RECHAZADA */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'registrado_por_usuario_id', type: 'int' })
  registradoPorUsuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'registrado_por_usuario_id' })
  registradoPor: Usuario;

  @Column({ name: 'aprobado_por_usuario_id', type: 'int', nullable: true })
  aprobadoPorUsuarioId: number | null;

  @CreateDateColumn({ name: 'fecha_registro', type: 'datetime2' })
  fechaRegistro: Date;

  @Column({ name: 'fecha_resolucion', type: 'datetime2', nullable: true })
  fechaResolucion: Date | null;
}
