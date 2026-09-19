import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { ReportsDataService } from './reports-data.service';
import { ReportePdfBuilder } from './reporte-pdf.builder';
import { AuditoriaService } from '../audit/auditoria.service';
import { GenerarReporteDto } from './dto/reporte.dto';
import ExcelJS from 'exceljs';

@Injectable()
export class ReportsService {
  constructor(
    private readonly data: ReportsDataService,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  historial() {
    return this.ds.query(
      `SELECT TOP 10 r.reporte_id AS id, r.codigo_reporte AS codigo,
              r.tipo_reporte AS tipo, r.fecha_desde AS desde, r.fecha_hasta AS hasta,
              r.hash_documento AS hash,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS generadoPor
       FROM reportes_generados r
       LEFT JOIN usuarios u ON u.usuario_id = r.generado_por_usuario_id
       LEFT JOIN personas p ON p.persona_id = u.persona_id
       ORDER BY r.reporte_id DESC`,
    );
  }

  jornadas(desde?: string, hasta?: string) {
    const inicio = desde || new Date().toISOString().slice(0, 10);
    const fin = hasta || inicio;
    return this.ds.query(
      `SELECT j.jornada_id AS id, j.fecha, j.tipo_jornada AS tipo, j.estado,
              g.grupo_id AS grupoId, g.nombre AS grupo
       FROM jornadas j
       JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       WHERE j.fecha BETWEEN @0 AND @1
       ORDER BY j.fecha DESC, g.nombre`,
      [inicio, fin],
    );
  }

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

  async generarExcel(dto: GenerarReporteDto, usuarioId: number): Promise<{ archivo: Buffer; nombre: string }> {
    if (!dto.grupoIds?.length) throw new UnprocessableEntityException('Seleccione al menos un grupo');
    if (dto.hasta < dto.desde) throw new UnprocessableEntityException('La fecha final no puede ser anterior a la inicial');
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Área de Instrucción · Cía. de Bomberos Rímac N.º 21';
    libro.created = new Date();
    const grupos = await this.data.nombresGrupos(dto.grupoIds);
    const resumen = libro.addWorksheet('Resumen');
    this.encabezadoExcel(resumen, this.nombreReporte(dto.tipo), dto.desde, dto.hasta, grupos);

    if (dto.tipo === 'ESTADO_GENERAL') {
      const filas = await this.data.estadoGeneral(dto.grupoIds, dto.desde, dto.hasta);
      for (const grupo of grupos) {
        const detalle = filas.filter((r: any) => r.grupo === grupo);
        const hoja = libro.addWorksheet(this.nombreHoja(grupo));
        this.encabezadoExcel(hoja, `Detalle · ${grupo}`, dto.desde, dto.hasta, [grupo]);
        this.tablaExcel(hoja, ['Integrante','Jornadas obligatorias','Asistencias','Faltas justificadas','Faltas injustificadas','Participaciones voluntarias','Horas','Cumplimiento'], detalle.map((r:any)=>{
          const e=Number(r.jornadasObligatorias??0),a=Number(r.asistencias??0);
          return [r.persona,e,a,Number(r.faltasJustificadas??0),Number(r.faltasInjustificadas??0),Number(r.participacionesVoluntarias??0),Math.round(Number(r.horas??0)*10)/10,e?Math.round(a/e*1000)/1000:'No aplica'];
        }));
        hoja.getColumn(8).numFmt='0.0%';
      }
    } else if (dto.tipo === 'DETALLE_INDIVIDUAL') {
      if (!dto.personaId) throw new UnprocessableEntityException('Seleccione una persona');
      const filas=await this.data.detalleIndividual(dto.personaId,dto.desde,dto.hasta);
      const hoja=libro.addWorksheet('Detalle individual');
      this.encabezadoExcel(hoja,'Detalle individual',dto.desde,dto.hasta,grupos);
      this.tablaExcel(hoja,['Fecha','Grupo','Tipo de jornada','Estado','Entrada','Salida','Tipo de registro','Observación'],filas.map((r:any)=>[this.fechaLegible(String(r.fecha).slice(0,10)),r.grupo,r.tipo,r.estado,r.entrada??'—',r.salida??'—',r.tipoRegistro,r.observacion??'']));
    } else {
      if (!dto.jornadaId) throw new UnprocessableEntityException('Seleccione una jornada');
      const filas=await this.datosJornada(dto.jornadaId);
      const hoja=libro.addWorksheet('Jornada');
      this.encabezadoExcel(hoja,'Jornada específica',dto.desde,dto.hasta,grupos);
      this.tablaExcel(hoja,['Integrante','Estado','Entrada','Salida','Tipo de registro','Registrado por'],filas.map((r:any)=>[r.persona,r.estado,r.entrada??'—',r.salida??'—',r.registro,r.registradoPor??'—']));
    }
    const datos = await libro.xlsx.writeBuffer();
    await this.auditoria.registrar({usuarioId,accion:'REPORT_EXCEL_GENERATED',modulo:'reports',entidad:'reportes_generados',valorNuevo:{tipo:dto.tipo,desde:dto.desde,hasta:dto.hasta,grupos}});
    return {archivo:Buffer.from(datos),nombre:`${dto.tipo.toLowerCase()}_${dto.desde}_a_${dto.hasta}.xlsx`};
  }

  // ---------- Construcción ----------

  private encabezadoExcel(hoja: ExcelJS.Worksheet, titulo: string, desde: string, hasta: string, grupos: string[]): void {
    hoja.mergeCells('A1:H1'); hoja.getCell('A1').value='COMPAÑÍA DE BOMBEROS VOLUNTARIOS RÍMAC N.º 21';
    hoja.mergeCells('A2:H2'); hoja.getCell('A2').value='Área de Instrucción';
    hoja.mergeCells('A3:H3'); hoja.getCell('A3').value=titulo;
    hoja.mergeCells('A4:H4'); hoja.getCell('A4').value=`Periodo: ${this.fechaLegible(desde)} al ${this.fechaLegible(hasta)}`;
    hoja.mergeCells('A5:H5'); hoja.getCell('A5').value=`Grupos: ${grupos.join(' · ')}`;
    ['A1','A2','A3'].forEach(c=>{hoja.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC8102E'}};hoja.getCell(c).font={color:{argb:'FFFFFFFF'},bold:true,size:c==='A1'?16:11};});
    hoja.getCell('A4').font={bold:true,color:{argb:'FF344054'}};hoja.getCell('A5').font={color:{argb:'FF667085'}};
    hoja.views=[{state:'frozen',ySplit:7}];
  }

  private tablaExcel(hoja: ExcelJS.Worksheet, columnas: string[], filas: ExcelJS.CellValue[][]): void {
    const inicio=7;const cabecera=hoja.getRow(inicio);cabecera.values=columnas;
    cabecera.eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17213C'}};c.font={bold:true,color:{argb:'FFFFFFFF'}};c.alignment={vertical:'middle',wrapText:true};});cabecera.height=28;
    filas.forEach((valores,i)=>{const fila=hoja.getRow(inicio+1+i);fila.values=valores;fila.alignment={vertical:'middle'};if(i%2)fila.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7F8FA'}});fila.eachCell(c=>{c.border={bottom:{style:'thin',color:{argb:'FFE4E7EC'}}};});});
    hoja.columns.forEach((col,i)=>{col.width=i===0?34:20;});
    hoja.autoFilter={from:{row:inicio,column:1},to:{row:inicio,column:columnas.length}};
  }

  private nombreHoja(nombre: string): string { return nombre.replace(/[\\/?*\[\]:]/g,' ').slice(0,31); }
  private nombreReporte(tipo: string): string { return tipo==='ESTADO_GENERAL'?'Reporte detallado de asistencia':tipo==='DETALLE_INDIVIDUAL'?'Detalle individual':'Jornada específica'; }

  private datosJornada(jornadaId: number) {
    return this.ds.query(
      `SELECT p.apellido_paterno + ' ' + ISNULL(p.apellido_materno+' ','')+p.nombres AS persona,
              a.estado_asistencia AS estado, CONVERT(varchar(5),a.fecha_hora_entrada,108) AS entrada,
              CONVERT(varchar(5),a.fecha_hora_salida,108) AS salida, a.tipo_registro AS registro,
              pr.apellido_paterno AS registradoPor
       FROM asistencias a JOIN personas p ON p.persona_id=a.persona_id
       LEFT JOIN usuarios u ON u.usuario_id=a.registrado_por_usuario_id
       LEFT JOIN personas pr ON pr.persona_id=u.persona_id
       WHERE a.jornada_id=@0 ORDER BY p.apellido_paterno`,[jornadaId]);
  }

  private async reporteGeneral(dto: GenerarReporteDto, grupos: string[]): Promise<Buffer> {
    const filas = await this.data.estadoGeneral(dto.grupoIds, dto.desde, dto.hasta);
    const n = (v: unknown) => Number(v ?? 0);
    const resumenGrupos = new Map<string, any>();
    filas.forEach((r: any) => {
      const g = resumenGrupos.get(r.grupo) ?? { grupo:r.grupo, etapa:r.etapa, integrantes:0, esperadas:0, asistencias:0, faltas:0 };
      g.integrantes++; g.esperadas += n(r.jornadasObligatorias); g.asistencias += n(r.asistencias); g.faltas += n(r.faltasInjustificadas);
      resumenGrupos.set(r.grupo, g);
    });
    const docs = new ReportePdfBuilder()
      .encabezado('Reporte detallado de asistencia', `Documento emitido por el Área de Instrucción`)
      .seccion('Periodo del reporte')
      .resumenPares([
        ['Fecha inicial', this.fechaLegible(dto.desde)],
        ['Fecha final', this.fechaLegible(dto.hasta)],
        ['Grupos incluidos', grupos.join(' · ')],
      ])
      .nota('Criterio aplicado: el cumplimiento considera únicamente jornadas obligatorias. Las jornadas voluntarias y ESBAS se detallan como participación y horas adicionales, sin generar faltas.');

    for (const g of resumenGrupos.values()) {
      const detalle = filas.filter((r: any) => r.grupo === g.grupo);
      const porcentaje = g.esperadas ? `${Math.round(g.asistencias / g.esperadas * 1000) / 10}%` : 'No aplica';
      docs
        .seccion(g.grupo, g.etapa)
        .resumenPares([
          ['Integrantes considerados', g.integrantes],
          ['Registros obligatorios esperados', g.esperadas],
          ['Asistencias obligatorias registradas', g.asistencias],
          ['Faltas injustificadas', g.faltas],
          ['Cumplimiento del grupo', porcentaje],
        ])
        .tabla(
          [{nombre:'Integrante',ancho:175},{nombre:'Oblig.',ancho:50,align:'center'},{nombre:'Asist.',ancho:45,align:'center'},{nombre:'F. just.',ancho:45,align:'center'},{nombre:'F. injust.',ancho:50,align:'center'},{nombre:'Volunt.',ancho:45,align:'center'},{nombre:'Horas',ancho:40,align:'right'},{nombre:'Cumplimiento',ancho:65,align:'right'}],
          detalle.map((r:any)=>{const e=n(r.jornadasObligatorias),a=n(r.asistencias);return[r.persona,e,a,n(r.faltasJustificadas),n(r.faltasInjustificadas),n(r.participacionesVoluntarias),Math.round(n(r.horas)*10)/10,e?`${Math.round(a/e*1000)/10}%`:'No aplica']}),
        );
    }
    return docs.finalizar();
  }

  private fechaLegible(valor: string): string { const [a,m,d]=valor.split('-'); return `${d}/${m}/${a}`; }

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
