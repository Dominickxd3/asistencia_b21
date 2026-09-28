import PDFDocument from 'pdfkit';
import {
  COLORES,
  Columna,
  DocReporte,
  Kpi,
  Seccion,
  Tabla,
  Valor,
  fechaEmision,
  rutaLogo,
  textoCelda,
  tonoCumplimiento,
} from './reporte.modelo';

const ROJO = '#C8102E';
const CARBON = '#171B21';
const TEXTO = '#1F2933';
const GRIS = '#667085';
const GRIS_CLARO = '#98A2B3';
const BORDE = '#E4E7EC';
const CEBRA = '#F7F8FA';

const MARGEN = 40;
const PIE = 42;

/**
 * Renderiza un DocReporte como PDF institucional (pdfkit, fuentes estándar WinAnsi:
 * evitar caracteres fuera de Latin-1 como flechas o «≥»).
 */
export class ReportePdfBuilder {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];

  constructor() {
    this.doc = new PDFDocument({ margin: 40, size: 'A4', info: { Title: 'Reporte Rímac 21' } });
    this.doc.on('data', (c: Buffer) => this.chunks.push(c));
  }

  encabezado(titulo: string, subtitulo: string): this {
    const { doc } = this;
    doc
      .rect(0, 0, doc.page.width, 76)
      .fill('#c8102e');
    doc
      .fill('#fff')
      .fontSize(15)
      .font('Helvetica-Bold')
      .text('Compañía de Bomberos Voluntarios Rímac N.º 21', 40, 24)
      .fontSize(10)
      .font('Helvetica')
      .text(`Área de Instrucción — ${titulo}`, 40, 46);
    doc.fill('#24272c').moveDown(1.6);
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(subtitulo);
    doc.moveDown(0.8).moveTo(40, doc.y).lineTo(555, doc.y).stroke('#e2e5ea').moveDown(0.8);
    return this;
  }

  seccion(titulo: string): this {
    this.doc
      .moveDown(0.6)
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#24272c')
      .text(titulo)
      .moveDown(0.35);
    return this;
  }

  tabla(columnas: { nombre: string; ancho: number }[], filas: (string | number)[][]): this {
    const { doc } = this;
    const inicioX = 40;
    let y = doc.y;

    const dibujarFila = (celdas: (string | number)[], negrita: boolean) => {
      const alto = 18;
      let x = inicioX;
      if (y > doc.page.height - 70) {
        doc.addPage();
        y = 60;
      }
      if (negrita) {
        doc.rect(inicioX, y, columnas.reduce((s, c) => s + c.ancho, 0), alto).fill('#f1533');
        doc.fillColor('#6b7280');
      } else {
        doc.fillColor('#24272c');
      }
      celdas.forEach((celda, i) => {
        doc
          .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .text(String(celda), x + 4, y + 4, { width: columnas[i].ancho - 8, ellipsis: true });
        x += columnas[i].ancho;
      });
      doc
        .strokeColor('#eceef2')
        .lineWidth(0.5)
        .moveTo(inicioX, y + alto)
        .lineTo(inicioX + columnas.reduce((s, c) => s + c.ancho, 0), y + alto)
        .stroke();
      y += alto;
    };

    dibujarFila(columnas.map((c) => c.nombre), true);
    for (const fila of filas) dibujarFila(fila, false);
    doc.y = y + 8;
    return this;
  }

  resumenPares(pares: [string, string | number][]): this {
    const { doc } = this;
    for (const [k, v] of pares) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#24272c').text(`${k}: `, { continued: true });
      doc.font('Helvetica').fillColor('#24272c').text(String(v));
    }
    return this;
  }

  finalizar(): Promise<Buffer> {
    const { doc } = this;
    doc
      .fontSize(8)
      .fillColor('#9aa0a8')
      .text(`Generado: ${new Date().toLocaleString('es-PE')} · Sistema institucional Rímac 21`, 40, doc.page.height - 40);
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(this.chunks)));
      doc.end();
    });
  }
}

export class ReportePdfRenderer {
  private doc!: PDFKit.PDFDocument;
  private readonly logo = rutaLogo();

