import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'rol_id' })
  id: number;

  @Column({ name: 'codigo', type: 'varchar', length: 60, unique: true })
  codigo: string;

  @Column({ name: 'nombre', type: 'nvarchar', length: 120 })
  nombre: string;

  @Column({ name: 'descripcion', type: 'nvarchar', length: 300, nullable: true })
  descripcion: string | null;

  /** ACTIVO | INACTIVO */
  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;

  @OneToMany(() => RolPermiso, (rp) => rp.rol)
  rolPermisos: RolPermiso[];
}

@Entity('permisos')
export class Permiso {
  @PrimaryGeneratedColumn({ name: 'permiso_id' })
  id: number;

  @Column({ name: 'codigo', type: 'varchar', length: 120, unique: true })
  codigo: string;

  @Column({ name: 'nombre', type: 'nvarchar', length: 150 })
  nombre: string;

  @Column({ name: 'modulo', type: 'nvarchar', length: 80 })
  modulo: string;

  @Column({ name: 'descripcion', type: 'nvarchar', length: 300, nullable: true })
  descripcion: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 20 })
  estado: string;
}

@Entity('rol_permisos')
export class RolPermiso {
  @Column({ name: 'rol_id', type: 'int', primary: true })
  rolId: number;

  @Column({ name: 'permiso_id', type: 'int', primary: true })
  permisoId: number;

  @ManyToOne(() => Rol, (rol) => rol.rolPermisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rol_id' })
  rol: Rol;

  @ManyToOne(() => Permiso, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permiso_id' })
  permiso: Permiso;

  @Column({ name: 'fecha_asignacion', type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  fechaAsignacion: Date;
}
