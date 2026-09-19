import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TrackingDetailQueryDto, TrackingOrder, TrackingQueryDto } from './dto/tracking.dto';

const ORDER_SQL: Record<TrackingOrder, string> = {
  nombre: 'nombreCompleto ASC',
  faltas_injustificadas: 'faltasInjustificadas DESC, porcentajeAsistencia ASC',
  faltas_justificadas: 'faltasJustificadas DESC, nombreCompleto ASC',
  menor_asistencia: 'porcentajeAsistencia ASC, jornadasAplicables DESC',
  salidas_anticipadas: 'salidasAnticipadas DESC, nombreCompleto ASC',
  horas_adicionales: 'horasAdicionales DESC, nombreCompleto ASC',
};

@Injectable()
export class TrackingService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async resumen(query: TrackingQueryDto) {
    const { grupoId, desde, hasta, orden } = this.normalizar(query);
    const [grupo] = await this.ds.query(
      `SELECT g.grupo_id AS id, g.nombre, e.nombre AS etapa
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE g.grupo_id = @0`,
      [grupoId],
    );
    if (!grupo) throw new NotFoundException('Grupo no encontrado');

    const [periodo] = await this.ds.query(
      `SELECT COUNT(*) AS jornadasObligatorias
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE j.grupo_id = @0 AND j.fecha BETWEEN @1 AND @2
         AND j.tipo_jornada = 'OBLIGATORIA'
         AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
         AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5)
         AND j.estado IN ('PROGRAMADA','ABIERTA','CERRADA')`,
      [grupoId, desde, hasta],
    );

    const rows = await this.ds.query(
      `WITH membresias AS (
         SELECT gi.persona_id, gi.fecha_inicio, gi.fecha_fin
         FROM grupo_integrantes gi
         WHERE gi.grupo_id = @0
           AND gi.fecha_inicio <= @2
           AND (gi.fecha_fin IS NULL OR gi.fecha_fin >= @1)
       ), personas_periodo AS (
         SELECT DISTINCT p.persona_id, p.dni,
           p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS nombreCompleto
         FROM membresias m JOIN personas p ON p.persona_id = m.persona_id
       ), registros AS (
         SELECT DISTINCT m.persona_id, j.jornada_id,
           CASE WHEN j.tipo_jornada = 'OBLIGATORIA'
                  AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
                  AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5)
                THEN 'OBLIGATORIA' ELSE 'VOLUNTARIA' END AS tipo_jornada,
           a.estado_asistencia, a.fecha_hora_entrada, a.fecha_hora_salida
         FROM membresias m
         JOIN jornadas j ON j.grupo_id = @0
           AND j.fecha BETWEEN @1 AND @2
           AND j.fecha >= m.fecha_inicio
           AND (m.fecha_fin IS NULL OR j.fecha <= m.fecha_fin)
           AND j.estado IN ('PROGRAMADA','ABIERTA','CERRADA')
         JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
         JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
         LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id
           AND a.persona_id = m.persona_id AND a.estado_asistencia <> 'ANULADO'
       )
       SELECT p.persona_id AS personaId, p.nombreCompleto, p.dni,
         COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' THEN r.jornada_id END) AS jornadasAplicables,
         COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' AND r.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN r.jornada_id END) AS asistencias,
         COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' AND r.estado_asistencia = 'FALTA_JUSTIFICADA' THEN r.jornada_id END) AS faltasJustificadas,
         COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' AND r.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN r.jornada_id END) AS faltasInjustificadas,
         COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' AND r.estado_asistencia = 'SALIDA_ANTICIPADA' THEN r.jornada_id END) AS salidasAnticipadas,
         ISNULL(SUM(CASE WHEN r.tipo_jornada = 'VOLUNTARIA'
                          AND r.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA')
                          AND r.fecha_hora_entrada IS NOT NULL AND r.fecha_hora_salida IS NOT NULL
                         THEN DATEDIFF(minute, r.fecha_hora_entrada, r.fecha_hora_salida) / 60.0 ELSE 0 END), 0) AS horasAdicionales,
         CAST(CASE WHEN COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' THEN r.jornada_id END) = 0 THEN 0
           ELSE 100.0 * COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' AND r.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN r.jornada_id END)
             / COUNT(DISTINCT CASE WHEN r.tipo_jornada = 'OBLIGATORIA' THEN r.jornada_id END) END AS decimal(5,1)) AS porcentajeAsistencia
       FROM personas_periodo p
       LEFT JOIN registros r ON r.persona_id = p.persona_id
       GROUP BY p.persona_id, p.nombreCompleto, p.dni
       ORDER BY ${ORDER_SQL[orden]}`,
      [grupoId, desde, hasta],
    );

