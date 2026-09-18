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
import { Persona } from '../../persons/entities/persona.entity';

@Entity('grupo_integrantes')
export class GrupoIntegrante {
  @PrimaryGeneratedColumn({ name: 'grupo_integrante_id' })
  id: number;

  @Column({ name: 'grupo_id', type: 'int' })
  @Index()
  grupoId: number;

  @Column({ name: 'persona_id', type: 'int' })
  @Index()
  personaId: number;

  @ManyToOne(() => GrupoFormacion, (g) => g.integrantes)
  @JoinColumn({ name: 'grupo_id' })
  grupo: GrupoFormacion;

  @ManyToOne(() => Persona)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  /** ACTIVO | FINALIZADO | RETIRADO | SUSPENDIDO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'motivo_salida', type: 'nvarchar', length: 300, nullable: true })
  motivoSalida: string | null;

  @Column({ name: 'creado_por_usuario_id', type: 'int', nullable: true })
  creadoPorUsuarioId: number | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;
}