  render(r: DocReporte): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: r.orientacion,
      margins: { top: MARGEN, bottom: PIE + 12, left: MARGEN, right: MARGEN },
      bufferPages: true,
      info: {
        Title: `${r.titulo} — ${r.periodo}`,
        Author: 'Compañía de Bomberos Voluntarios Rímac N.º 21 · Área de Instrucción',
        Subject: `${r.tipo} ${r.codigo}`,
        Keywords: 'asistencia, instrucción, Rímac 21',
      },
    });
    this.doc = doc;
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    // Encabezado corto en las páginas siguientes
    doc.on('pageAdded', () => this.encabezadoContinuo(r));

    this.portada(r);
    if (r.kpis.length) this.kpis(r.kpis);
    if (r.hallazgos.length) this.hallazgos(r.hallazgos);
    for (const s of r.secciones) this.seccion(s);
    this.cierre(r);
    this.pies(r);

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });
  }

  // ---------------- Estructura ----------------

  private get ancho(): number {
    return this.doc.page.width - MARGEN * 2;
  }

  private get limite(): number {
    return this.doc.page.height - PIE - 14;
  }

  private asegurar(alto: number): void {
    if (this.doc.y + alto > this.limite) this.doc.addPage();
  }

  private portada(r: DocReporte): void {
    const { doc } = this;
    const W = doc.page.width;
    doc.rect(0, 0, W, 7).fill(ROJO);

    const tope = 24;
    if (this.logo) doc.image(this.logo, MARGEN, tope, { fit: [58, 58] });
    const xTexto = MARGEN + (this.logo ? 70 : 0);
    doc
      .fillColor(CARBON)
      .font('Helvetica-Bold')
      .fontSize(11.5)
      .text('COMPAÑÍA DE BOMBEROS VOLUNTARIOS RÍMAC N.º 21', xTexto, tope + 10, { characterSpacing: 0.4 });
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS).text('Área de Instrucción', xTexto, tope + 27);
    doc.text('Sistema de control de asistencia de formación', xTexto, tope + 39);

    // Recuadro de identificación del documento
    const anchoCaja = 205;
    const xCaja = W - MARGEN - anchoCaja;
    doc.roundedRect(xCaja, tope, anchoCaja, 58, 4).lineWidth(0.8).stroke(BORDE);
    doc.rect(xCaja, tope, 3, 58).fill(ROJO);
    doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(8.5).text(r.tipo, xCaja + 12, tope + 9, { characterSpacing: 0.6 });
    doc.fillColor(TEXTO).font('Helvetica').fontSize(8);
    doc.text(`Código: ${r.codigo}`, xCaja + 12, tope + 24);
    doc.text(`Emitido: ${fechaEmision(r.generadoEn)}`, xCaja + 12, tope + 36, { width: anchoCaja - 20 });

    const yLinea = tope + 72;
    doc.moveTo(MARGEN, yLinea).lineTo(W - MARGEN, yLinea).lineWidth(0.6).stroke(BORDE);

    doc.fillColor(CARBON).font('Helvetica-Bold').fontSize(19).text(r.titulo, MARGEN, yLinea + 14, { width: this.ancho });
    doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(12).text(r.periodo, { width: this.ancho });
    doc.moveDown(0.25);
    doc
      .fillColor(GRIS)
      .font('Helvetica')
      .fontSize(8.5)
      .text(`Alcance: ${r.alcance}   ·   Rango: ${r.rango}   ·   Elaborado por: ${r.generadoPor}`, { width: this.ancho });
    doc.moveDown(1);
  }

  private encabezadoContinuo(r: DocReporte): void {
    const { doc } = this;
    const W = doc.page.width;
    doc.rect(0, 0, W, 4).fill(ROJO);
    if (this.logo) doc.image(this.logo, MARGEN, 14, { fit: [20, 20] });
    const x = MARGEN + (this.logo ? 28 : 0);
    doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(8).text(`${r.titulo} · ${r.periodo}`, x, 17, { lineBreak: false });
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5).text(r.codigo, W - MARGEN - 160, 18, { width: 160, align: 'right' });
    doc.moveTo(MARGEN, 40).lineTo(W - MARGEN, 40).lineWidth(0.5).stroke(BORDE);
    doc.x = MARGEN;
    doc.y = 52;
  }

  private kpis(kpis: Kpi[]): void {
    const { doc } = this;
    const porFila = this.ancho > 600 ? Math.min(kpis.length, 6) : Math.min(kpis.length, 3);
    const gap = 10;
    const ancho = (this.ancho - gap * (porFila - 1)) / porFila;
    const alto = 62;
    for (let i = 0; i < kpis.length; i += porFila) {
      this.asegurar(alto + 10);
      const y = doc.y;
      kpis.slice(i, i + porFila).forEach((k, j) => {
        const x = MARGEN + j * (ancho + gap);
        const color = k.tono ? COLORES[k.tono] : null;
        doc.roundedRect(x, y, ancho, alto, 4).lineWidth(0.7).fillAndStroke('#FFFFFF', BORDE);
        doc.rect(x, y, 3, alto).fill(color?.borde ?? CARBON);
        doc
          .fillColor(GRIS)
          .font('Helvetica-Bold')
          .fontSize(6.8)
          .text(k.etiqueta.toUpperCase(), x + 11, y + 9, { width: ancho - 18, characterSpacing: 0.4, height: 9, ellipsis: true });
        doc
          .fillColor(color && k.tono !== 'neutral' ? color.texto : CARBON)
          .font('Helvetica-Bold')
          .fontSize(17)
          .text(k.valor, x + 11, y + 21, { width: ancho - 18, height: 20, ellipsis: true });
        if (k.detalle) {
          doc
            .fillColor(GRIS)
            .font('Helvetica')
            .fontSize(7)
            .text(k.detalle, x + 11, y + 44, { width: ancho - 18, height: 12, ellipsis: true });
        }
      });
      doc.x = MARGEN;
      doc.y = y + alto + 10;
    }
  }

  private hallazgos(items: string[]): void {
    const { doc } = this;
    doc.font('Helvetica').fontSize(8.8);
    const anchoTexto = this.ancho - 36;
    const altos = items.map((t) => doc.heightOfString(t, { width: anchoTexto }) + 4);
    const alto = 26 + altos.reduce((s, a) => s + a, 0) + 6;
    this.asegurar(Math.min(alto, 200));
    const y = doc.y;
    doc.rect(MARGEN, y, this.ancho, alto).fill('#F8F9FB');
    doc.rect(MARGEN, y, 3, alto).fill(ROJO);
    doc.fillColor(CARBON).font('Helvetica-Bold').fontSize(9.5).text('Hallazgos principales', MARGEN + 14, y + 9);
    let yy = y + 26;
    items.forEach((t, i) => {
      doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(8.8).text('•', MARGEN + 14, yy);
      doc.fillColor(TEXTO).font('Helvetica').fontSize(8.8).text(t, MARGEN + 24, yy, { width: anchoTexto });
      yy += altos[i];
    });
    doc.x = MARGEN;
    doc.y = y + alto + 14;
  }

  private encabezadoSeccion(s: Seccion): void {
    const { doc } = this;
    const y = doc.y;
    doc.rect(MARGEN, y + 1, 3, 13).fill(ROJO);
    doc.fillColor(CARBON).font('Helvetica-Bold').fontSize(11.5).text(s.titulo, MARGEN + 10, y, { width: this.ancho - 10 });
    if (s.descripcion) {
      doc.fillColor(GRIS).font('Helvetica').fontSize(8.2).text(s.descripcion, MARGEN + 10, doc.y + 2, { width: this.ancho - 10 });
    }
    doc.x = MARGEN;
    doc.y += 7;
  }

  private seccion(s: Seccion): void {
    const { doc } = this;
    if (s.nuevaPagina && doc.y > 90) doc.addPage();
    // Título + cabecera + dos filas deben caber juntos
    this.asegurar(s.tabla ? 36 + 20 + 2 * 17 : 60);
    this.encabezadoSeccion(s);
    if (s.pares) this.pares(s.pares);
    if (s.tabla) this.tabla(s.tabla);
    doc.moveDown(0.9);
  }

  private pares(pares: [string, string][]): void {
    const { doc } = this;
    const col = this.ancho / 2;
    for (let i = 0; i < pares.length; i += 2) {
      this.asegurar(16);
      const y = doc.y;
      pares.slice(i, i + 2).forEach(([k, v], j) => {
        const x = MARGEN + j * col;
        doc.fillColor(GRIS).font('Helvetica').fontSize(8.5).text(k, x, y, { width: col * 0.5, lineBreak: false });
        doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(8.5).text(v, x + col * 0.5, y, { width: col * 0.48, lineBreak: false });
      });
      doc.x = MARGEN;
      doc.y = y + 15;
    }
  }

  private tabla(t: Tabla): void {
    const { doc } = this;
    const peso = t.columnas.reduce((s, c) => s + c.ancho, 0);
    const anchos = t.columnas.map((c) => (c.ancho / peso) * this.ancho);
    const altoFila = 17;
    const altoCab = 20;

    const cabecera = () => {
      const y = doc.y;
      doc.rect(MARGEN, y, this.ancho, altoCab).fill(CARBON);
      let x = MARGEN;
      t.columnas.forEach((c, i) => {
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(6.8)
          .text(c.titulo.toUpperCase(), x + 5, y + 7, {
            width: anchos[i] - 10,
            align: c.alinear ?? 'left',
            characterSpacing: 0.3,
            height: 9,
            ellipsis: true,
          });
        x += anchos[i];
      });
      doc.y = y + altoCab;
    };

    const fila = (valores: Valor[], indice: number, esTotal = false) => {
      if (doc.y + altoFila > this.limite) {
        doc.addPage();
        cabecera();
      }
      const y = doc.y;
      if (esTotal) doc.rect(MARGEN, y, this.ancho, altoFila).fill('#EEF0F3');
      else if (indice % 2 === 1) doc.rect(MARGEN, y, this.ancho, altoFila).fill(CEBRA);
      let x = MARGEN;
      t.columnas.forEach((c, i) => {
        this.celda(c, valores[i] ?? null, x, y, anchos[i], altoFila, esTotal);
        x += anchos[i];
      });
      doc
        .moveTo(MARGEN, y + altoFila)
        .lineTo(MARGEN + this.ancho, y + altoFila)
        .lineWidth(esTotal ? 0.9 : 0.4)
        .stroke(esTotal ? CARBON : BORDE);
      doc.y = y + altoFila;
    };

    cabecera();
    if (t.filas.length === 0) {
      doc
        .fillColor(GRIS)
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .text(t.vacio ?? 'Sin registros en el periodo.', MARGEN + 6, doc.y + 6, { width: this.ancho - 12 });
      doc.y += 8;
    }
    t.filas.forEach((f, i) => fila(f, i));
    if (t.total) fila(t.total, 0, true);
    doc.x = MARGEN;
  }

  private celda(c: Columna, valor: Valor, x: number, y: number, ancho: number, alto: number, negrita: boolean): void {
    const { doc } = this;
    const texto = textoCelda(valor, c.formato);
    const alinear = c.alinear ?? (c.formato && c.formato !== 'texto' && c.formato !== 'fecha' ? 'right' : 'left');

    if (c.semaforo && typeof valor === 'number') {
      const tono = COLORES[tonoCumplimiento(valor)];
      doc.font('Helvetica-Bold').fontSize(7.5);
      const anchoPill = Math.min(doc.widthOfString(texto) + 12, ancho - 8);
      const xPill = alinear === 'right' ? x + ancho - anchoPill - 5 : alinear === 'center' ? x + (ancho - anchoPill) / 2 : x + 5;
      doc.roundedRect(xPill, y + 3, anchoPill, alto - 6, 5).fill(tono.fondo);
      doc.fillColor(tono.texto).text(texto, xPill, y + 5.5, { width: anchoPill, align: 'center', lineBreak: false });
      return;
    }
    doc
      .fillColor(valor === null || valor === '' ? GRIS_CLARO : TEXTO)
      .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(7.8)
      .text(texto, x + 5, y + 5, { width: ancho - 10, align: alinear, height: 10, ellipsis: true });
  }

  private cierre(r: DocReporte): void {
    const { doc } = this;
    if (r.criterios.length) {
      this.asegurar(40 + r.criterios.length * 12);
      doc.fillColor(CARBON).font('Helvetica-Bold').fontSize(9).text('Criterios del informe', MARGEN, doc.y);
      doc.moveDown(0.3);
      for (const c of r.criterios) {
        doc.fillColor(GRIS).font('Helvetica').fontSize(7.8).text(`•  ${c}`, MARGEN, doc.y, { width: this.ancho });
        doc.moveDown(0.15);
      }
      doc.moveDown(0.8);
    }
    if (r.firmas.length) {
      this.asegurar(90);
      const y = doc.y + 38;
      const ancho = 200;
      const gap = (this.ancho - ancho * r.firmas.length) / Math.max(1, r.firmas.length - 1 || 1);
      r.firmas.forEach((f, i) => {
        const x = r.firmas.length === 1 ? MARGEN : MARGEN + i * (ancho + gap);
        doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.7).stroke(TEXTO);
        doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(8.5).text(f.cargo, x, y + 5, { width: ancho, align: 'center' });
        if (f.nombre) doc.fillColor(GRIS).font('Helvetica').fontSize(8).text(f.nombre, x, y + 17, { width: ancho, align: 'center' });
      });
      doc.x = MARGEN;
      doc.y = y + 32;
    }
  }

  private pies(r: DocReporte): void {
    const { doc } = this;
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      const W = doc.page.width;
      const H = doc.page.height;
      const margenInferior = doc.page.margins.bottom;
      doc.page.margins.bottom = 0; // escribir en el pie sin provocar páginas nuevas
      const y = H - PIE + 8;
      doc.moveTo(MARGEN, y).lineTo(W - MARGEN, y).lineWidth(0.5).stroke(BORDE);
      doc.fillColor(GRIS_CLARO).font('Helvetica').fontSize(7);
      doc.text('Compañía de Bomberos Voluntarios Rímac N.º 21 · Área de Instrucción', MARGEN, y + 7, { lineBreak: false });
      doc.text(`${r.codigo} · Documento de uso interno`, W / 2 - 110, y + 7, { width: 220, align: 'center', lineBreak: false });
      doc.text(`Página ${i + 1} de ${rango.count}`, W - MARGEN - 100, y + 7, { width: 100, align: 'right', lineBreak: false });
      doc.page.margins.bottom = margenInferior;
    }
  }
}
