import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Persona } from '../../persons/entities/persona.entity';
import { EtapaFormacion } from '../../persons/entities/catalogos.entity';
import { GrupoFormacion } from '../../groups/entities/grupo-formacion.entity';

/**
 * Historial de etapas de formacion de una persona.
 * La persona nunca se duplica al avanzar de etapa.
 */
@Entity('persona_etapas')
export class PersonaEtapa {
  @PrimaryGeneratedColumn({ name: 'persona_etapa_id' })
  id: number;

  @Column({ name: 'persona_id', type: 'int' })
  @Index()
  personaId: number;

  @Column({ name: 'etapa_id', type: 'int' })
  etapaId: number;

  @Column({ name: 'grupo_id', type: 'int', nullable: true })
  grupoId: number | null;

  @ManyToOne(() => Persona)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  @ManyToOne(() => EtapaFormacion)
  @JoinColumn({ name: 'etapa_id' })
  etapa: EtapaFormacion;

  @ManyToOne(() => GrupoFormacion)
  @JoinColumn({ name: 'grupo_id' })
  grupo: GrupoFormacion | null;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  /** ACTIVO | FINALIZADO | RETIRADO | SUSPENDIDO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'observacion', type: 'nvarchar', length: 500, nullable: true })
  observacion: string | null;

  @Column({ name: 'registrado_por_usuario_id', type: 'int', nullable: true })
  registradoPorUsuarioId: number | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;
}
