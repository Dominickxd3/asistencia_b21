import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Consultas de datos para reportes (sin formato: eso es del generador PDF) */
@Injectable()
export class ReportsDataService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Construye placeholders @base..@base+n-1 para listas IN (...) */
  private inPlaceholders(base: number, cantidad: number): { sql: string; siguiente: number } {
    return {
      sql: Array.from({ length: cantidad }, (_, i) => `@${base + i}`).join(','),
      siguiente: base + cantidad,
    };
  }

  async estadoGeneral(grupoIds: number[], desde: string, hasta: string) {
    const inG = this.inPlaceholders(2, grupoIds.length);
    return this.ds.query(
      `SELECT
         g.nombre AS grupo, e.nombre AS etapa,
         p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS persona,
         SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' THEN 1 ELSE 0 END) AS jornadasObligatorias,
         SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS asistencias,
         SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS faltasJustificadas,
         SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS faltasInjustificadas,
         SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas,
         SUM(CASE WHEN j.tipo_jornada = 'VOLUNTARIA' AND a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS participacionesVoluntarias,
         ISNULL(SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                         THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida)/60.0 END),0) AS horas
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       JOIN grupo_integrantes gi ON gi.grupo_id = g.grupo_id AND gi.estado = 'ACTIVO'
       JOIN personas p ON p.persona_id = gi.persona_id
       LEFT JOIN jornadas j ON j.grupo_id = g.grupo_id AND j.fecha BETWEEN @0 AND @1
       LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
         AND a.estado_asistencia <> 'ANULADO'
       WHERE g.grupo_id IN (${inG.sql})
       GROUP BY g.nombre, e.nombre, p.apellido_paterno, p.apellido_materno, p.nombres
       ORDER BY e.nombre, g.nombre, p.apellido_paterno`,
      [desde, hasta, ...grupoIds.map(Number)],
    );
  }

  async detalleIndividual(personaId: number, desde: string, hasta: string) {
    return this.ds.query(
      `SELECT j.fecha, g.nombre AS grupo, j.tipo_jornada AS tipo,
              a.estado_asistencia AS estado,
              CONVERT(varchar(5), a.fecha_hora_entrada, 108) AS entrada,
              CONVERT(varchar(5), a.fecha_hora_salida, 108) AS salida,
              a.tipo_registro AS tipoRegistro, a.observacion
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       WHERE a.persona_id = @0 AND a.estado_asistencia <> 'ANULADO' AND j.fecha BETWEEN @1 AND @2
       ORDER BY j.fecha`,
      [personaId, desde, hasta],
    );
  }

  async nombresGrupos(grupoIds: number[]): Promise<string[]> {
    const inG = this.inPlaceholders(0, grupoIds.length);
    const rows = await this.ds.query(
      `SELECT nombre FROM grupos_formacion WHERE grupo_id IN (${inG.sql})`,
      grupoIds.map(Number),
    );
    return rows.map((r: any) => r.nombre);
  }
}
