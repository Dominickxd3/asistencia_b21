import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Usuario } from '../../users/entities/usuario.entity';

/** Sesion de autenticacion (refresh token). El id lo genera la aplicacion. */
@Entity('sesiones')
export class Sesion {
  @PrimaryColumn({ name: 'sesion_id', type: 'uniqueidentifier' })
  id: string;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'refresh_token_hash', type: 'nvarchar', length: 500 })
  refreshTokenHash: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 500, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime2' })
  fechaCreacion: Date;

  @Column({ name: 'fecha_expiracion', type: 'datetime2' })
  fechaExpiracion: Date;

  @Column({ name: 'fecha_revocacion', type: 'datetime2', nullable: true })
  fechaRevocacion: Date | null;

  /** ACTIVA | REVOCADA | EXPIRADA */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;
}
