import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { AuditoriaService } from '../audit/auditoria.service';
import { GenerarReporteDto } from './dto/reporte.dto';
import { ReporteExcelRenderer } from './reporte-excel.builder';
import { ReportePdfRenderer } from './reporte-pdf.builder';
import { DocReporte, describirPeriodo, horas, nombreArchivo, porcentaje, rangoTexto, tonoCumplimiento } from './reporte.modelo';
import { ReportsDataService } from './reports-data.service';
import { fechaColumna } from '../../common/utils/fecha.util';

const n = (v: unknown): number => Number(v ?? 0);
const aplicaObligatoria = (codigo: string): boolean => ['POSTULANTE', 'ASPIRANTE_COMPANIA'].includes(codigo);
const pct = (asistidas: number, esperadas: number): number | null => esperadas > 0 ? asistidas / esperadas : null;

@Injectable()
export class ReportsService {
  constructor(
    private readonly data: ReportsDataService,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  async generar(dto: GenerarReporteDto, usuarioId: number): Promise<{ archivo: Buffer; nombre: string; mime: string }> {
    dto.grupoIds = [...new Set((dto.grupoIds ?? []).map(Number))];
    dto.formato = dto.formato ?? 'PDF';
    if (dto.hasta < dto.desde) throw new UnprocessableEntityException('La fecha hasta no puede ser menor que la fecha desde');
    if (dto.tipo === 'ESTADO_GENERAL' && dto.grupoIds.length === 0) {
      throw new UnprocessableEntityException('Seleccione al menos un grupo');
    }
    if (dto.tipo === 'DETALLE_INDIVIDUAL' && dto.grupoIds.length !== 1) {
      throw new UnprocessableEntityException('El detalle individual requiere seleccionar exactamente un grupo');
    }
    const [hoy, generadoPor, jefes] = await Promise.all([
      this.data.hoy(), this.data.nombreUsuario(usuarioId), this.data.jefesInstruccion(),
    ]);
    const codigo = await this.data.siguienteCodigo(hoy);
    const emitido = new Date();
    let doc: DocReporte;
    if (dto.tipo === 'ESTADO_GENERAL') {
      doc = await this.general(dto, codigo, generadoPor, jefes, hoy, emitido);
    } else if (dto.tipo === 'DETALLE_INDIVIDUAL') {
      if (!dto.personaId) throw new UnprocessableEntityException('personaId es obligatorio para DETALLE_INDIVIDUAL');
      doc = await this.individual(dto, codigo, generadoPor, jefes, hoy, emitido);
    } else {
      if (!dto.jornadaId) throw new UnprocessableEntityException('jornadaId es obligatorio para JORNADA');
      doc = await this.porJornada(dto, codigo, generadoPor, jefes, emitido);
    }

    const archivo = dto.formato === 'EXCEL'
      ? await new ReporteExcelRenderer().render(doc)
      : await new ReportePdfRenderer().render(doc);
    const extension = dto.formato === 'EXCEL' ? 'xlsx' : 'pdf';
    const mime = dto.formato === 'EXCEL'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';
    const nombre = `${nombreArchivo('rimac21', dto.tipo.toLowerCase(), doc.codigo)}.${extension}`;
    const hash = createHash('sha256').update(archivo).digest('hex');
    const filtros = { formato: dto.formato, grupoIds: dto.grupoIds, personaId: dto.personaId ?? null, jornadaId: dto.jornadaId ?? null };
    await this.ds.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO reportes_generados
           (codigo_reporte, tipo_reporte, fecha_desde, fecha_hasta, filtros_json, generado_por_usuario_id, hash_documento)
         VALUES (@0, @1, @2, @3, @4, @5, @6)`,
        [codigo, dto.tipo, dto.desde, dto.hasta, JSON.stringify(filtros), usuarioId, hash],
      );
      const [reporte] = await tx.query(`SELECT reporte_id FROM reportes_generados WHERE codigo_reporte = @0`, [codigo]);
      for (const grupoId of dto.grupoIds) {
        await tx.query(`INSERT INTO reporte_grupos (reporte_id, grupo_id) VALUES (@0, @1)`, [reporte.reporte_id, grupoId]);
      }
    });
    await this.auditoria.registrar({
      usuarioId, accion: 'REPORT_GENERATED', modulo: 'reports', entidad: 'reportes_generados', entidadId: codigo,
      valorNuevo: { tipo: dto.tipo, formato: dto.formato, desde: dto.desde, hasta: dto.hasta },
    });
    return { archivo, nombre, mime };
  }

  async recientes(limite = 10) {
    const rows = await this.ds.query(
      `SELECT TOP (@0) r.reporte_id AS id, r.codigo_reporte AS codigo, r.tipo_reporte AS tipo,
         r.fecha_desde AS desde, r.fecha_hasta AS hasta, r.fecha_generacion AS fechaGeneracion,
         ISNULL(JSON_VALUE(r.filtros_json, '$.formato'), 'PDF') AS formato,
         p.apellido_paterno + ' ' + p.nombres AS generadoPor,
         STUFF((SELECT ', ' + g.nombre FROM reporte_grupos rg
                JOIN grupos_formacion g ON g.grupo_id = rg.grupo_id
                WHERE rg.reporte_id = r.reporte_id FOR XML PATH('')), 1, 2, '') AS grupos
       FROM reportes_generados r
       JOIN usuarios u ON u.usuario_id = r.generado_por_usuario_id
       JOIN personas p ON p.persona_id = u.persona_id
       ORDER BY r.fecha_generacion DESC, r.reporte_id DESC`,
      [limite],
    );
    return rows.map((r: any) => ({
      ...r,
      id: Number(r.id),
      desde: fechaColumna(r.desde),
      hasta: fechaColumna(r.hasta),
      grupos: r.grupos ?? null,
    }));
  }

  private base(codigo: string, tipo: string, titulo: string, dto: GenerarReporteDto, generadoPor: string,
    jefes: string[], emitido: Date, orientacion: 'portrait' | 'landscape', alcance: string): DocReporte {
    return {
      codigo, tipo, titulo, periodo: describirPeriodo(dto.desde, dto.hasta), rango: rangoTexto(dto.desde, dto.hasta),
      alcance, generadoPor, generadoEn: emitido, orientacion, kpis: [], hallazgos: [], secciones: [],
      criterios: [
        'Solo se consideran grupos, personas y membresías activas al momento de emitir el informe.',
        'El cumplimiento obligatorio aplica a Postulantes y Aspirantes de Compañía; para ESBAS se muestra No aplica.',
        'Las jornadas voluntarias se informan como participación y no generan faltas.',
        'Los tiempos se calculan únicamente cuando existen hora de entrada y hora de salida.',
      ],
      firmas: [
        { cargo: 'Elaborado por', nombre: generadoPor },
        { cargo: 'Jefatura de Instrucción', nombre: jefes.join(' / ') || undefined },
      ],
    };
  }

  private async general(dto: GenerarReporteDto, codigo: string, usuario: string, jefes: string[], hoy: string, emitido: Date) {
    const [grupos, miembros, jornadas] = await Promise.all([
      this.data.grupos(dto.grupoIds, dto.desde, dto.hasta, hoy),
      this.data.miembros(dto.grupoIds, dto.desde, dto.hasta),
      this.data.jornadasObligatorias(dto.grupoIds, dto.desde, dto.hasta),
    ]);
    if (grupos.length !== dto.grupoIds.length) throw new UnprocessableEntityException('Uno o más grupos no existen o no están activos');
    const doc = this.base(codigo, 'INFORME GERENCIAL', 'Estado general de asistencia', dto, usuario, jefes, emitido,
      'landscape', grupos.map((g) => g.nombre).join(', '));
    const aplicables = miembros.filter((m) => aplicaObligatoria(grupos.find((g) => g.id === m.grupoId)!.etapaCodigo));
    const realizadas = aplicables.reduce((s, m) => s + n(m.realizadas), 0);
    const asistidas = aplicables.reduce((s, m) => s + n(m.asistidas), 0);
    const cumplimiento = pct(asistidas, realizadas);
    const fi = aplicables.reduce((s, m) => s + n(m.fi), 0);
    doc.kpis = [
      { etiqueta: 'Integrantes activos', valor: String(miembros.length), detalle: `${grupos.length} grupo(s)` },
      { etiqueta: 'Cumplimiento obligatorio', valor: porcentaje(cumplimiento), detalle: `${asistidas} de ${realizadas} registros`, tono: tonoCumplimiento(cumplimiento) },
      { etiqueta: 'Faltas injustificadas', valor: String(fi), detalle: 'En el periodo informado', tono: fi ? 'danger' : 'ok' },
      { etiqueta: 'Participaciones voluntarias', valor: String(miembros.reduce((s, m) => s + n(m.voluntarias), 0)), detalle: 'No generan faltas' },
    ];
    doc.hallazgos = [];
    const etapas = [
      { codigo: 'POSTULANTE', titulo: 'POSTULANTES', hoja: 'Postulantes' },
      { codigo: 'ASPIRANTE_COMPANIA', titulo: 'ASPIRANTES DE COMPAÑÍA', hoja: 'Aspirantes compañía' },
      { codigo: 'ASPIRANTE_ESBAS', titulo: 'ASPIRANTES ESBAS', hoja: 'Aspirantes ESBAS' },
    ];
    for (const etapa of etapas) {
      const gruposEtapa = grupos.filter((g) => g.etapaCodigo === etapa.codigo);
      if (!gruposEtapa.length) continue;
      const ids = new Set(gruposEtapa.map((g) => g.id));
      const filasEtapa = miembros.filter((m) => ids.has(m.grupoId));
      const esEsbas = etapa.codigo === 'ASPIRANTE_ESBAS';
      doc.secciones.push({
        titulo: etapa.titulo,
        hoja: etapa.hoja,
        nuevaPagina: doc.secciones.length > 0,
        tabla: {
          columnas: esEsbas ? [
            { titulo: 'Integrante', ancho: 2.8 }, { titulo: 'Grupo', ancho: 1.8 }, { titulo: 'DNI', ancho: 1.2 },
            { titulo: 'Participaciones voluntarias', ancho: 1.4, formato: 'entero' },
            { titulo: 'Horas voluntarias', ancho: 1.2, formato: 'horas' },
          ] : [
            { titulo: 'Integrante', ancho: 2.2 }, { titulo: 'Grupo', ancho: 1.4 }, { titulo: 'DNI', ancho: 1 },
            { titulo: 'Realizadas', ancho: .8, formato: 'entero' }, { titulo: 'Asistidas', ancho: .8, formato: 'entero' },
          { titulo: 'FJ', ancho: .55, formato: 'entero' }, { titulo: 'FI', ancho: .55, formato: 'entero' },
          { titulo: 'Cumplimiento', ancho: 1, formato: 'porcentaje', semaforo: true },
          { titulo: 'Voluntarias', ancho: .8, formato: 'entero' }, { titulo: 'H. obligatorias', ancho: .9, formato: 'horas' },
          { titulo: 'H. voluntarias', ancho: .9, formato: 'horas' },
          ],
          filas: filasEtapa.map((m) => {
          const g = grupos.find((x) => x.id === m.grupoId)!;
          return esEsbas
            ? [m.nombre, g.nombre, m.dni, n(m.voluntarias), n(m.minVol)]
            : [m.nombre, g.nombre, m.dni, n(m.realizadas), n(m.asistidas), n(m.fj), n(m.fi),
              pct(n(m.asistidas), n(m.realizadas)), n(m.voluntarias), n(m.minObl), n(m.minVol)];
          }),
          vacio: `No hay ${etapa.titulo.toLowerCase()} activos para mostrar.`,
        },
      });
    }
    doc.secciones.push({
      titulo: 'Control de jornadas obligatorias', hoja: 'Jornadas', nuevaPagina: true,
      tabla: {
        columnas: [
          { titulo: 'Fecha', ancho: 1, formato: 'fecha' }, { titulo: 'Grupo', ancho: 1.6 }, { titulo: 'Horario', ancho: 1 },
          { titulo: 'Estado', ancho: .8 }, { titulo: 'Esperados', ancho: .8, formato: 'entero' },
          { titulo: 'Asistieron', ancho: .8, formato: 'entero' }, { titulo: 'FJ', ancho: .55, formato: 'entero' },
          { titulo: 'FI', ancho: .55, formato: 'entero' }, { titulo: 'Cumplimiento', ancho: 1, formato: 'porcentaje', semaforo: true },
        ],
        filas: jornadas.map((j) => [j.fecha, grupos.find((g) => g.id === j.grupoId)?.nombre ?? '',
          `${j.horaInicio ?? '—'} - ${j.horaFin ?? '—'}`, j.estado, n(j.esperados), n(j.asistieron), n(j.fj), n(j.fi), pct(n(j.asistieron), n(j.esperados))]),
        vacio: 'No hay jornadas obligatorias en el periodo.',
      },
    });
    return doc;
  }

  private async individual(dto: GenerarReporteDto, codigo: string, usuario: string, jefes: string[], hoy: string, emitido: Date) {
    const grupoIds = dto.grupoIds;
    const [grupos, miembros] = await Promise.all([
      this.data.grupos(grupoIds, dto.desde, dto.hasta, hoy),
      this.data.miembros(grupoIds, dto.desde, dto.hasta, dto.personaId),
    ]);
    if (!miembros.length) throw new NotFoundException('La persona no tiene una membresía activa en los grupos seleccionados');
    const m = miembros[0];
    const g = grupos.find((x) => x.id === m.grupoId)!;
    dto.grupoIds = [g.id];
    const detalle = await this.data.detallePersona(m.personaId, g.id, dto.desde, dto.hasta, m.ingreso);
    const aplica = aplicaObligatoria(g.etapaCodigo);
    const cumplimiento = aplica ? pct(n(m.asistidas), n(m.realizadas)) : null;
    const doc = this.base(codigo, 'DETALLE INDIVIDUAL', `Asistencia de ${m.nombre}`, dto, usuario, jefes, emitido,
      'landscape', `${g.nombre} · ${g.etapa}`);
    doc.kpis = [
      { etiqueta: 'Cumplimiento obligatorio', valor: aplica ? porcentaje(cumplimiento) : 'No aplica', detalle: aplica ? `${n(m.asistidas)} de ${n(m.realizadas)} jornadas` : 'Etapa ESBAS', tono: tonoCumplimiento(cumplimiento) },
      { etiqueta: 'Faltas justificadas', valor: aplica ? String(n(m.fj)) : 'No aplica' },
      { etiqueta: 'Faltas injustificadas', valor: aplica ? String(n(m.fi)) : 'No aplica', tono: aplica && n(m.fi) ? 'danger' : 'ok' },
      { etiqueta: 'Tiempo presencial', valor: horas(n(m.minObl) + n(m.minVol)), detalle: `${n(m.voluntarias)} participación(es) voluntaria(s)` },
    ];
    doc.hallazgos = [];
    doc.secciones.push({
      titulo: 'Identificación', hoja: 'Detalle',
      pares: [['Integrante', m.nombre], ['DNI', m.dni ?? '—'], ['Grupo', g.nombre], ['Etapa', g.etapa], ['Ingreso', m.ingreso]],
    }, {
      titulo: 'Detalle por jornada', hoja: 'Detalle',
      tabla: {
        columnas: [
          { titulo: 'Fecha', ancho: 1, formato: 'fecha' }, { titulo: 'Tipo', ancho: .9 }, { titulo: 'Estado', ancho: 1.2 },
          { titulo: 'Entrada', ancho: .75 }, { titulo: 'Salida', ancho: .75 }, { titulo: 'Duración', ancho: .85, formato: 'horas' },
          { titulo: 'Registro', ancho: .9 }, { titulo: 'Observación', ancho: 2 },
        ],
        filas: detalle.map((r: any) => [r.fecha, r.tipo, r.estado ?? (r.tipo === 'OBLIGATORIA' ? 'SIN REGISTRO' : '—'), r.entrada, r.salida, r.minutos, r.registro, r.observacion]),
        vacio: 'No hay jornadas aplicables en el periodo.',
      },
    });
    return doc;
  }

  private async porJornada(dto: GenerarReporteDto, codigo: string, usuario: string, jefes: string[], emitido: Date) {
    const jornada = await this.data.jornada(dto.jornadaId!);
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    dto.desde = jornada.fecha; dto.hasta = jornada.fecha; dto.grupoIds = [Number(jornada.grupoId)];
    const aplica = jornada.tipo === 'OBLIGATORIA' && aplicaObligatoria(jornada.etapaCodigo);
    const filas = jornada.filas as any[];
    const asistieron = filas.filter((r) => ['PRESENTE', 'FINALIZADO', 'SALIDA_ANTICIPADA'].includes(r.estado)).length;
    const faltas = filas.filter((r) => r.estado === 'FALTA_INJUSTIFICADA').length;
    const cumplimiento = aplica ? pct(asistieron, filas.length) : null;
    const doc = this.base(codigo, 'ACTA DE JORNADA', `Registro de jornada · ${jornada.grupo}`, dto, usuario, jefes, emitido,
      'landscape', `${jornada.etapa} · ${jornada.tipo} · ${jornada.estado}`);
    doc.kpis = [
      { etiqueta: 'Integrantes activos', valor: String(filas.length) },
      { etiqueta: 'Asistieron', valor: String(asistieron), tono: 'ok' },
      { etiqueta: 'Cumplimiento', valor: aplica ? porcentaje(cumplimiento) : 'No aplica', detalle: jornada.tipo === 'VOLUNTARIA' ? 'Jornada voluntaria' : jornada.etapa, tono: tonoCumplimiento(cumplimiento) },
      { etiqueta: 'Faltas injustificadas', valor: aplica ? String(faltas) : 'No aplica', tono: faltas ? 'danger' : 'ok' },
    ];
    doc.hallazgos = [];
    doc.secciones.push({
      titulo: 'Datos de la jornada', hoja: 'Jornada',
      pares: [['Fecha', jornada.fecha], ['Horario', `${jornada.horaInicio ?? '—'} - ${jornada.horaFin ?? '—'}`], ['Tipo', jornada.tipo], ['Estado', jornada.estado]],
    }, {
      titulo: 'Registro nominal', hoja: 'Jornada',
      tabla: {
        columnas: [
          { titulo: 'Integrante', ancho: 2.1 }, { titulo: 'DNI', ancho: 1 }, { titulo: 'Estado', ancho: 1.2 },
          { titulo: 'Entrada', ancho: .7 }, { titulo: 'Salida', ancho: .7 }, { titulo: 'Duración', ancho: .8, formato: 'horas' },
          { titulo: 'Registro', ancho: .85 }, { titulo: 'Registrado por', ancho: 1.4 }, { titulo: 'Observación', ancho: 1.7 },
        ],
        filas: filas.map((r) => [r.nombre, r.dni, r.estado ?? (aplica ? 'SIN REGISTRO' : '—'), r.entrada, r.salida, r.minutos, r.registro, r.registradoPor, r.observacion]),
        vacio: 'No hay integrantes activos para mostrar.',
      },
    });
    return doc;
  }
}
