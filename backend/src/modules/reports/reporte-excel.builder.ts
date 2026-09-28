import ExcelJS from 'exceljs';
import { COLORES, Columna, DocReporte, Seccion, Valor, fechaEmision, rutaLogo, tonoCumplimiento } from './reporte.modelo';

const ROJO = 'FFC8102E';
const CARBON = 'FF171B21';
const GRIS = 'FF667085';
const BORDE = 'FFE4E7EC';
const CEBRA = 'FFF7F8FA';

const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const borde: Partial<ExcelJS.Borders> = { bottom: { style: 'thin', color: { argb: BORDE } } };

/** Nombre de hoja válido (≤ 31 caracteres, sin : \ / ? * [ ]) y único */
function nombreHoja(libro: ExcelJS.Workbook, base: string): string {
  const limpio = base.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Hoja';
  let nombre = limpio;
  for (let n = 2; libro.getWorksheet(nombre); n++) nombre = `${limpio.slice(0, 28)} ${n}`;
  return nombre;
}

/** Valor de celda nativo de Excel según el formato de la columna */
function valorExcel(v: Valor, c: Columna): ExcelJS.CellValue {
  if (v === null || v === undefined || v === '') return c.formato === 'porcentaje' ? 'N/A' : null;
  if (typeof v === 'number') {
    if (c.formato === 'horas') return v / 1440; // minutos → fracción de día para [h]:mm
    return v;
  }
  if (c.formato === 'fecha' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [a, m, d] = v.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d));
  }
  return v;
}

const FORMATO_NUM: Record<string, string> = {
  entero: '0',
  porcentaje: '0%',
  horas: '[h]:mm',
  fecha: 'dd/mm/yyyy',
};

/** Renderiza un DocReporte como libro Excel institucional */
export class ReporteExcelRenderer {
  async render(r: DocReporte): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Rímac 21 · Área de Instrucción';
    libro.title = `${r.titulo} — ${r.periodo}`;
    libro.subject = `${r.tipo} ${r.codigo}`;
    libro.created = r.generadoEn;

    this.resumen(libro, r);

    // Secciones agrupadas por hoja, en orden de aparición
    const hojas = new Map<string, Seccion[]>();
    for (const s of r.secciones) hojas.set(s.hoja, [...(hojas.get(s.hoja) ?? []), s]);
    for (const [hoja, secciones] of hojas) this.hojaSecciones(libro, r, hoja, secciones);

