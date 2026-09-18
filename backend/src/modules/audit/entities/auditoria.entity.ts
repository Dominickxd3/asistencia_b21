import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Bitacora de auditoria. Tabla append-only:
 * nunca se actualiza ni se elimina desde la aplicacion.
 */
@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn({ name: 'auditoria_id', type: 'bigint' })
  id: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  @Index()
  usuarioId: number | null;

  @Column({ name: 'accion', type: 'varchar', length: 80 })
  @Index()
  accion: string;

  @Column({ name: 'modulo', type: 'varchar', length: 80 })
  modulo: string;

  @Column({ name: 'entidad', type: 'varchar', length: 100, nullable: true })
  entidad: string | null;

  @Column({ name: 'entidad_id', type: 'nvarchar', length: 100, nullable: true })
  entidadId: string | null;

  @Column({ name: 'valor_anterior_json', type: 'nvarchar', length: 'max', nullable: true })
  valorAnteriorJson: string | null;

  @Column({ name: 'valor_nuevo_json', type: 'nvarchar', length: 'max', nullable: true })
  valorNuevoJson: string | null;

  @Column({ name: 'descripcion', type: 'nvarchar', length: 1000, nullable: true })
  descripcion: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: 'latitud', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ name: 'longitud', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  @CreateDateColumn({ name: 'fecha_hora', type: 'datetime2' })
  @Index()
  fechaHora: Date;
}
