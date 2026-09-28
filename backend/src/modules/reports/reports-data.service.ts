import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { fechaColumna, fechaServidor } from '../../common/utils/fecha.util';

const NOMBRE = `LTRIM(RTRIM(p.apellido_paterno + ISNULL(' ' + p.apellido_materno, '') + ' ' + p.nombres))`;
const ASISTIO = `('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA')`;

export interface GrupoReporte {
  id: number;
  nombre: string;
  codigo: string;
  etapa: string;
  etapaCodigo: string;
  fechaInicio: string;
  encargado: string | null;
  integrantes: number;
  /** Jornadas obligatorias que correspondían según la programación reglamentaria */
  obligatoriasProgramadas: number;
}

export interface MiembroReporte {
  grupoId: number;
  personaId: number;
  nombre: string;
  dni: string | null;
  ingreso: string;
  realizadas: number;
  asistidas: number;
  fj: number;
  fi: number;
  salidas: number;
  voluntarias: number;
  minObl: number;
  minVol: number;
}

export interface JornadaReporte {
  grupoId: number;
  id: number;
  fecha: string;
  horaInicio: string | null;
  horaFin: string | null;
  estado: string;
  esperados: number;
  asistieron: number;
  fj: number;
  fi: number;
}

/**
 * Datos de los reportes. Regla: solo grupos ACTIVOS e integrantes con membresía ACTIVA
 * (quien salió del grupo ya fue dado de baja y no forma parte del informe).
 */
