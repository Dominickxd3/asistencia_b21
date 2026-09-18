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

/**
 * Captura geografica del dispositivo que ejecuta un evento de asistencia.
 * Solo se registra en acciones relevantes (no hay tracking permanente).
 */
@Entity('asistencia_ubicaciones')
export class AsistenciaUbicacion {
  @PrimaryGeneratedColumn({ name: 'ubicacion_id', type: 'bigint' })
  id: number;

  @Column({ name: 'asistencia_id', type: 'bigint' })
  asistenciaId: number;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => Asistencia)
  @JoinColumn({ name: 'asistencia_id' })
  asistencia: Asistencia;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  /** ENTRADA | SALIDA | MODIFICACION | ANULACION */
  @Column({ name: 'tipo_evento', type: 'varchar', length: 30 })
  tipoEvento: string;

  @Column({ name: 'latitud', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitud: number | null;

  @Column({ name: 'longitud', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitud: number | null;

  @Column({ name: 'precision_metros', type: 'decimal', precision: 10, scale: 2, nullable: true })
  precisionMetros: number | null;

  @Column({ name: 'distancia_sede_metros', type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanciaSedeMetros: number | null;

  /** DENTRO_ZONA | FUERA_ZONA | NO_DISPONIBLE */
  @Column({ name: 'estado_geografico', type: 'varchar', length: 30 })
  estadoGeografico: string;

  @CreateDateColumn({ name: 'fecha_captura', type: 'datetime2' })
  fechaCaptura: Date;
}
