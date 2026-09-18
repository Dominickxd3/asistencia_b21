import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Compania } from './catalogos.entity';

@Entity('personas')
export class Persona {
  @PrimaryGeneratedColumn({ name: 'persona_id' })
  id: number;

  @Column({ name: 'compania_id', type: 'int' })
  companiaId: number;

  @ManyToOne(() => Compania)
  @JoinColumn({ name: 'compania_id' })
  compania: Compania;

  @Column({ name: 'dni', type: 'varchar', length: 20, nullable: true })
  dni: string | null;

  @Column({ name: 'nombres', type: 'nvarchar', length: 100 })
  nombres: string;

  @Column({ name: 'apellido_paterno', type: 'nvarchar', length: 80 })
  apellidoPaterno: string;

  @Column({ name: 'apellido_materno', type: 'nvarchar', length: 80, nullable: true })
  apellidoMaterno: string | null;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'correo', type: 'nvarchar', length: 150, nullable: true })
  correo: string | null;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento: string | null;

  /** ACTIVO | INACTIVO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime2', nullable: true })
  fechaActualizacion: Date | null;

  get nombreCompleto(): string {
    return [this.apellidoPaterno, this.apellidoMaterno, this.nombres]
      .filter(Boolean)
      .join(' ');
  }
}
