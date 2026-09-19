import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface JornadaHoyView {
  jornadaId: number;
  grupo: string;
  etapa: string;
  horario: string;
  tipoJornada: string;
  estado: string;
  encargado: string | null;
  integrantes: number;
  presentes: number;
  finalizados: number;
  pendientes: number;
  justificados: number;
  primeraEntrada: string | null;
  ultimaSalida: string | null;
}

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Responde: ¿qué está ocurriendo hoy en Instrucción? */
  async hoy(fecha?: string, mes?: string, desde?: string, hasta?: string) {
    let inicio: string;
    let fin: string;
    let esRango = false;

    if (desde && hasta) {
      if (desde === hasta) {
        inicio = desde;
        fin = this.diaSiguiente(desde);
        esRango = false;
      } else {
        const dMin = desde < hasta ? desde : hasta;
        const dMax = desde < hasta ? hasta : desde;
        inicio = dMin;
        fin = this.diaSiguiente(dMax);
        esRango = true;
      }
    } else if (desde) {
      inicio = desde;
      fin = this.diaSiguiente(desde);
      esRango = false;
    } else if (fecha) {
      inicio = fecha;
      fin = this.diaSiguiente(fecha);
      esRango = false;
    } else if (mes) {
      inicio = `${mes}-01`;
      fin = this.primerDiaMesSiguiente(mes);
      esRango = true;
    } else {
      const fechaHoy = await this.fechaServidor();
      inicio = fechaHoy;
      fin = this.diaSiguiente(fechaHoy);
      esRango = false;
    }

    const [resumen] = await this.ds.query(
      `SELECT
         SUM(CASE WHEN a.estado_asistencia = 'PRESENTE' THEN 1 ELSE 0 END) AS presentesAhora,
         SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL THEN 1 ELSE 0 END) AS ingresaronHoy,
         SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS justificados,
         SUM(CASE WHEN a.estado_asistencia IN ('FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA') THEN 1 ELSE 0 END) AS faltas,
         SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       WHERE j.fecha >= @0 AND j.fecha < @1 AND a.estado_asistencia <> 'ANULADO'`,
      [inicio, fin],
    );

    const jornadas = esRango
      ? await this.jornadasDelMes(inicio, fin)
      : await this.jornadasDeHoy(inicio);
    const actividad = await this.actividadReciente(inicio, fin);
    const atencion = this.construirAtencion(jornadas);

    const pendientesTotales = jornadas
      .filter((j) => j.estado === 'ABIERTA' || j.estado === 'PROGRAMADA')
      .reduce((acc, j) => acc + j.pendientes, 0);

    return {
      fecha: inicio,
      fechaFin: esRango ? (hasta && desde ? (desde < hasta ? hasta : desde) : fin) : inicio,
      periodo: esRango ? 'rango' : 'dia',
      resumen: {
        presentesAhora: resumen?.presentesAhora ?? 0,
        ingresaronHoy: resumen?.ingresaronHoy ?? 0,
        pendientes: pendientesTotales,
        justificados: resumen?.justificados ?? 0,
        faltas: resumen?.faltas ?? 0,
        salidasAnticipadas: resumen?.salidasAnticipadas ?? 0,
      },
      jornadas,
      requierenAtencion: atencion,
      actividad,
    };
  }

  private async jornadasDelMes(inicio: string, fin: string): Promise<JornadaHoyView[]> {
    const rows = await this.ds.query(
      `SELECT
         g.grupo_id,
         g.nombre AS grupo,
         e.nombre AS etapa,
         COUNT(j.jornada_id) AS jornadas,
         pe.apellido_paterno + ' ' + pe.nombres AS encargado
       FROM grupos_formacion g
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       LEFT JOIN jornadas j ON j.grupo_id = g.grupo_id AND j.fecha >= @0 AND j.fecha < @1
       LEFT JOIN grupo_encargados ge ON ge.grupo_id = g.grupo_id AND ge.estado = 'ACTIVO'
       LEFT JOIN usuarios ue ON ue.usuario_id = ge.usuario_id
       LEFT JOIN personas pe ON pe.persona_id = ue.persona_id
       WHERE g.estado = 'ACTIVO'
       GROUP BY g.grupo_id, g.nombre, e.nombre, pe.apellido_paterno, pe.nombres
       ORDER BY g.grupo_id`,
      [inicio, fin],
    );

    const resultado: JornadaHoyView[] = [];
    for (const r of rows) {
      const [conteo] = await this.ds.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN j.tipo_jornada = 'OBLIGATORIA'
             AND e.codigo IN ('POSTULANTE','ASPIRANTE_COMPANIA')
             AND (DATEDIFF(day, CONVERT(date, '19000107'), j.fecha) % 7) IN (0,3,5)
             THEN j.jornada_id END) AS jornadas,
           COUNT(DISTINCT gi.persona_id) AS integrantes,
           SUM(CASE WHEN a.estado_asistencia IN ('PRESENTE', 'FINALIZADO') THEN 1 ELSE 0 END) AS presentes,
           SUM(CASE WHEN a.estado_asistencia = 'FINALIZADO' THEN 1 ELSE 0 END) AS finalizados,
           SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS justificados,
           SUM(CASE WHEN a.asistencia_id IS NOT NULL AND a.estado_asistencia <> 'ANULADO' THEN 1 ELSE 0 END) AS conRegistro
         FROM jornadas j
         JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
         JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
         LEFT JOIN grupo_integrantes gi ON gi.grupo_id = j.grupo_id AND gi.estado = 'ACTIVO'
         LEFT JOIN asistencias a ON a.jornada_id = j.jornada_id AND a.persona_id = gi.persona_id
         WHERE j.grupo_id = @0 AND j.fecha >= @1 AND j.fecha < @2`,
        [r.grupo_id, inicio, fin],
      );
      const jornadas = Number(conteo?.jornadas ?? 0);
      const integrantes = Number(conteo?.integrantes ?? 0);
      const esperados = jornadas * integrantes;
      const conRegistro = Number(conteo?.conRegistro ?? 0);
      resultado.push({
        jornadaId: r.grupo_id,
        grupo: r.grupo,
        etapa: r.etapa,
        horario: `${jornadas} jornada${jornadas === 1 ? '' : 's'}`,
        tipoJornada: 'RESUMEN_MENSUAL',
        estado: 'RESUMEN',
        encargado: r.encargado ?? null,
        integrantes: esperados,
        presentes: Number(conteo?.presentes ?? 0),
        finalizados: Number(conteo?.finalizados ?? 0),
        pendientes: Math.max(esperados - conRegistro, 0),
        justificados: Number(conteo?.justificados ?? 0),
        primeraEntrada: null,
        ultimaSalida: null,
      });
    }
    return resultado;
  }

  private async jornadasDeHoy(fecha: string): Promise<JornadaHoyView[]> {
    const rows = await this.ds.query(
      `SELECT
         j.jornada_id,
         g.nombre AS grupo,
         e.nombre AS etapa,
         CONVERT(varchar(5), j.fecha_hora_inicio_programada, 108) AS hora_inicio,
         CONVERT(varchar(5), j.fecha_hora_fin_programada, 108) AS hora_fin,
         j.tipo_jornada,
         j.estado,
         pe.apellido_paterno + ' ' + pe.nombres AS encargado,
         g.grupo_id
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       LEFT JOIN grupo_encargados ge ON ge.grupo_id = g.grupo_id AND ge.estado = 'ACTIVO'
       LEFT JOIN usuarios ue ON ue.usuario_id = ge.usuario_id
       LEFT JOIN personas pe ON pe.persona_id = ue.persona_id
       WHERE j.fecha = @0
       ORDER BY j.fecha_hora_inicio_programada`,
      [fecha],
    );

    const resultado: JornadaHoyView[] = [];
    for (const r of rows) {
      const [conteo] = await this.ds.query(
        `SELECT
           (SELECT COUNT(*) FROM grupo_integrantes WHERE grupo_id = @1 AND estado = 'ACTIVO') AS integrantes,
           SUM(CASE WHEN a.estado_asistencia = 'PRESENTE' THEN 1 ELSE 0 END) AS presentes,
           SUM(CASE WHEN a.estado_asistencia = 'FINALIZADO' THEN 1 ELSE 0 END) AS finalizados,
           SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS justificados,
           SUM(CASE WHEN a.asistencia_id IS NOT NULL AND a.estado_asistencia <> 'ANULADO' THEN 1 ELSE 0 END) AS conRegistro,
           CONVERT(varchar(5), MIN(a.fecha_hora_entrada), 108) AS primeraEntrada,
           CONVERT(varchar(5), MAX(a.fecha_hora_salida), 108) AS ultimaSalida
         FROM asistencias a
         WHERE a.jornada_id = @0
         GROUP BY ()`,
        [r.jornada_id, r.grupo_id],
      );
      const integrantes = conteo?.integrantes ?? 0;
      const conRegistro = conteo?.conRegistro ?? 0;
      resultado.push({
        jornadaId: r.jornada_id,
        grupo: r.grupo,
        etapa: r.etapa,
        horario: r.hora_inicio ? `${r.hora_inicio} - ${r.hora_fin}` : 'Sin horario',
        tipoJornada: r.tipo_jornada,
        estado: r.estado,
        encargado: r.encargado ?? null,
        integrantes,
        presentes: conteo?.presentes ?? 0,
        finalizados: conteo?.finalizados ?? 0,
        pendientes: r.tipo_jornada === 'OBLIGATORIA' ? Math.max(integrantes - conRegistro, 0) : 0,
        justificados: conteo?.justificados ?? 0,
        primeraEntrada: conteo?.primeraEntrada ?? null,
        ultimaSalida: conteo?.ultimaSalida ?? null,
      });
    }
    return resultado;
  }

  private async actividadReciente(inicio: string, fin: string) {
    return this.ds.query(
      `SELECT TOP 5 movimientos.* FROM (
         SELECT a.asistencia_id, p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS persona,
           g.nombre AS grupo, 'ENTRADA' AS accion, a.fecha_hora_entrada AS fechaHora,
           pr.apellido_paterno + ' ' + pr.nombres AS registradoPor
         FROM asistencias a
         JOIN jornadas j ON j.jornada_id = a.jornada_id
         JOIN personas p ON p.persona_id = a.persona_id
         JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
         JOIN usuarios ur ON ur.usuario_id = a.registrado_por_usuario_id
         JOIN personas pr ON pr.persona_id = ur.persona_id
         WHERE j.fecha >= @0 AND j.fecha < @1 AND a.estado_asistencia <> 'ANULADO' AND a.fecha_hora_entrada IS NOT NULL
         UNION ALL
         SELECT a.asistencia_id, p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres,
           g.nombre, 'SALIDA', a.fecha_hora_salida,
           pr.apellido_paterno + ' ' + pr.nombres
         FROM asistencias a
         JOIN jornadas j ON j.jornada_id = a.jornada_id
         JOIN personas p ON p.persona_id = a.persona_id
         JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
         JOIN usuarios ur ON ur.usuario_id = a.registrado_por_usuario_id
         JOIN personas pr ON pr.persona_id = ur.persona_id
         WHERE j.fecha >= @0 AND j.fecha < @1 AND a.estado_asistencia <> 'ANULADO' AND a.fecha_hora_salida IS NOT NULL
       ) movimientos ORDER BY fechaHora DESC`,
      [inicio, fin],
    );
  }

  private construirAtencion(jornadas: JornadaHoyView[]) {
    const items: { tipo: string; descripcion: string; grupo: string; cantidad: number; jornadaId: number }[] = [];
    for (const j of jornadas) {
      if ((j.estado === 'ABIERTA' || j.estado === 'RESUMEN') && j.pendientes > 0) {
        items.push({
          tipo: 'PENDIENTES',
          descripcion: `${j.pendientes} pendiente${j.pendientes === 1 ? '' : 's'}`,
          grupo: j.grupo,
          cantidad: j.pendientes,
          jornadaId: j.jornadaId,
        });
      }
      if (j.justificados > 0) {
        items.push({
          tipo: 'JUSTIFICACIONES',
          descripcion: `${j.justificados} falta${j.justificados === 1 ? '' : 's'} justificada${j.justificados === 1 ? '' : 's'}`,
          grupo: j.grupo,
          cantidad: j.justificados,
          jornadaId: j.jornadaId,
        });
      }
    }
    return items;
  }

  /** Fecha oficial: siempre la del servidor SQL Server */
  private async fechaServidor(): Promise<string> {
    const [row] = await this.ds.query(`SELECT CONVERT(char(10), GETDATE(), 126) AS hoy`);
    return row.hoy;
  }

  private diaSiguiente(fecha: string): string {
    const valor = new Date(`${fecha}T00:00:00Z`);
    valor.setUTCDate(valor.getUTCDate() + 1);
    return valor.toISOString().slice(0, 10);
  }

  private primerDiaMesSiguiente(mes: string): string {
    const [year, month] = mes.split('-').map(Number);
    return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  }
}
