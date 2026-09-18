import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TrackingOrder, TrackingQueryDto } from './dto/tracking.dto';

export interface TrackingRow {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  jornadasEsperadas: number;
  asistencias: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  horas: number;
}

const ORDER_SQL: Record<TrackingOrder, string> = {
  faltas_injustificadas: 'faltasInjustificadas DESC, asistencias ASC',
  menor_asistencia: 'asistencias ASC, faltasInjustificadas DESC',
  salidas_anticipadas: 'salidasAnticipadas DESC, faltasInjustificadas DESC',
  horas: 'horas DESC',
};

/**
 * Seguimiento: métricas reales por integrante en un grupo y periodo.
 * Sin calificaciones artificiales — solo hechos medibles.
 */
@Injectable()
export class TrackingService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async resumen(query: TrackingQueryDto) {
    const { grupoId, desde, hasta, orden } = this.normalizar(query);

    const jornadasEsperadasRows = await this.ds.query(
      `SELECT COUNT(*) AS n FROM jornadas
       WHERE grupo_id = @0 AND fecha BETWEEN @1 AND @2
         AND tipo_jornada = 'OBLIGATORIA' AND estado IN ('PROGRAMADA','ABIERTA','CERRADA')`,
      [grupoId, desde, hasta],
    );
    const jornadasEsperadas: number = jornadasEsperadasRows[0]?.n ?? 0;

    const rows = await this.ds.query(
      `SELECT
         p.persona_id AS personaId,
         p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto,
         p.dni,
         SUM(CASE WHEN a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS asistencias,
         SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS faltasJustificadas,
         SUM(CASE WHEN a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS faltasInjustificadas,
         SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas,
         ISNULL(SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                         THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) / 60.0 END), 0) AS horas
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id
       LEFT JOIN jornadas j
         ON j.grupo_id = gi.grupo_id AND j.fecha BETWEEN @1 AND @2
       LEFT JOIN asistencias a
         ON a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
        AND a.estado_asistencia <> 'ANULADO'
       WHERE gi.grupo_id = @0 AND gi.estado = 'ACTIVO'
       GROUP BY p.persona_id, p.apellido_paterno, p.apellido_materno, p.nombres, p.dni
       ORDER BY ${ORDER_SQL[orden]}`,
      [grupoId, desde, hasta],
    );

    return {
      grupoId,
      desde,
      hasta,
      orden,
      jornadasEsperadas,
      integrantes: rows.map((r: any) => ({
        personaId: r.personaId,
        nombreCompleto: r.nombreCompleto,
        dni: r.dni,
        jornadasEsperadas,
        asistencias: r.asistencias ?? 0,
        faltasJustificadas: r.faltasJustificadas ?? 0,
        faltasInjustificadas: r.faltasInjustificadas ?? 0,
        salidasAnticipadas: r.salidasAnticipadas ?? 0,
        horas: Math.round((r.horas ?? 0) * 10) / 10,
      })),
    };
  }

  private normalizar(query: TrackingQueryDto) {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return {
      grupoId: query.grupoId,
      desde: query.desde ?? iso(primerDia),
      hasta: query.hasta ?? iso(ultimoDia),
      orden: query.orden ?? 'faltas_injustificadas',
    };
  }
}
