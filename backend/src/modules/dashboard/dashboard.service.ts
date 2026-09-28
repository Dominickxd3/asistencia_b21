import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { fechaColumna, fechaServidor } from '../../common/utils/fecha.util';
import { AuthzService } from '../roles/authz.service';
import { PermissionCode } from '../../common/constants/permissions.constants';

export interface JornadaHoyView {
  jornadaId: number;
  grupoId: number;
  grupo: string;
  etapa: string;
  horario: string;
  horaInicio: string | null;
  horaFin: string | null;
  tipoJornada: string;
  origen: string;
  estado: string;
  encargado: string | null;
  integrantes: number;
  presentes: number;
  finalizados: number;
  pendientes: number;
  justificados: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  ingresaron: number;
  justificacionesPorRevisar: number;
  /** PROGRAMADA cuya hora de inicio ya pasó */
  sinAbrir: boolean;
  /** ABIERTA cuya hora de fin ya pasó */
  sinCerrar: boolean;
}

export interface AtencionView {
  tipo: 'PENDIENTES' | 'JORNADA_SIN_ABRIR' | 'JORNADA_SIN_CERRAR' | 'JUSTIFICACIONES';
  descripcion: string;
  jornadaId: number;
}

export interface GrupoMetricasView {
  grupoId: number;
  nombre: string;
  etapa: string;
  etapaCodigo: string;
  integrantes: number;
  encargado: string | null;
  /** Jornadas obligatorias cerradas en el mes (hasta la fecha consultada) */
  jornadasMes: number;
  asistenciasMes: number;
  faltasJustificadasMes: number;
  faltasInjustificadasMes: number;
  salidasAnticipadasMes: number;
  horasMes: number;
  participacionesVoluntariasMes: number;
  horasVoluntariasMes: number;
  horasTotalesMes: number;
  /** asistencias / registros de jornadas obligatorias cerradas; null si aún no hay datos */
  asistenciaPct: number | null;
  proximaJornada: { fecha: string; horaInicio: string | null } | null;
}

const NOMBRE = (alias: string) =>
  `${alias}.apellido_paterno + ' ' + ISNULL(${alias}.apellido_materno + ' ', '') + ${alias}.nombres`;

const ENCARGADO_APPLY = (grupoCol: string) => `
  OUTER APPLY (
    SELECT TOP 1 pe.apellido_paterno + ' ' + pe.nombres AS encargado
    FROM grupo_encargados ge
    JOIN usuarios ue ON ue.usuario_id = ge.usuario_id
    JOIN personas pe ON pe.persona_id = ue.persona_id
    WHERE ge.grupo_id = ${grupoCol} AND ge.estado = 'ACTIVO'
    ORDER BY ge.fecha_inicio DESC
  ) enc`;