@Injectable()
export class ReportsDataService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private lista(base: number, cantidad: number): string {
    return Array.from({ length: cantidad }, (_, i) => `@${base + i}`).join(',');
  }

  hoy(): Promise<string> {
    return fechaServidor(this.ds);
  }

  /** Grupos activos (todos) y los que el usuario encarga */
  async gruposDisponibles(usuarioId: number) {
    const grupos = await this.ds.query(
      `SELECT g.grupo_id AS id, g.nombre, g.codigo, e.nombre AS etapa, e.codigo AS etapaCodigo,
              CASE WHEN EXISTS (SELECT 1 FROM grupo_encargados ge
                                WHERE ge.grupo_id = g.grupo_id AND ge.usuario_id = @0 AND ge.estado = 'ACTIVO')
                   THEN 1 ELSE 0 END AS asignado
       FROM grupos_formacion g JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE g.estado = 'ACTIVO'
       ORDER BY e.orden, g.nombre`,
      [usuarioId],
    );
    return grupos.map((g: any) => ({ ...g, asignado: g.asignado === 1 }));
  }

  async grupos(grupoIds: number[], desde: string, hasta: string, hoy: string): Promise<GrupoReporte[]> {
    if (grupoIds.length === 0) return [];
    const rows = await this.ds.query(
      `SELECT g.grupo_id AS id, g.nombre, g.codigo, e.nombre AS etapa, e.codigo AS etapaCodigo,
              g.fecha_inicio AS fechaInicio, enc.nombre AS encargado,
              (SELECT COUNT(*) FROM grupo_integrantes gi
                 JOIN personas p ON p.persona_id = gi.persona_id AND p.estado = 'ACTIVO'
                WHERE gi.grupo_id = g.grupo_id AND gi.estado = 'ACTIVO') AS integrantes
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       OUTER APPLY (SELECT TOP 1 ${NOMBRE} AS nombre FROM grupo_encargados ge
                    JOIN usuarios u ON u.usuario_id = ge.usuario_id
                    JOIN personas p ON p.persona_id = u.persona_id
                    WHERE ge.grupo_id = g.grupo_id AND ge.estado = 'ACTIVO') enc
       WHERE g.grupo_id IN (${this.lista(0, grupoIds.length)}) AND g.estado = 'ACTIVO'
       ORDER BY e.orden, g.nombre`,
      grupoIds,
    );
    const dias: { grupoId: number; dia: number; inicio: unknown; fin: unknown }[] = await this.ds.query(
      `SELECT pr.grupo_id AS grupoId, pd.dia_semana AS dia, pr.fecha_inicio AS inicio, pr.fecha_fin AS fin
       FROM programaciones pr
       JOIN programacion_detalles pd ON pd.programacion_id = pr.programacion_id
       WHERE pr.grupo_id IN (${this.lista(0, grupoIds.length)}) AND pr.estado = 'ACTIVO'
         AND pd.estado = 'ACTIVO' AND pd.tipo_jornada = 'OBLIGATORIA'`,
      grupoIds,
    );
    return rows.map((g: any) => {
      const fechaInicio = fechaColumna(g.fechaInicio);
      const programadas = dias
        .filter((d) => d.grupoId === g.id)
        .reduce((total, d) => {
          const ini = [desde, fechaInicio, fechaColumna(d.inicio)].sort().at(-1)!;
          const fin = [hasta, hoy, d.fin ? fechaColumna(d.fin) : '9999-12-31'].sort()[0];
          return total + contarDias(ini, fin, d.dia);
        }, 0);
      return { ...g, fechaInicio, obligatoriasProgramadas: programadas };
    });
  }

  async miembros(grupoIds: number[], desde: string, hasta: string, personaId?: number): Promise<MiembroReporte[]> {
    if (grupoIds.length === 0) return [];
    const params: unknown[] = [desde, hasta, personaId ?? null, ...grupoIds];
    const rows = await this.ds.query(
      `SELECT gi.grupo_id AS grupoId, p.persona_id AS personaId, ${NOMBRE} AS nombre, p.dni,
              gi.fecha_inicio AS ingreso,
              ISNULL(m.realizadas, 0) AS realizadas, ISNULL(m.asistidas, 0) AS asistidas,
              ISNULL(m.fj, 0) AS fj, ISNULL(m.fi, 0) AS fi, ISNULL(m.salidas, 0) AS salidas,
              ISNULL(m.voluntarias, 0) AS voluntarias,
              ISNULL(m.minObl, 0) AS minObl, ISNULL(m.minVol, 0) AS minVol
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id AND p.estado = 'ACTIVO'
       OUTER APPLY (
         SELECT
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND j.estado IN ('ABIERTA','CERRADA') THEN 1 ELSE 0 END) AS realizadas,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND j.estado IN ('ABIERTA','CERRADA')
                     AND a.estado_asistencia IN ${ASISTIO} THEN 1 ELSE 0 END) AS asistidas,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND j.estado IN ('ABIERTA','CERRADA')
                     AND a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS fj,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND j.estado IN ('ABIERTA','CERRADA')
                     AND a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS fi,
           SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidas,
           SUM(CASE WHEN j.tipo_jornada = 'VOLUNTARIA' AND a.estado_asistencia IN ${ASISTIO} THEN 1 ELSE 0 END) AS voluntarias,
           SUM(CASE WHEN j.tipo_jornada = 'OBLIGATORIA' AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                    THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) ELSE 0 END) AS minObl,
           SUM(CASE WHEN j.tipo_jornada = 'VOLUNTARIA' AND a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                    THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) ELSE 0 END) AS minVol
         FROM jornadas j
         LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
           AND a.estado_asistencia <> 'ANULADO'
         WHERE j.grupo_id = gi.grupo_id AND j.fecha BETWEEN @0 AND @1
           AND j.fecha <= CAST(GETDATE() AS date) AND j.fecha >= gi.fecha_inicio
           AND j.estado <> 'CANCELADA'
       ) m
       WHERE gi.estado = 'ACTIVO' AND gi.grupo_id IN (${this.lista(3, grupoIds.length)})
         AND (@2 IS NULL OR gi.persona_id = @2)
       ORDER BY p.apellido_paterno, p.apellido_materno, p.nombres`,
      params,
    );
    return rows.map((r: any) => ({ ...r, ingreso: fechaColumna(r.ingreso) }));
  }

  /** Jornadas obligatorias del periodo (hasta hoy) con su asistencia entre integrantes vigentes */
  async jornadasObligatorias(grupoIds: number[], desde: string, hasta: string): Promise<JornadaReporte[]> {
    if (grupoIds.length === 0) return [];
    const rows = await this.ds.query(
      `SELECT j.grupo_id AS grupoId, j.jornada_id AS id, j.fecha, j.estado,
              CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS horaInicio,
              CONVERT(varchar(5), j.fecha_hora_fin_programada, 108) AS horaFin,
              (SELECT COUNT(*) FROM grupo_integrantes gi
                 JOIN personas p ON p.persona_id = gi.persona_id AND p.estado = 'ACTIVO'
                WHERE gi.grupo_id = j.grupo_id AND gi.estado = 'ACTIVO' AND gi.fecha_inicio <= j.fecha) AS esperados,
              ISNULL(c.asistieron, 0) AS asistieron, ISNULL(c.fj, 0) AS fj, ISNULL(c.fi, 0) AS fi
       FROM jornadas j
       OUTER APPLY (
         SELECT SUM(CASE WHEN a.estado_asistencia IN ${ASISTIO} THEN 1 ELSE 0 END) AS asistieron,
                SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS fj,
                SUM(CASE WHEN a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS fi
         FROM asistencias a
         JOIN grupo_integrantes gi ON gi.persona_id = a.persona_id AND gi.grupo_id = j.grupo_id
          AND gi.estado = 'ACTIVO' AND gi.fecha_inicio <= j.fecha
         JOIN personas p ON p.persona_id = a.persona_id AND p.estado = 'ACTIVO'
         WHERE a.jornada_id = j.jornada_id AND a.estado_asistencia <> 'ANULADO'
       ) c
       WHERE j.grupo_id IN (${this.lista(2, grupoIds.length)}) AND j.tipo_jornada = 'OBLIGATORIA'
         AND j.fecha BETWEEN @0 AND @1 AND j.fecha <= CAST(GETDATE() AS date) AND j.estado <> 'CANCELADA'
       ORDER BY j.fecha, j.fecha_hora_inicio_programada`,
      [desde, hasta, ...grupoIds],
    );
    return rows.map((r: any) => ({ ...r, id: Number(r.id), fecha: fechaColumna(r.fecha) }));
  }

  /** Jornadas del periodo de una persona (obligatorias realizadas y voluntarias con participación) */
  async detallePersona(personaId: number, grupoId: number, desde: string, hasta: string, ingreso: string) {
    const rows = await this.ds.query(
      `SELECT j.fecha, j.tipo_jornada AS tipo, j.estado AS estadoJornada,
              a.estado_asistencia AS estado,
              CONVERT(varchar(5), a.fecha_hora_entrada, 108) AS entrada,
              CONVERT(varchar(5), a.fecha_hora_salida, 108) AS salida,
              CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                   THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) END AS minutos,
              a.tipo_registro AS registro, a.observacion
       FROM jornadas j
       LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.persona_id = @0 AND a.estado_asistencia <> 'ANULADO'
       WHERE j.grupo_id = @1 AND j.fecha BETWEEN @2 AND @3 AND j.fecha >= @4
         AND j.fecha <= CAST(GETDATE() AS date) AND j.estado <> 'CANCELADA'
         AND ((j.tipo_jornada = 'OBLIGATORIA' AND j.estado IN ('ABIERTA','CERRADA')) OR a.asistencia_id IS NOT NULL)
       ORDER BY j.fecha, j.fecha_hora_inicio_programada`,
      [personaId, grupoId, desde, hasta, ingreso],
    );
    return rows.map((r: any) => ({ ...r, fecha: fechaColumna(r.fecha) }));
  }

  async jornada(jornadaId: number) {
    const [j] = await this.ds.query(
      `SELECT j.jornada_id AS id, j.grupo_id AS grupoId, j.fecha, j.tipo_jornada AS tipo, j.estado,
              CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS horaInicio,
              CONVERT(varchar(5), j.fecha_hora_fin_programada, 108) AS horaFin,
              g.nombre AS grupo, g.estado AS estadoGrupo, e.nombre AS etapa, e.codigo AS etapaCodigo
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE j.jornada_id = @0`,
      [jornadaId],
    );
    if (!j) return null;
    const filas = await this.ds.query(
      `SELECT ${NOMBRE} AS nombre, p.dni, a.estado_asistencia AS estado,
              CONVERT(varchar(5), a.fecha_hora_entrada, 108) AS entrada,
              CONVERT(varchar(5), a.fecha_hora_salida, 108) AS salida,
              CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                   THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) END AS minutos,
              a.tipo_registro AS registro, a.observacion,
              LTRIM(RTRIM(pr.apellido_paterno + ' ' + pr.nombres)) AS registradoPor
       FROM grupo_integrantes gi
       JOIN personas p ON p.persona_id = gi.persona_id AND p.estado = 'ACTIVO'
       LEFT JOIN asistencias a ON a.jornada_id = @0 AND a.persona_id = gi.persona_id AND a.estado_asistencia <> 'ANULADO'
       LEFT JOIN usuarios u ON u.usuario_id = a.registrado_por_usuario_id
       LEFT JOIN personas pr ON pr.persona_id = u.persona_id
       WHERE gi.grupo_id = @1 AND gi.estado = 'ACTIVO' AND gi.fecha_inicio <= @2
       ORDER BY p.apellido_paterno, p.apellido_materno, p.nombres`,
      [jornadaId, j.grupoId, fechaColumna(j.fecha)],
    );
    return { ...j, fecha: fechaColumna(j.fecha), filas };
  }

  async nombreUsuario(usuarioId: number): Promise<string> {
    const [r] = await this.ds.query(
      `SELECT ${NOMBRE} AS nombre FROM usuarios u JOIN personas p ON p.persona_id = u.persona_id WHERE u.usuario_id = @0`,
      [usuarioId],
    );
    return r?.nombre ?? 'Usuario del sistema';
  }

  /** Jefe(s) de Instrucción vigentes, para el visto bueno */
  async jefesInstruccion(): Promise<string[]> {
    const rows = await this.ds.query(
      `SELECT DISTINCT ${NOMBRE} AS nombre
       FROM usuarios u
       JOIN personas p ON p.persona_id = u.persona_id AND p.estado = 'ACTIVO'
       JOIN usuario_roles ur ON ur.usuario_id = u.usuario_id AND ur.estado = 'ACTIVO'
       JOIN roles r ON r.rol_id = ur.rol_id AND r.codigo = 'JEFE_INSTRUCCION'
       WHERE u.estado_cuenta = 'ACTIVA'`,
    );
    return rows.map((r: any) => r.nombre);
  }

  async siguienteCodigo(hoy: string): Promise<string> {
    const prefijo = `RPT-${hoy.replace(/-/g, '')}-`;
    const [r] = await this.ds.query(
      `SELECT COUNT(*) AS n FROM reportes_generados WHERE codigo_reporte LIKE @0`,
      [`${prefijo}%`],
    );
    return `${prefijo}${String(Number(r.n) + 1).padStart(3, '0')}`;
  }

}

/** Cantidad de fechas en [desde, hasta] cuyo día (1 = lunes … 7 = domingo) coincide */
function contarDias(desde: string, hasta: string, dia: number): number {
  if (hasta < desde) return 0;
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const ini = Date.UTC(a1, m1 - 1, d1);
  const fin = Date.UTC(a2, m2 - 1, d2);
  let n = 0;
  for (let t = ini; t <= fin; t += 86_400_000) {
    const js = new Date(t).getUTCDay();
    if ((js === 0 ? 7 : js) === dia) n++;
  }
  return n;
}
