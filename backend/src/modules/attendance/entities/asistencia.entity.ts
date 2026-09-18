import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Persona } from '../../persons/entities/persona.entity';
import { Jornada } from '../../sessions/entities/jornada.entity';
import { Usuario } from '../../users/entities/usuario.entity';

/**
 * Registro de asistencia. Nunca se elimina fisicamente:
 * una anulacion marca estado ANULADO y conserva trazabilidad.
 */
@Entity('asistencias')
@Index(['jornadaId', 'personaId'])
export class Asistencia {
  @PrimaryGeneratedColumn({ name: 'asistencia_id', type: 'bigint' })
  id: number;

  @Column({ name: 'jornada_id', type: 'bigint' })
  jornadaId: number;

  @Column({ name: 'persona_id', type: 'int' })
  personaId: number;

  @ManyToOne(() => Jornada)
  @JoinColumn({ name: 'jornada_id' })
  jornada: Jornada;

  @ManyToOne(() => Persona)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  @Column({ name: 'fecha_hora_entrada', type: 'datetime2', nullable: true })
  fechaHoraEntrada: Date | null;

  @Column({ name: 'fecha_hora_salida', type: 'datetime2', nullable: true })
  fechaHoraSalida: Date | null;

  /**
   * PENDIENTE | PRESENTE | FINALIZADO | FALTA_JUSTIFICADA |
   * FALTA_INJUSTIFICADA | SALIDA_ANTICIPADA | ANULADO
   */
  @Column({ name: 'estado_asistencia', type: 'varchar', length: 30 })
  estadoAsistencia: string;

  /** AUTOMATICO | MANUAL */
  @Column({ name: 'tipo_registro', type: 'varchar', length: 20 })
  tipoRegistro: string;

  @Column({ name: 'motivo_registro_manual', type: 'nvarchar', length: 500, nullable: true })
  motivoRegistroManual: string | null;

  @Column({ name: 'observacion', type: 'nvarchar', length: 500, nullable: true })
  observacion: string | null;

  /** Usuario que ejecuto el registro (quien registra, no el participante) */
  @Column({ name: 'registrado_por_usuario_id', type: 'int' })
  registradoPorUsuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'registrado_por_usuario_id' })
  registradoPor: Usuario;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime2', nullable: true })
  fechaActualizacion: Date | null;

  @Column({ name: 'anulado_por_usuario_id', type: 'int', nullable: true })
  anuladoPorUsuarioId: number | null;

  @Column({ name: 'fecha_anulacion', type: 'datetime2', nullable: true })
  fechaAnulacion: Date | null;

  @Column({ name: 'motivo_anulacion', type: 'nvarchar', length: 500, nullable: true })
  motivoAnulacion: string | null;
}