    const buffer = await libro.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  private encabezadoHoja(ws: ExcelJS.Worksheet, r: DocReporte, columnas: number, subtitulo: string): number {
    const ultima = Math.max(columnas, 6);
    ws.mergeCells(1, 1, 1, ultima);
    const t = ws.getCell(1, 1);
    t.value = 'COMPAÑÍA DE BOMBEROS VOLUNTARIOS RÍMAC N.º 21 · ÁREA DE INSTRUCCIÓN';
    t.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROJO } };
    t.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, ultima);
    const s = ws.getCell(2, 1);
    s.value = `${r.titulo} — ${subtitulo}`;
    s.font = { bold: true, size: 12, color: { argb: CARBON } };
    s.alignment = { indent: 1 };
    ws.getRow(2).height = 20;

    ws.mergeCells(3, 1, 3, ultima);
    const m = ws.getCell(3, 1);
    m.value = `${r.periodo} (${r.rango}) · Alcance: ${r.alcance} · ${r.codigo} · Emitido: ${fechaEmision(r.generadoEn)}`;
    m.font = { size: 9, color: { argb: GRIS } };
    m.alignment = { indent: 1 };
    return 5;
  }

  private resumen(libro: ExcelJS.Workbook, r: DocReporte): void {
    const ws = libro.addWorksheet('Resumen', {
      views: [{ showGridLines: false }],
      pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });
    ws.columns = [{ width: 4 }, { width: 38 }, { width: 22 }, { width: 58 }, { width: 4 }, { width: 4 }];

    const logo = rutaLogo();
    let fila = this.encabezadoHoja(ws, r, 4, 'Resumen ejecutivo');
    if (logo) {
      const id = libro.addImage({ filename: logo, extension: 'png' });
      ws.addImage(id, { tl: { col: 3.55, row: 3.9 }, ext: { width: 64, height: 64 } });
    }

    const par = (k: string, v: string) => {
      ws.getCell(fila, 2).value = k;
      ws.getCell(fila, 2).font = { color: { argb: GRIS }, size: 10 };
      ws.getCell(fila, 3).value = v;
      ws.getCell(fila, 3).font = { bold: true, size: 10 };
      fila++;
    };
    par('Tipo de documento', r.tipo);
    par('Código', r.codigo);
    par('Periodo', r.periodo);
    par('Rango', r.rango);
    par('Alcance', r.alcance);
    par('Elaborado por', r.generadoPor);
    fila++;

    const titulo = (texto: string) => {
      const c = ws.getCell(fila, 2);
      c.value = texto.toUpperCase();
      c.font = { bold: true, size: 10, color: { argb: ROJO } };
      c.border = { bottom: { style: 'medium', color: { argb: ROJO } } };
      ws.getCell(fila, 3).border = c.border;
      ws.getCell(fila, 4).border = c.border;
      fila++;
    };

    if (r.kpis.length) {
      titulo('Indicadores clave');
      const cab = ws.getRow(fila);
      ['Indicador', 'Valor', 'Detalle'].forEach((h, i) => {
        const c = cab.getCell(i + 2);
        c.value = h;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARBON } };
      });
      fila++;
      for (const k of r.kpis) {
        const row = ws.getRow(fila);
        row.getCell(2).value = k.etiqueta;
        row.getCell(3).value = k.valor;
        row.getCell(3).font = { bold: true, size: 11, color: { argb: k.tono && k.tono !== 'neutral' ? argb(COLORES[k.tono].texto) : CARBON } };
        if (k.tono && k.tono !== 'neutral') {
          row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(COLORES[k.tono].fondo) } };
        }
        row.getCell(4).value = k.detalle ?? '';
        row.getCell(4).font = { color: { argb: GRIS }, size: 9 };
        [2, 3, 4].forEach((i) => (row.getCell(i).border = borde));
        fila++;
      }
      fila++;
    }

    if (r.hallazgos.length) {
      titulo('Hallazgos principales');
      for (const h of r.hallazgos) {
        ws.mergeCells(fila, 2, fila, 4);
        const c = ws.getCell(fila, 2);
        c.value = `•  ${h}`;
        c.alignment = { wrapText: true, vertical: 'top' };
        ws.getRow(fila).height = Math.max(16, Math.ceil(h.length / 105) * 15);
        fila++;
      }
      fila++;
    }

    if (r.criterios.length) {
      titulo('Criterios del informe');
      for (const k of r.criterios) {
        ws.mergeCells(fila, 2, fila, 4);
        const c = ws.getCell(fila, 2);
        c.value = `•  ${k}`;
        c.font = { size: 9, color: { argb: GRIS } };
        c.alignment = { wrapText: true, vertical: 'top' };
        ws.getRow(fila).height = Math.max(15, Math.ceil(k.length / 115) * 14);
        fila++;
      }
    }
  }

  private hojaSecciones(libro: ExcelJS.Workbook, r: DocReporte, hoja: string, secciones: Seccion[]): void {
    const maxCols = Math.max(...secciones.map((s) => s.tabla?.columnas.length ?? 2));
    const ws = libro.addWorksheet(nombreHoja(libro, hoja), {
      views: [{ showGridLines: false }],
      pageSetup: {
        orientation: maxCols > 7 ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    let fila = this.encabezadoHoja(ws, r, maxCols, hoja);
    const anchos: number[] = [];
    let filtroAplicado = false;
    let panelCongelado = false;

    for (const s of secciones) {
      // Título de la sección
      ws.mergeCells(fila, 1, fila, Math.max(maxCols, 2));
      const t = ws.getCell(fila, 1);
      t.value = s.titulo;
      t.font = { bold: true, size: 11, color: { argb: CARBON } };
      t.border = { left: { style: 'thick', color: { argb: ROJO } } };
      t.alignment = { indent: 1 };
      fila++;
      if (s.descripcion) {
        ws.mergeCells(fila, 1, fila, Math.max(maxCols, 2));
        const d = ws.getCell(fila, 1);
        d.value = s.descripcion;
        d.font = { size: 9, italic: true, color: { argb: GRIS } };
        d.alignment = { wrapText: true, indent: 1 };
        ws.getRow(fila).height = Math.max(15, Math.ceil(s.descripcion.length / (maxCols * 14)) * 14);
        fila++;
      }

      if (s.pares) {
        for (const [k, v] of s.pares) {
          ws.getCell(fila, 1).value = k;
          ws.getCell(fila, 1).font = { color: { argb: GRIS } };
          ws.getCell(fila, 2).value = v;
          ws.getCell(fila, 2).font = { bold: true };
          fila++;
        }
      }

      const tabla = s.tabla;
      if (tabla) {
        const cab = ws.getRow(fila);
        tabla.columnas.forEach((c, i) => {
          const celda = cab.getCell(i + 1);
          celda.value = c.titulo;
          celda.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CARBON } };
          celda.alignment = { vertical: 'middle', horizontal: c.alinear ?? (c.formato && c.formato !== 'texto' ? 'right' : 'left'), wrapText: true };
          anchos[i] = Math.max(anchos[i] ?? 0, Math.min(46, Math.max(10, c.ancho * 1.1, c.titulo.length + 2)));
        });
        cab.height = 30;
        const filaCab = fila;
        fila++;
        if (!panelCongelado) {
          ws.views = [{ state: 'frozen', ySplit: filaCab, showGridLines: false }];
          panelCongelado = true;
        }

        if (tabla.filas.length === 0) {
          ws.mergeCells(fila, 1, fila, tabla.columnas.length);
          const v = ws.getCell(fila, 1);
          v.value = tabla.vacio ?? 'Sin registros en el periodo.';
          v.font = { italic: true, color: { argb: GRIS } };
          fila++;
        }
        const escribir = (valores: Valor[], indice: number, esTotal: boolean) => {
          const row = ws.getRow(fila);
          tabla.columnas.forEach((c, i) => {
            const celda = row.getCell(i + 1);
            const v = valores[i] ?? null;
            celda.value = valorExcel(v, c);
            if (c.formato && FORMATO_NUM[c.formato] && typeof celda.value !== 'string') celda.numFmt = FORMATO_NUM[c.formato];
            celda.alignment = { horizontal: c.alinear ?? (c.formato && c.formato !== 'texto' ? 'right' : 'left'), vertical: 'middle' };
            celda.font = { bold: esTotal, size: 10 };
            celda.border = esTotal ? { top: { style: 'thin', color: { argb: CARBON } } } : borde;
            if (!esTotal && indice % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CEBRA } };
            if (esTotal) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF0F3' } };
            if (c.semaforo && typeof v === 'number') {
              const tono = COLORES[tonoCumplimiento(v)];
              celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(tono.fondo) } };
              celda.font = { bold: true, size: 10, color: { argb: argb(tono.texto) } };
            }
          });
          fila++;
        };
        tabla.filas.forEach((f, i) => escribir(f, i, false));
        if (tabla.total) escribir(tabla.total, 0, true);
        if (!filtroAplicado && tabla.filas.length > 0) {
          ws.autoFilter = { from: { row: filaCab, column: 1 }, to: { row: filaCab + tabla.filas.length, column: tabla.columnas.length } };
          filtroAplicado = true;
        }
      }
      fila += 2;
    }
    anchos.forEach((a, i) => (ws.getColumn(i + 1).width = a));
    if (anchos.length === 0) {
      ws.getColumn(1).width = 34;
      ws.getColumn(2).width = 40;
    }
  }
}
