import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TrackingDetailQueryDto, TrackingOrder, TrackingQueryDto } from './dto/tracking.dto';
import { fechaColumna, fechaLocalIso } from '../../common/utils/fecha.util';

export interface TrackingRow {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  cumplimientoAplica: boolean;
  jornadasEsperadas: number;
  asistencias: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  participacionesVoluntarias: number;
  minutosObligatorios: number;
  minutosVoluntarios: number;
  minutosTotales: number;
}

const ORDER_SQL: Record<TrackingOrder, string> = {
  faltas_injustificadas: 'faltasInjustificadas DESC, asistencias ASC',
  menor_asistencia: 'asistencias ASC, faltasInjustificadas DESC',
  salidas_anticipadas: 'salidasAnticipadas DESC, faltasInjustificadas DESC',
  horas: 'minutosTotales DESC',
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

    const rows = await this.ds.query(
      `WITH miembros AS (
         -- Solo integrantes vigentes: quien salió del grupo ya no forma parte del seguimiento
         SELECT DISTINCT gi.persona_id
         FROM grupo_integrantes gi
         JOIN personas px ON px.persona_id = gi.persona_id AND px.estado = 'ACTIVO'
         WHERE gi.grupo_id = @0 AND gi.estado = 'ACTIVO' AND gi.fecha_inicio <= @2
       )
       SELECT
         p.persona_id AS personaId,
         p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto,
         p.dni,
         CASE WHEN e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA') THEN 1 ELSE 0 END AS cumplimientoAplica,
         CASE WHEN e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA') THEN ISNULL(m.jornadasEsperadas,0) ELSE 0 END AS jornadasEsperadas,
         CASE WHEN e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA') THEN ISNULL(m.asistencias,0) ELSE 0 END AS asistencias,
         CASE WHEN e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA') THEN ISNULL(m.faltasJustificadas,0) ELSE 0 END AS faltasJustificadas,
         CASE WHEN e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA') THEN ISNULL(m.faltasInjustificadas,0) ELSE 0 END AS faltasInjustificadas,
         ISNULL(m.salidasAnticipadas,0) AS salidasAnticipadas,
         ISNULL(m.participacionesVoluntarias,0) AS participacionesVoluntarias,
         ISNULL(m.minutosObligatorios,0) AS minutosObligatorios,
         ISNULL(m.minutosVoluntarios,0) AS minutosVoluntarios,
         ISNULL(m.minutosObligatorios,0) + ISNULL(m.minutosVoluntarios,0) AS minutosTotales
       FROM miembros mi
       JOIN personas p ON p.persona_id = mi.persona_id
       JOIN grupos_formacion g ON g.grupo_id = @0
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       OUTER APPLY (
         SELECT
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' THEN 1 ELSE 0 END) AS jornadasEsperadas,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA'
                     AND a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS asistencias,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS faltasJustificadas,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS faltasInjustificadas,
           SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas,
           SUM(CASE WHEN j.tipo_jornada = 'VOLUNTARIA'
                     AND a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS participacionesVoluntarias,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                    THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) ELSE 0 END) AS minutosObligatorios,
           SUM(CASE WHEN j.tipo_jornada = 'VOLUNTARIA' AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                    THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) ELSE 0 END) AS minutosVoluntarios
         FROM jornadas j
         LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id
           AND a.persona_id = mi.persona_id AND a.estado_asistencia <> 'ANULADO'
         WHERE j.grupo_id = @0 AND j.fecha BETWEEN @1 AND @2
           AND j.fecha <= CAST(GETDATE() AS date) AND j.estado <> 'CANCELADA'
           AND EXISTS (
             SELECT 1 FROM grupo_integrantes gih
             WHERE gih.grupo_id = j.grupo_id AND gih.persona_id = mi.persona_id
               AND gih.fecha_inicio <= j.fecha
               AND (gih.fecha_fin IS NULL OR gih.fecha_fin >= j.fecha)
           )
       ) m
       ORDER BY ${ORDER_SQL[orden]}`,
      [grupoId, desde, hasta],
    );

    const cumplimientoAplica = rows.some((r: any) => Number(r.cumplimientoAplica) === 1);
    const jornadasEsperadas = rows.reduce(
      (max: number, r: any) => Math.max(max, Number(r.jornadasEsperadas ?? 0)),
      0,
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
        cumplimientoAplica: Number(r.cumplimientoAplica) === 1,
        jornadasEsperadas: Number(r.jornadasEsperadas ?? 0),
        asistencias: Number(r.asistencias ?? 0),
        faltasJustificadas: r.faltasJustificadas ?? 0,
        faltasInjustificadas: r.faltasInjustificadas ?? 0,
        salidasAnticipadas: r.salidasAnticipadas ?? 0,
        participacionesVoluntarias: Number(r.participacionesVoluntarias ?? 0),
        minutosObligatorios: Number(r.minutosObligatorios ?? 0),
        minutosVoluntarios: Number(r.minutosVoluntarios ?? 0),
        minutosTotales: Number(r.minutosTotales ?? 0),
      })),
      cumplimientoAplica,
    };
  }

  async detalle(query: TrackingDetailQueryDto) {
    if (query.hasta < query.desde) throw new UnprocessableEntityException('El rango de fechas no es válido');
    const [persona] = await this.ds.query(
      `SELECT p.persona_id AS personaId,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto,
              p.dni, g.nombre AS grupo, e.codigo AS etapaCodigo
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id AND p.estado = 'ACTIVO'
       JOIN grupos_formacion g ON g.grupo_id = gi.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE gi.grupo_id = @0 AND gi.persona_id = @1 AND gi.estado = 'ACTIVO'`,
      [query.grupoId, query.personaId],
    );
    if (!persona) throw new NotFoundException('La persona no pertenece actualmente al grupo');

    const cumplimientoAplica = ['POSTULANTE', 'ASPIRANTE_COMPANIA'].includes(persona.etapaCodigo);
    const jornadas = await this.ds.query(
      `SELECT j.jornada_id AS id, j.fecha, j.tipo_jornada AS tipo,
              a.estado_asistencia AS estado,
              CONVERT(varchar(5), a.fecha_hora_entrada, 108) AS entrada,
              CONVERT(varchar(5), a.fecha_hora_salida, 108) AS salida,
              CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                   THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) END AS minutos
       FROM jornadas j
       LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id
         AND a.persona_id = @1 AND a.estado_asistencia <> 'ANULADO'
       WHERE j.grupo_id = @0 AND j.fecha BETWEEN @2 AND @3
         AND j.fecha <= CAST(GETDATE() AS date) AND j.estado <> 'CANCELADA'
         AND (
           (@4 = 1 AND j.tipo_jornada = 'OBLIGATORIA')
           OR (a.asistencia_id IS NOT NULL)
         )
       ORDER BY j.fecha DESC, j.fecha_hora_inicio_programada DESC`,
      [query.grupoId, query.personaId, query.desde, query.hasta, cumplimientoAplica ? 1 : 0],
    );

    return {
      personaId: Number(persona.personaId),
      nombreCompleto: persona.nombreCompleto,
      dni: persona.dni ?? null,
      grupo: persona.grupo,
      cumplimientoAplica,
      jornadas: jornadas.map((j: any) => ({
        id: Number(j.id),
        fecha: fechaColumna(j.fecha),
        tipo: j.tipo,
        estado: j.estado ?? 'SIN_REGISTRO',
        entrada: j.entrada ?? null,
        salida: j.salida ?? null,
        minutos: j.minutos == null ? null : Number(j.minutos),
      })),
    };
  }

  private normalizar(query: TrackingQueryDto) {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const iso = fechaLocalIso;
    return {
      grupoId: query.grupoId,
      desde: query.desde ?? iso(primerDia),
      hasta: query.hasta ?? iso(ultimoDia),
      orden: query.orden ?? 'faltas_injustificadas',
    };
  }
}
