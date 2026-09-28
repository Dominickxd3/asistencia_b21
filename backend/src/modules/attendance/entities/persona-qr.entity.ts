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

@Entity('persona_qr')
export class PersonaQr {
  @PrimaryGeneratedColumn({ name: 'persona_qr_id', type: 'bigint' })
  id: number;

  @Column({ name: 'persona_id', type: 'int', unique: true })
  personaId: number;

  @ManyToOne(() => Persona)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  /** Identificador aleatorio impreso en la credencial; nunca usa el persona_id. */
  @Column({ name: 'codigo', type: 'varchar', length: 36, unique: true })
  @Index({ unique: true })
  codigo: string;

  /** ACTIVO | REVOCADO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'generado_por_usuario_id', type: 'int', nullable: true })
  generadoPorUsuarioId: number | null;

  @CreateDateColumn({ name: 'fecha_generacion', type: 'datetime2' })
  fechaGeneracion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime2', nullable: true })
  fechaActualizacion: Date | null;
}