@Injectable()
export class DashboardService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly authz: AuthzService,
  ) {}

  /** Responde: ¿qué está ocurriendo en Instrucción en la fecha indicada (por defecto hoy)? */
  async resumenDelDia(fechaParam: string | undefined, usuarioId: number) {
    const hoy = await fechaServidor(this.ds);
    const fecha = fechaParam ?? hoy;
    const vistaGlobal = await this.authz.tienePermiso(
      usuarioId,
      PermissionCode.ATTENDANCE_VIEW_ALL,
    );
    // null representa alcance global. Cualquier otro usuario queda limitado a
    // los grupos donde tiene una asignación activa como encargado.
    const usuarioEncargadoId = vistaGlobal ? null : usuarioId;

    const jornadas = await this.jornadasDelDia(fecha, usuarioEncargadoId);
    const [actividad, proximaJornada, grupos] = await Promise.all([
      this.actividadReciente(fecha, usuarioEncargadoId),
      this.proximaJornada(usuarioEncargadoId),
      this.metricasPorGrupo(fecha, usuarioEncargadoId),
    ]);

    const vigentes = jornadas.filter((j) => j.estado !== 'CANCELADA');
    const suma = (campo: keyof JornadaHoyView, lista = vigentes) =>
      lista.reduce((acc, j) => acc + Number(j[campo] ?? 0), 0);

    return {
      fecha,
      esHoy: fecha === hoy,
      resumen: {
        presentesAhora: suma('presentes'),
        ingresaronHoy: suma('ingresaron'),
        pendientes: suma(
          'pendientes',
          vigentes.filter(
            (j) =>
              j.tipoJornada === 'OBLIGATORIA' &&
              (j.estado === 'ABIERTA' || j.estado === 'PROGRAMADA'),
          ),
        ),
        justificados: suma('justificados'),
        faltasInjustificadas: suma('faltasInjustificadas'),
        salidasAnticipadas: suma('salidasAnticipadas'),
        finalizados: suma('finalizados'),
        esperados: suma(
          'integrantes',
          vigentes.filter((j) => j.tipoJornada === 'OBLIGATORIA'),
        ),
      },
      jornadas,
      requierenAtencion: this.construirAtencion(jornadas),
      actividad,
      proximaJornada,
      grupos,
    };
  }

  private async jornadasDelDia(
    fecha: string,
    usuarioEncargadoId: number | null,
  ): Promise<JornadaHoyView[]> {
    const rows = await this.ds.query(
      `SELECT
         j.jornada_id AS jornadaId,
         j.grupo_id AS grupoId,
         g.nombre AS grupo,
         e.nombre AS etapa,
         CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS horaInicio,
         CONVERT(varchar(5), j.fecha_hora_fin_programada, 108) AS horaFin,
         j.tipo_jornada AS tipoJornada,
         j.origen,
         j.estado,
         enc.encargado,
         (SELECT COUNT(DISTINCT gi.persona_id) FROM grupo_integrantes gi
           WHERE gi.grupo_id = j.grupo_id AND gi.estado = 'ACTIVO'
             AND gi.fecha_inicio <= j.fecha) AS integrantes,
         CASE WHEN j.tipo_jornada <> 'OBLIGATORIA'
                    OR e.codigo NOT IN ('POSTULANTE','ASPIRANTE_COMPANIA') THEN 0
              ELSE (SELECT COUNT(DISTINCT gi.persona_id) FROM grupo_integrantes gi
           WHERE gi.grupo_id = j.grupo_id AND gi.estado = 'ACTIVO'
             AND gi.fecha_inicio <= j.fecha
             AND NOT EXISTS (SELECT 1 FROM asistencias a
                             WHERE a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
                               AND a.estado_asistencia <> 'ANULADO')) END AS pendientes,
         ISNULL(c.presentes, 0) AS presentes,
         ISNULL(c.finalizados, 0) AS finalizados,
         ISNULL(c.justificados, 0) AS justificados,
         ISNULL(c.faltasInjustificadas, 0) AS faltasInjustificadas,
         ISNULL(c.salidasAnticipadas, 0) AS salidasAnticipadas,
         ISNULL(c.ingresaron, 0) AS ingresaron,
         (SELECT COUNT(*) FROM justificaciones ju
            JOIN asistencias a ON a.asistencia_id = ju.asistencia_id
           WHERE a.jornada_id = j.jornada_id AND a.estado_asistencia <> 'ANULADO'
             AND ju.estado = 'PENDIENTE') AS justificacionesPorRevisar,
         CASE WHEN j.estado = 'PROGRAMADA' AND j.fecha_hora_inicio_programada < GETDATE()
              THEN 1 ELSE 0 END AS sinAbrir,
         CASE WHEN j.estado = 'ABIERTA' AND j.fecha_hora_fin_programada < GETDATE()
              THEN 1 ELSE 0 END AS sinCerrar
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       ${ENCARGADO_APPLY('j.grupo_id')}
       OUTER APPLY (
         SELECT
           SUM(CASE WHEN a.estado_asistencia = 'PRESENTE' THEN 1 ELSE 0 END) AS presentes,
           SUM(CASE WHEN a.estado_asistencia = 'FINALIZADO' THEN 1 ELSE 0 END) AS finalizados,
           SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS justificados,
           SUM(CASE WHEN a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS faltasInjustificadas,
           SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas,
           SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL THEN 1 ELSE 0 END) AS ingresaron
         FROM asistencias a
         WHERE a.jornada_id = j.jornada_id AND a.estado_asistencia <> 'ANULADO'
       ) c
       WHERE j.fecha = @0
         AND (@1 IS NULL OR EXISTS (
           SELECT 1 FROM grupo_encargados ge_scope
           WHERE ge_scope.grupo_id = j.grupo_id
             AND ge_scope.usuario_id = @1
             AND ge_scope.estado = 'ACTIVO'
         ))
       ORDER BY j.fecha_hora_inicio_programada, g.nombre`,
      [fecha, usuarioEncargadoId],
    );

    return rows.map((r: any) => ({
      jornadaId: Number(r.jornadaId),
      grupoId: r.grupoId,
      grupo: r.grupo,
      etapa: r.etapa,
      horario: r.horaInicio ? `${r.horaInicio} – ${r.horaFin ?? '…'}` : 'Sin horario',
      horaInicio: r.horaInicio ?? null,
      horaFin: r.horaFin ?? null,
      tipoJornada: r.tipoJornada,
      origen: r.origen,
      estado: r.estado,
      encargado: r.encargado ?? null,
      integrantes: r.integrantes ?? 0,
      presentes: r.presentes,
      finalizados: r.finalizados,
      pendientes: r.estado === 'CANCELADA' ? 0 : r.pendientes ?? 0,
      justificados: r.justificados,
      faltasInjustificadas: r.faltasInjustificadas,
      salidasAnticipadas: r.salidasAnticipadas,
      ingresaron: r.ingresaron,
      justificacionesPorRevisar: r.justificacionesPorRevisar ?? 0,
      sinAbrir: Number(r.sinAbrir) === 1,
      sinCerrar: Number(r.sinCerrar) === 1,
    }));
  }

  /** Último evento de cada registro del día (entrada, salida o creación) */
  private async actividadReciente(fecha: string, usuarioEncargadoId: number | null) {
    return this.ds.query(
      `SELECT TOP 15
         a.asistencia_id,
         a.jornada_id AS jornadaId,
         ${NOMBRE('p')} AS persona,
         g.nombre AS grupo,
         a.estado_asistencia AS accion,
         a.tipo_registro AS tipoRegistro,
         COALESCE(a.fecha_hora_salida, a.fecha_hora_entrada, a.fecha_creacion) AS fechaHora,
         pr.apellido_paterno + ' ' + pr.nombres AS registradoPor
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       JOIN personas p ON p.persona_id = a.persona_id
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       LEFT JOIN usuarios ur ON ur.usuario_id = a.registrado_por_usuario_id
       LEFT JOIN personas pr ON pr.persona_id = ur.persona_id
       WHERE j.fecha = @0 AND a.estado_asistencia <> 'ANULADO'
         AND (@1 IS NULL OR EXISTS (
           SELECT 1 FROM grupo_encargados ge_scope
           WHERE ge_scope.grupo_id = j.grupo_id
             AND ge_scope.usuario_id = @1
             AND ge_scope.estado = 'ACTIVO'
         ))
       ORDER BY fechaHora DESC`,
      [fecha, usuarioEncargadoId],
    );
  }

  /** Siguiente jornada programada a partir de ahora */
  private async proximaJornada(usuarioEncargadoId: number | null) {
    const [row] = await this.ds.query(
      `SELECT TOP 1
         j.jornada_id AS jornadaId, g.nombre AS grupo, j.fecha,
         CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS horaInicio
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       WHERE j.estado = 'PROGRAMADA'
         AND (j.fecha_hora_inicio_programada > GETDATE()
              OR (j.fecha_hora_inicio_programada IS NULL AND j.fecha > CAST(GETDATE() AS date)))
         AND (@0 IS NULL OR EXISTS (
           SELECT 1 FROM grupo_encargados ge_scope
           WHERE ge_scope.grupo_id = j.grupo_id
             AND ge_scope.usuario_id = @0
             AND ge_scope.estado = 'ACTIVO'
         ))
       ORDER BY j.fecha, j.fecha_hora_inicio_programada`,
      [usuarioEncargadoId],
    );
    return row
      ? { jornadaId: Number(row.jornadaId), grupo: row.grupo, fecha: fechaColumna(row.fecha), horaInicio: row.horaInicio ?? null }
      : null;
  }

  /** Indicadores reales del mes por grupo activo (jornadas obligatorias cerradas) */
  private async metricasPorGrupo(
    fecha: string,
    usuarioEncargadoId: number | null,
  ): Promise<GrupoMetricasView[]> {
    const desde = `${fecha.slice(0, 8)}01`;
    const rows = await this.ds.query(
      `SELECT
         g.grupo_id AS grupoId, g.nombre, e.nombre AS etapa, e.codigo AS etapaCodigo,
         (SELECT COUNT(*) FROM grupo_integrantes gi
           WHERE gi.grupo_id = g.grupo_id AND gi.estado = 'ACTIVO') AS integrantes,
         enc.encargado,
         ISNULL(m.jornadas, 0) AS jornadas,
         ISNULL(m.asistencias, 0) AS asistencias,
         ISNULL(m.registros, 0) AS registros,
         ISNULL(m.faltasJustificadas, 0) AS faltasJustificadas,
         ISNULL(m.faltasInjustificadas, 0) AS faltasInjustificadas,
         ISNULL(m.salidasAnticipadas, 0) AS salidasAnticipadas,
         ISNULL(m.horas, 0) AS horas,
         ISNULL(v.participaciones, 0) AS participacionesVoluntarias,
         ISNULL(v.horas, 0) AS horasVoluntarias,
         ISNULL(m.horas, 0) + ISNULL(v.horas, 0) AS horasTotales,
         prox.fecha AS proximaFecha,
         prox.horaInicio AS proximaHora
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       ${ENCARGADO_APPLY('g.grupo_id')}
       OUTER APPLY (
         SELECT
           COUNT(DISTINCT j.jornada_id) AS jornadas,
           SUM(CASE WHEN a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS asistencias,
           SUM(CASE WHEN a.asistencia_id IS NOT NULL THEN 1 ELSE 0 END) AS registros,
           SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS faltasJustificadas,
           SUM(CASE WHEN a.estado_asistencia = 'FALTA_INJUSTIFICADA' THEN 1 ELSE 0 END) AS faltasInjustificadas,
           SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas,
           SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                    THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) / 60.0 END) AS horas
         FROM jornadas j
         LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.estado_asistencia <> 'ANULADO'
         WHERE j.grupo_id = g.grupo_id AND j.fecha BETWEEN @0 AND @1
           AND j.estado = 'CERRADA' AND j.tipo_jornada = 'OBLIGATORIA'
       ) m
       OUTER APPLY (
         SELECT
           SUM(CASE WHEN a.estado_asistencia IN ('PRESENTE','FINALIZADO','SALIDA_ANTICIPADA') THEN 1 ELSE 0 END) AS participaciones,
           SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL AND a.fecha_hora_salida IS NOT NULL
                    THEN DATEDIFF(minute, a.fecha_hora_entrada, a.fecha_hora_salida) / 60.0 ELSE 0 END) AS horas
         FROM jornadas j
         LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.estado_asistencia <> 'ANULADO'
         WHERE j.grupo_id = g.grupo_id AND j.fecha BETWEEN @0 AND @1
           AND j.estado = 'CERRADA' AND j.tipo_jornada = 'VOLUNTARIA'
       ) v
       OUTER APPLY (
         SELECT TOP 1 j.fecha, CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS horaInicio
         FROM jornadas j
         WHERE j.grupo_id = g.grupo_id AND j.estado = 'PROGRAMADA'
           AND j.fecha >= CAST(GETDATE() AS date)
         ORDER BY j.fecha, j.fecha_hora_inicio_programada
       ) prox
       WHERE g.estado = 'ACTIVO'
         AND (@2 IS NULL OR EXISTS (
           SELECT 1 FROM grupo_encargados ge_scope
           WHERE ge_scope.grupo_id = g.grupo_id
             AND ge_scope.usuario_id = @2
             AND ge_scope.estado = 'ACTIVO'
         ))
       ORDER BY e.orden, g.nombre`,
      [desde, fecha, usuarioEncargadoId],
    );

    return rows.map((r: any) => ({
      grupoId: r.grupoId,
      nombre: r.nombre,
      etapa: r.etapa,
      etapaCodigo: r.etapaCodigo,
      integrantes: r.integrantes ?? 0,
      encargado: r.encargado ?? null,
      jornadasMes: r.jornadas,
      asistenciasMes: r.asistencias,
      faltasJustificadasMes: r.faltasJustificadas,
      faltasInjustificadasMes: r.faltasInjustificadas,
      salidasAnticipadasMes: r.salidasAnticipadas,
      horasMes: Math.round(Number(r.horas) * 10) / 10,
      participacionesVoluntariasMes: Number(r.participacionesVoluntarias ?? 0),
      horasVoluntariasMes: Math.round(Number(r.horasVoluntarias) * 10) / 10,
      horasTotalesMes: Math.round(Number(r.horasTotales) * 10) / 10,
      asistenciaPct:
        r.etapaCodigo === 'ASPIRANTE_ESBAS'
          ? null
          : r.registros > 0
            ? Math.round((r.asistencias / r.registros) * 100)
            : null,
      proximaJornada: r.proximaFecha
        ? { fecha: fechaColumna(r.proximaFecha), horaInicio: r.proximaHora ?? null }
        : null,
    }));
  }

  private construirAtencion(jornadas: JornadaHoyView[]): AtencionView[] {
    const items: AtencionView[] = [];
    for (const j of jornadas) {
      if (j.sinAbrir) {
        items.push({
          tipo: 'JORNADA_SIN_ABRIR',
          descripcion: `${j.grupo}: programada a las ${j.horaInicio} y aún no se abre`,
          jornadaId: j.jornadaId,
        });
      }
      if (j.estado === 'ABIERTA' && j.pendientes > 0) {
        items.push({
          tipo: 'PENDIENTES',
          descripcion: `${j.grupo}: ${j.pendientes} sin registrar`,
          jornadaId: j.jornadaId,
        });
      }
      if (j.sinCerrar) {
        items.push({
          tipo: 'JORNADA_SIN_CERRAR',
          descripcion: `${j.grupo}: terminó a las ${j.horaFin} y sigue abierta`,
          jornadaId: j.jornadaId,
        });
      }
      if (j.justificacionesPorRevisar > 0) {
        items.push({
          tipo: 'JUSTIFICACIONES',
          descripcion: `${j.grupo}: ${j.justificacionesPorRevisar} justificación(es) por revisar`,
          jornadaId: j.jornadaId,
        });
      }
    }
    return items;
  }
}
