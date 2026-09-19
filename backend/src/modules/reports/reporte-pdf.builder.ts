import PDFDocument from 'pdfkit';

/** Constructor de informes institucionales, paginados y listos para presentación. */
export class ReportePdfBuilder {
  private doc: PDFKit.PDFDocument;
  private chunks: Buffer[] = [];
  private tituloDocumento = 'Reporte institucional';

  constructor() {
    this.doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true, info: { Title: 'Reporte Rímac 21', Author: 'Área de Instrucción' } });
    this.doc.on('data', (c: Buffer) => this.chunks.push(c));
  }

  encabezado(titulo: string, subtitulo: string): this {
    const { doc } = this;
    this.tituloDocumento = titulo;
    doc.rect(0, 0, doc.page.width, 94).fill('#c8102e');
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(16)
      .text('COMPAÑÍA DE BOMBEROS VOLUNTARIOS RÍMAC N.º 21', 40, 22, { characterSpacing: .2 });
    doc.font('Helvetica').fontSize(9).fillColor('#ffe7ec').text('ÁREA DE INSTRUCCIÓN', 40, 48, { characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#fff').text(titulo, 40, 65);
    doc.y = 112;
    doc.roundedRect(40, 108, 515, 42, 5).fill('#f7f8fa');
    doc.fillColor('#475467').font('Helvetica').fontSize(9).text(subtitulo, 52, 120, { width: 490, lineGap: 3 });
    doc.y = 164;
    return this;
  }

  seccion(titulo: string, descripcion?: string): this {
    this.asegurarEspacio(120);
    this.doc.x = 40;
    this.doc.font('Helvetica-Bold').fontSize(12).fillColor('#101828').text(titulo, 40, this.doc.y, { width: 515 });
    if (descripcion) this.doc.moveDown(.2).font('Helvetica').fontSize(8.5).fillColor('#667085').text(descripcion, 40, this.doc.y, { width: 515 });
    this.doc.moveDown(.55);
    return this;
  }

  indicadores(items: Array<{ etiqueta: string; valor: string | number; detalle?: string; color?: string }>): this {
    this.asegurarEspacio(76);
    const { doc } = this;
    const gap = 8;
    const ancho = (515 - gap * (items.length - 1)) / items.length;
    const y = doc.y;
    items.forEach((item, i) => {
      const x = 40 + i * (ancho + gap);
      doc.roundedRect(x, y, ancho, 62, 5).fillAndStroke('#ffffff', '#e4e7ec');
      doc.font('Helvetica').fontSize(7.5).fillColor('#667085').text(item.etiqueta.toUpperCase(), x + 10, y + 9, { width: ancho - 20 });
      doc.font('Helvetica-Bold').fontSize(18).fillColor(item.color || '#101828').text(String(item.valor), x + 10, y + 24, { width: ancho - 20 });
      if (item.detalle) doc.font('Helvetica').fontSize(7).fillColor('#98a2b3').text(item.detalle, x + 10, y + 47, { width: ancho - 20 });
    });
    doc.y = y + 72;
    return this;
  }

  nota(texto: string): this {
    this.asegurarEspacio(40);
    const y = this.doc.y;
    this.doc.roundedRect(40, y, 515, 32, 4).fill('#fff7e8');
    this.doc.font('Helvetica').fontSize(8).fillColor('#7a4d00').text(texto, 50, y + 9, { width: 495 });
    this.doc.y = y + 42;
    return this;
  }

  tabla(columnas: { nombre: string; ancho: number; align?: 'left'|'center'|'right' }[], filas: (string | number)[][]): this {
    const { doc } = this;
    const inicioX = 40;
    const total = columnas.reduce((s, c) => s + c.ancho, 0);
    let y = doc.y;
    const cabecera = () => {
      doc.roundedRect(inicioX, y, total, 24, 3).fill('#17213c');
      let x = inicioX;
      columnas.forEach((c) => {
        doc.font('Helvetica-Bold').fontSize(7.4).fillColor('#fff').text(c.nombre, x + 4, y + 8, { width: c.ancho - 8, align: c.align || 'left', ellipsis: true });
        x += c.ancho;
      });
      y += 24;
    };
    cabecera();
    filas.forEach((fila, indice) => {
      if (y > doc.page.height - 72) { doc.addPage(); y = 52; cabecera(); }
      const alto = 22;
      if (indice % 2) doc.rect(inicioX, y, total, alto).fill('#f8f9fb');
      let x = inicioX;
      fila.forEach((celda, i) => {
        doc.font('Helvetica').fontSize(7.7).fillColor('#1d2939').text(String(celda), x + 4, y + 7, { width: columnas[i].ancho - 8, align: columnas[i].align || 'left', ellipsis: true });
        x += columnas[i].ancho;
      });
      doc.moveTo(inicioX, y + alto).lineTo(inicioX + total, y + alto).lineWidth(.35).strokeColor('#e4e7ec').stroke();
      y += alto;
    });
    doc.y = y + 10;
    return this;
  }

  resumenPares(pares: [string, string | number][]): this {
    this.doc.x = 40;
    pares.forEach(([k,v]) => {
      this.doc.font('Helvetica-Bold').fontSize(9).fillColor('#344054').text(`${k}: `, 40, this.doc.y, { width: 515, continued:true });
      this.doc.font('Helvetica').text(String(v));
    });
    this.doc.moveDown(.45);
    return this;
  }

  finalizar(): Promise<Buffer> {
    const { doc } = this;
    const rango = doc.bufferedPageRange();
    const generado = new Intl.DateTimeFormat('es-PE', { timeZone:'America/Lima', dateStyle:'medium', timeStyle:'short' }).format(new Date());
    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      doc.moveTo(40, doc.page.height - 42).lineTo(555, doc.page.height - 42).lineWidth(.5).strokeColor('#e4e7ec').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#98a2b3').text(`Generado: ${generado} · Sistema institucional Rímac 21`, 40, doc.page.height - 31, { width: 390 });
      doc.text(`Página ${i + 1} de ${rango.count}`, 455, doc.page.height - 31, { width: 100, align:'right' });
    }
    return new Promise((resolve) => { doc.on('end',()=>resolve(Buffer.concat(this.chunks))); doc.end(); });
  }

  private asegurarEspacio(alto: number): void { if (this.doc.y + alto > this.doc.page.height - 58) { this.doc.addPage(); this.doc.y = 52; } }
}
