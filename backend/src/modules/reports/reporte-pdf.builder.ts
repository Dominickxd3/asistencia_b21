import PDFDocument from 'pdfkit';

/** Construye el PDF institucional en memoria. Diseño sobrio y compacto. */
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
