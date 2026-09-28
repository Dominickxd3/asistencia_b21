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
import { decimal } from '../../sedes/entities/sede.entity';

/**
 * Evidencia geográfica de cada movimiento de asistencia. Se conservan las
 * coordenadas originales y la precisión del dispositivo para auditoría.
 * Solo se captura al ejecutar una acción (no hay seguimiento permanente).
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

  @Column({ name: 'sede_id', type: 'int', nullable: true })
  sedeId: number | null;

  @Column({ name: 'jornada_id', type: 'bigint', nullable: true })
  jornadaId: number | null;

  /** ENTRADA | SALIDA | MODIFICACION | ANULACION */
  @Column({ name: 'tipo_evento', type: 'varchar', length: 30 })
  tipoEvento: string;

  @Column({ name: 'latitud', type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimal })
  latitud: number | null;

  @Column({ name: 'longitud', type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimal })
  longitud: number | null;

  @Column({ name: 'precision_metros', type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimal })
  precisionMetros: number | null;

  /** Distancia al perímetro de la geocerca (0 si está dentro) */
  @Column({ name: 'distancia_sede_metros', type: 'decimal', precision: 12, scale: 2, nullable: true, transformer: decimal })
  distanciaSedeMetros: number | null;

  @Column({ name: 'tolerancia_aplicada_metros', type: 'decimal', precision: 8, scale: 2, nullable: true, transformer: decimal })
  toleranciaAplicadaMetros: number | null;

  /** DENTRO_ZONA | FUERA_ZONA | PRECISION_INSUFICIENTE | NO_DISPONIBLE | SIN_GEOCERCA */
  @Column({ name: 'estado_geografico', type: 'varchar', length: 30 })
  estadoGeografico: string;

  /** Hora del servidor (SQL Server) */
  @CreateDateColumn({ name: 'fecha_captura', type: 'datetime2' })
  fechaCaptura: Date;

  /** Hora de captura informada por el dispositivo (Geolocation API) */
  @Column({ name: 'fecha_captura_dispositivo', type: 'datetime2', nullable: true })
  fechaCapturaDispositivo: Date | null;
}
