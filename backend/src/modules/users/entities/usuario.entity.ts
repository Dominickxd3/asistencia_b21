import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Persona } from '../../persons/entities/persona.entity';
import { Rol } from '../../roles/entities/rol.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'usuario_id' })
  id: number;

  @Column({ name: 'persona_id', type: 'int' })
  personaId: number;

  @ManyToOne(() => Persona)
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;

  @Column({ name: 'username', type: 'nvarchar', length: 80, unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'nvarchar', length: 500 })
  passwordHash: string;

  /** ACTIVA | BLOQUEADA | INACTIVA */
  @Column({ name: 'estado_cuenta', type: 'varchar', length: 20 })
  estadoCuenta: string;

  @Column({ name: 'ultimo_login_at', type: 'datetime2', nullable: true })
  ultimoLoginAt: Date | null;

  @OneToMany(() => UsuarioRol, (ur) => ur.usuario)
  usuarioRoles: UsuarioRol[];

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime2', nullable: true })
  fechaActualizacion: Date | null;
}

@Entity('usuario_roles')
export class UsuarioRol {
  @PrimaryGeneratedColumn({ name: 'usuario_rol_id' })
  id: number;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @Column({ name: 'rol_id', type: 'int' })
  rolId: number;

  @ManyToOne(() => Usuario, (u) => u.usuarioRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Rol, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rol_id' })
  rol: Rol;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  /** ACTIVO | FINALIZADO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @Column({ name: 'asignado_por_usuario_id', type: 'int', nullable: true })
  asignadoPorUsuarioId: number | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;
}