    const integrantes = rows.map((r: any) => ({
      personaId: Number(r.personaId),
      nombreCompleto: r.nombreCompleto,
      dni: r.dni,
      jornadasAplicables: Number(r.jornadasAplicables ?? 0),
      asistencias: Number(r.asistencias ?? 0),
      porcentajeAsistencia: Number(r.porcentajeAsistencia ?? 0),
      faltasJustificadas: Number(r.faltasJustificadas ?? 0),
      faltasInjustificadas: Number(r.faltasInjustificadas ?? 0),
      salidasAnticipadas: Number(r.salidasAnticipadas ?? 0),
      horasAdicionales: Math.round(Number(r.horasAdicionales ?? 0) * 10) / 10,
    }));
    const aplicables = integrantes.reduce((sum, item) => sum + item.jornadasAplicables, 0);
    const asistencias = integrantes.reduce((sum, item) => sum + item.asistencias, 0);

    return {
      grupo: { id: Number(grupo.id), nombre: grupo.nombre, etapa: grupo.etapa },
      desde,
      hasta,
      orden,
      jornadasEsperadas: Number(periodo?.jornadasObligatorias ?? 0),
      resumen: {
        jornadasObligatorias: Number(periodo?.jornadasObligatorias ?? 0),
        asistenciaGrupo: aplicables ? Math.round((asistencias / aplicables) * 1000) / 10 : 0,
        faltasInjustificadas: integrantes.reduce((sum, item) => sum + item.faltasInjustificadas, 0),
        faltasJustificadas: integrantes.reduce((sum, item) => sum + item.faltasJustificadas, 0),
        salidasAnticipadas: integrantes.reduce((sum, item) => sum + item.salidasAnticipadas, 0),
        horasAdicionales: Math.round(integrantes.reduce((sum, item) => sum + item.horasAdicionales, 0) * 10) / 10,
      },
      integrantes,
    };
  }

  async detalle(query: TrackingDetailQueryDto) {
    const { grupoId, personaId } = query;
    const { desde, hasta } = this.normalizar(query);
    const resumen = await this.resumen({ grupoId, desde, hasta, orden: 'nombre' });
    const integrante = resumen.integrantes.find((item) => item.personaId === personaId);
    if (!integrante) throw new NotFoundException('Integrante no aplicable en el periodo');

    const historial = await this.ds.query(
      `SELECT DISTINCT j.jornada_id AS jornadaId, j.fecha,
         CASE WHEN j.tipo_jornada = 'OBLIGATORIA'
                AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
                AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5)
              THEN 'OBLIGATORIA' ELSE 'VOLUNTARIA' END AS tipo,
         ISNULL(a.estado_asistencia, 'SIN_REGISTRO') AS estado,
         CONVERT(varchar(5), a.fecha_hora_entrada, 108) AS entrada,
         CONVERT(varchar(5), a.fecha_hora_salida, 108) AS salida,
         COALESCE(a.observacion, a.motivo_registro_manual) AS incidencia,
         CASE WHEN NOT (j.tipo_jornada = 'OBLIGATORIA'
                         AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
                         AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5))
                    AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
              THEN ROUND(DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) / 60.0, 1) ELSE 0 END AS horasAdicionales
       FROM grupo_integrantes gi
       JOIN jornadas j ON j.grupo_id = gi.grupo_id
         AND j.fecha BETWEEN @2 AND @3 AND j.fecha >= gi.fecha_inicio
         AND (gi.fecha_fin IS NULL OR j.fecha <= gi.fecha_fin)
         AND j.estado IN ('PROGRAMADA','ABIERTA','CERRADA')
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
         AND a.estado_asistencia <> 'ANULADO'
       WHERE gi.grupo_id = @0 AND gi.persona_id = @1
         AND ((j.tipo_jornada = 'OBLIGATORIA'
               AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
               AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5))
              OR a.asistencia_id IS NOT NULL)
       ORDER BY j.fecha DESC, j.jornada_id DESC`,
      [grupoId, personaId, desde, hasta],
    );

    return {
      grupo: resumen.grupo,
      desde,
      hasta,
      integrante,
      historial: historial.map((item: any) => ({ ...item, horasAdicionales: Number(item.horasAdicionales ?? 0) })),
    };
  }

  private normalizar(query: TrackingQueryDto) {
    const hoy = new Date();
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    return {
      grupoId: query.grupoId,
      desde: query.desde ?? iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      hasta: query.hasta ?? iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
      orden: query.orden ?? 'nombre',
    };
  }
}
