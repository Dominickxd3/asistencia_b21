import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { ReportsDataService } from './reports-data.service';
import { ReportePdfBuilder } from './reporte-pdf.builder';
import { AuditoriaService } from '../audit/auditoria.service';
import { GenerarReporteDto } from './dto/reporte.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly data: ReportsDataService,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async generar(dto: GenerarReporteDto, usuarioId: number): Promise<{ pdf: Buffer; nombre: string }> {
    if (!dto.grupoIds?.length) {
      throw new UnprocessableEntityException('Seleccione al menos un grupo');
    }
    if (dto.hasta < dto.desde) {
      throw new UnprocessableEntityException('fecha hasta no puede ser menor que fecha desde');
    }

    const grupos = await this.data.nombresGrupos(dto.grupoIds);
    let pdf: Buffer;
    let nombre: string;

    if (dto.tipo === 'ESTADO_GENERAL') {
      pdf = await this.reporteGeneral(dto, grupos);
      nombre = `estado-general_${dto.desde}_a_${dto.hasta}.pdf`;
    } else if (dto.tipo === 'DETALLE_INDIVIDUAL') {
      if (!dto.personaId) throw new UnprocessableEntityException('personaId es obligatorio para DETALLE_INDIVIDUAL');
      pdf = await this.reporteIndividual(dto);
      nombre = `detalle_persona_${dto.personaId}_${dto.desde}_a_${dto.hasta}.pdf`;
    } else {
      if (!dto.jornadaId) throw new UnprocessableEntityException('jornadaId es obligatorio para JORNADA');
      pdf = await this.reporteJornada(dto.jornadaId);
      nombre = `jornada_${dto.jornadaId}.pdf`;
    }

    // Registro formal del reporte
    const codigo = `RPT-${Date.now()}`;
    const hash = createHash('sha256').update(pdf).digest('hex');
    await this.ds.query(
      `INSERT INTO reportes_generados
         (codigo_reporte, tipo_reporte, fecha_desde, fecha_hasta, filtros_json, generado_por_usuario_id, hash_documento)
       VALUES (@0, @1, @2, @3, @4, @5, @6)`,
      [codigo, dto.tipo, dto.desde, dto.hasta, JSON.stringify({ grupoIds: dto.grupoIds, personaId: dto.personaId ?? null }), usuarioId, hash],
    );

    // reporte_grupos (detalle del consolidado)
    const [ultimo] = await this.ds.query(
      `SELECT reporte_id FROM reportes_generados WHERE codigo_reporte = @0`,
      [codigo],
    );
    if (ultimo) {
      for (const gId of dto.grupoIds) {
        await this.ds.query(`INSERT INTO reporte_grupos (reporte_id, grupo_id) VALUES (@0, @1)`, [ultimo.reporte_id, gId]);
      }
    }

    await this.auditoria.registrar({
      usuarioId,
      accion: 'REPORT_GENERATED',
      modulo: 'reports',
      entidad: 'reportes_generados',
      entidadId: codigo,
      valorNuevo: { tipo: dto.tipo, desde: dto.desde, hasta: dto.hasta, grupos },
    });

    return { pdf, nombre };
  }

  // ---------- Construcción ----------

  private async reporteGeneral(dto: GenerarReporteDto, grupos: string[]): Promise<Buffer> {
    const filas = await this.data.estadoGeneral(dto.grupoIds, dto.desde, dto.hasta);
    const docs = new ReportePdfBuilder()
      .encabezado('Reporte de asistencia — Estado general', `${grupos.join(' · ')} | ${dto.desde} → ${dto.hasta}`)
      .tabla(
        [
          { nombre: 'Persona', ancho: 150 },
          { nombre: 'Grupo', ancho: 90 },
          { nombre: 'Asist.', ancho: 45 },
          { nombre: 'F. just.', ancho: 50 },
          { nombre: 'F. inj.', ancho: 45 },
          { nombre: 'Sal. antic.', ancho: 60 },
          { nombre: 'Horas', ancho: 45 },
        ],
        filas.map((r: any) => [r.persona, r.grupo, r.asistencias ?? 0, r.faltasJustificadas ?? 0, r.faltasInjustificadas ?? 0, r.salidasAnticipadas ?? 0, Math.round((r.horas ?? 0) * 10) / 10]),
      );
    return docs.finalizar();
  }

  private async reporteIndividual(dto: GenerarReporteDto): Promise<Buffer> {
    const [persona] = await this.ds.query(
      `SELECT apellido_paterno + ' ' + ISNULL(apellido_materno + ' ', '') + nombres AS nombre FROM personas WHERE persona_id = @0`,
      [dto.personaId],
    );
    if (!persona) throw new NotFoundException('Persona no encontrada');
    const filas = await this.data.detalleIndividual(dto.personaId!, dto.desde, dto.hasta);

    const docs = new ReportePdfBuilder()
      .encabezado('Detalle individual', `${persona.nombre} | ${dto.desde} → ${dto.hasta}`)
      .tabla(
        [
          { nombre: 'Fecha', ancho: 70 },
          { nombre: 'Grupo', ancho: 90 },
          { nombre: 'Tipo', ancho: 65 },
          { nombre: 'Estado', ancho: 90 },
          { nombre: 'Entrada', ancho: 50 },
          { nombre: 'Salida', ancho: 50 },
          { nombre: 'Registro', ancho: 55 },
        ],
        filas.map((r: any) => [r.fecha, r.grupo, r.tipo, r.estado, r.entrada ?? '—', r.salida ?? '—', r.tipoRegistro]),
      );
    return docs.finalizar();
  }

  private async reporteJornada(jornadaId: number): Promise<Buffer> {
    const [jornada] = await this.ds.query(
      `SELECT j.jornada_id, j.fecha, j.tipo_jornada AS tipo, j.estado, g.nombre AS grupo, e.nombre AS etapa
       FROM jornadas j JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       JOIN etapas_formacion e ON e.etapa_id = g.etapa_id
       WHERE j.jornada_id = @0`,
      [jornadaId],
    );
    if (!jornada) throw new NotFoundException('Jornada no encontrada');

    const filas = await this.ds.query(
      `SELECT p.apellido_paterno + ' ' + ISNULL(p.apellido_materno+' ','')+p.nombres AS persona,
              a.estado_asistencia AS estado,
              CONVERT(varchar(5), a.fecha_hora_entrada, 108) AS entrada,
              CONVERT(varchar(5), a.fecha_hora_salida, 108) AS salida,
              a.tipo_registro AS registro, a.observacion,
              pr.apellido_paterno AS registradoPor
       FROM asistencias a
       JOIN personas p ON p.persona_id = a.persona_id
       LEFT JOIN usuarios u ON u.usuario_id = a.registrado_por_usuario_id
       LEFT JOIN personas pr ON pr.persona_id = u.persona_id
       WHERE a.jornada_id = @0
       ORDER BY p.apellido_paterno`,
      [jornadaId],
    );

    const docs = new ReportePdfBuilder()
      .encabezado('Reporte de jornada', `${jornada.grupo} (${jornada.etapa}) | ${jornada.fecha} | Estado: ${jornada.estado}`)
      .tabla(
        [
          { nombre: 'Persona', ancho: 130 },
          { nombre: 'Estado', ancho: 85 },
          { nombre: 'Entrada', ancho: 45 },
          { nombre: 'Salida', ancho: 45 },
          { nombre: 'Registro', ancho: 55 },
          { nombre: 'Registrado por', ancho: 100 },
        ],
        filas.map((r: any) => [r.persona, r.estado, r.entrada ?? '—', r.salida ?? '—', r.registro, r.registradoPor ?? '—']),
      );
    return docs.finalizar();
  }
}
