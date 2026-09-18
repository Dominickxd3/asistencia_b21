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
}

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Responde: ¿qué está ocurriendo hoy en Instrucción? */
  async hoy() {
    const fechaHoy = await this.fechaServidor();

    const [resumen] = await this.ds.query(
      `SELECT
         SUM(CASE WHEN a.estado_asistencia = 'PRESENTE' THEN 1 ELSE 0 END) AS presentesAhora,
         SUM(CASE WHEN a.fecha_hora_entrada IS NOT NULL THEN 1 ELSE 0 END) AS ingresaronHoy,
         SUM(CASE WHEN a.estado_asistencia = 'FALTA_JUSTIFICADA' THEN 1 ELSE 0 END) AS justificados,
         SUM(CASE WHEN a.estado_asistencia = 'SALIDA_ANTICIPADA' THEN 1 ELSE 0 END) AS salidasAnticipadas
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       WHERE j.fecha = @0 AND a.estado_asistencia <> 'ANULADO'`,
      [fechaHoy],
    );

    const jornadas = await this.jornadasDeHoy(fechaHoy);
    const actividad = await this.actividadReciente(fechaHoy);
    const atencion = this.construirAtencion(jornadas);

    const pendientesTotales = jornadas
      .filter((j) => j.estado === 'ABIERTA' || j.estado === 'PROGRAMADA')
      .reduce((acc, j) => acc + j.pendientes, 0);

    return {
      fecha: fechaHoy,
      resumen: {
        presentesAhora: resumen?.presentesAhora ?? 0,
        ingresaronHoy: resumen?.ingresaronHoy ?? 0,
        pendientes: pendientesTotales,
        justificados: resumen?.justificados ?? 0,
        salidasAnticipadas: resumen?.salidasAnticipadas ?? 0,
      },
      jornadas,
      requierenAtencion: atencion,
      actividad,
    };
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
           SUM(CASE WHEN a.asistencia_id IS NOT NULL AND a.estado_asistencia <> 'ANULADO' THEN 1 ELSE 0 END) AS conRegistro
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
        pendientes: Math.max(integrantes - conRegistro, 0),
        justificados: conteo?.justificados ?? 0,
      });
    }
    return resultado;
  }

  private async actividadReciente(fecha: string) {
    return this.ds.query(
      `SELECT TOP 15
         a.asistencia_id,
         p.apellido_paterno + ' ' + p.apellido_materno + ' ' + p.nombres AS persona,
         g.nombre AS grupo,
         a.estado_asistencia AS accion,
         COALESCE(a.fecha_hora_entrada, a.fecha_creacion) AS fechaHora,
         pr.apellido_paterno + ' ' + pr.nombres AS registradoPor
       FROM asistencias a
       JOIN jornadas j ON j.jornada_id = a.jornada_id
       JOIN personas p ON p.persona_id = a.persona_id
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN usuarios ur ON ur.usuario_id = a.registrado_por_usuario_id
       JOIN personas pr ON pr.persona_id = ur.persona_id
       WHERE j.fecha = @0 AND a.estado_asistencia <> 'ANULADO'
       ORDER BY fechaHora DESC`,
      [fecha],
    );
  }

  private construirAtencion(jornadas: JornadaHoyView[]) {
    const items: { tipo: string; descripcion: string; jornadaId: number }[] = [];
    for (const j of jornadas) {
      if (j.estado === 'ABIERTA' && j.pendientes > 0) {
        items.push({
          tipo: 'PENDIENTES',
          descripcion: `${j.grupo}: ${j.pendientes} sin registrar`,
          jornadaId: j.jornadaId,
        });
      }
      if (j.justificados > 0) {
        items.push({
          tipo: 'JUSTIFICACIONES',
          descripcion: `${j.grupo}: ${j.justificados} justificacion(es) por revisar`,
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
}
