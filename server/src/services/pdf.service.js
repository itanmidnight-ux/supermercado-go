const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  constructor() {
    this.primaryColor = '#00B860';
    this.accentColor = '#FF8C00';
    this.logoPath = null;
  }

  _formatCOP(valor) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(valor);
  }

  _drawHeader(doc, titulo, subtitulo = '') {
    doc.rect(0, 0, doc.page.width, 90).fill(this.primaryColor);
    doc.fontSize(28).fill('#FFFFFF').font('Helvetica-Bold')
      .text('SG', 50, 28, { width: 40, align: 'center' });
    doc.fontSize(20).fill('#FFFFFF').font('Helvetica-Bold')
      .text(titulo, 95, 25, { width: 400 });
    if (subtitulo) {
      doc.fontSize(11).fill('#E0E0E0').font('Helvetica')
        .text(subtitulo, 95, 52);
    }
    const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fontSize(10).fill('#FFFFFF').font('Helvetica')
      .text(fecha, 450, 30, { width: 120, align: 'right' });
    doc.moveDown(3);
  }

  _drawFooter(doc, numeracion = 1) {
    const footerY = doc.page.height - 40;
    doc.fontSize(8).fill('#666666').font('Helvetica')
      .text(`Pagina ${numeracion}`, 40, footerY, { width: 200 });
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 300, footerY, { width: 260, align: 'right' });
    doc.moveTo(40, footerY - 10).lineTo(doc.page.width - 40, footerY - 10).lineWidth(0.5).stroke('#CCCCCC');
  }

  _drawTabla(doc, headers, rows, startY, options = {}) {
    const { colWidths = [], rowHeight = 22, headerBg = this.primaryColor } = options;
    const pageWidth = doc.page.width - 80;
    const totalCols = headers.length;
    if (colWidths.length === 0) {
      const defaultWidth = pageWidth / totalCols;
      for (let i = 0; i < totalCols; i++) colWidths.push(defaultWidth);
    }
    let y = startY;
    const x = 40;

    doc.rect(x, y, pageWidth, rowHeight + 6).fill(headerBg);
    doc.fontSize(9).fill('#FFFFFF').font('Helvetica-Bold');
    let currentX = x + 5;
    headers.forEach((header, i) => {
      doc.text(header, currentX, y + 5, { width: colWidths[i] - 10, align: i === 0 ? 'left' : 'right', lineBreak: false });
      currentX += colWidths[i];
    });
    y += rowHeight + 6;

    doc.font('Helvetica').fontSize(9);
    rows.forEach((row, rowIndex) => {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
      doc.rect(x, y, pageWidth, rowHeight).fill(bgColor);
      doc.fill('#333333');
      currentX = x + 5;
      row.forEach((cell, colIndex) => {
        doc.text(String(cell), currentX, y + 6, { width: colWidths[colIndex] - 10, align: colIndex === 0 ? 'left' : 'right', lineBreak: false });
        currentX += colWidths[colIndex];
      });
      y += rowHeight;
    });
    doc.rect(x, startY, pageWidth, y - startY).lineWidth(0.5).stroke('#DDDDDD');
    return y;
  }

  _drawInfoBasica(doc, data, startY) {
    let y = startY;
    doc.fontSize(10).fill('#333333');
    Object.entries(data).forEach(([key, value]) => {
      doc.font('Helvetica-Bold').text(`${key}: `, 40, y, { continued: true, width: 150 });
      doc.font('Helvetica').text(String(value), 190, y, { width: 300 });
      y += 18;
    });
    return y + 10;
  }

  async generarReporteDiarioPedidos(datos, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      this._drawHeader(doc, 'REPORTE DIARIO DE PEDIDOS', `Fecha: ${new Date().toLocaleDateString('es-CO')}`);
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('RESUMEN DEL DIA', 40, 110);
      let y = this._drawInfoBasica(doc, {
        'Total Pedidos': datos.totalPedidos || 0,
        'Completados': datos.completados || 0,
        'Pendientes': datos.pendientes || 0,
        'Cancelados': datos.cancelados || 0,
        'Ingresos Totales': this._formatCOP(datos.ingresosTotales || 0),
        'Ticket Promedio': this._formatCOP(datos.ticketPromedio || 0),
      }, 130);
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('PRODUCTOS MAS VENDIDOS', 40, y);
      y += 20;
      const headersProd = ['Producto', 'Unidades', 'Total Vendido'];
      const rowsProd = (datos.productosMasVendidos || []).map(p => [p.nombre, p.unidadesVendidas, this._formatCOP(p.totalVendido)]);
      if (rowsProd.length > 0) y = this._drawTabla(doc, headersProd, rowsProd, y, { colWidths: [250, 100, 150] });
      y += 20;
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('PEDIDOS POR METODO DE PAGO', 40, y);
      y += 20;
      const headersPago = ['Metodo', 'Cantidad', 'Total'];
      const rowsPago = (datos.porMetodoPago || []).map(p => [p.metodo, p.cantidad, this._formatCOP(p.total)]);
      if (rowsPago.length > 0) y = this._drawTabla(doc, headersPago, rowsPago, y, { colWidths: [200, 100, 200] });
      this._drawFooter(doc, 1);
      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  async generarReporteVentasPorFecha(datos, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      this._drawHeader(doc, 'REPORTE DE VENTAS', `Del ${datos.fechaInicio} al ${datos.fechaFin}`);
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('RESUMEN DE VENTAS', 40, 110);
      let y = this._drawInfoBasica(doc, {
        'Periodo': `${datos.fechaInicio} - ${datos.fechaFin}`,
        'Total Ventas': this._formatCOP(datos.totalVentas || 0),
        'Total Transacciones': datos.totalTransacciones || 0,
        'Promedio Diario': this._formatCOP(datos.promedioDiario || 0),
      }, 130);
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('DESGLOSE DIARIO', 40, y);
      y += 20;
      const headersDiario = ['Fecha', 'Pedidos', 'Ingresos', 'Ticket Promedio'];
      const rowsDiario = (datos.desgloseDiario || []).map(d => [d.fecha, d.pedidos, this._formatCOP(d.ingresos), this._formatCOP(d.ticketPromedio)]);
      if (rowsDiario.length > 0) y = this._drawTabla(doc, headersDiario, rowsDiario, y, { colWidths: [130, 90, 140, 140] });
      y += 20;
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('TOP 10 PRODUCTOS', 40, y);
      y += 20;
      const headersTop = ['#', 'Producto', 'Unidades', 'Ingresos'];
      const rowsTop = (datos.topProductos || []).map((p, i) => [i + 1, p.nombre, p.unidades, this._formatCOP(p.ingresos)]);
      if (rowsTop.length > 0) y = this._drawTabla(doc, headersTop, rowsTop, y, { colWidths: [40, 250, 100, 110] });
      this._drawFooter(doc, 1);
      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  async generarReporteInventario(datos, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      this._drawHeader(doc, 'REPORTE DE INVENTARIO', `Fecha: ${new Date().toLocaleDateString('es-CO')}`);
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('RESUMEN GENERAL', 40, 110);
      let y = this._drawInfoBasica(doc, {
        'Total Productos': datos.totalProductos || 0,
        'Stock Total': datos.stockTotalUnidades || 0,
        'Valor Inventario': this._formatCOP(datos.valorTotalInventario || 0),
        'Bajo Minimo': datos.bajoMinimo || 0,
        'Proximos a Vencer': datos.proximosVencer || 0,
      }, 130);
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('STOCK ACTUAL', 40, y);
      y += 20;
      const headers = ['Codigo', 'Producto', 'Categoria', 'Stock', 'Minimo', 'Estado'];
      const rows = (datos.stockActual || []).map(p => [p.codigo, p.nombre, p.categoria, p.stock, p.minimo, p.stock <= p.minimo ? 'BAJO' : 'OK']);
      if (rows.length > 0) y = this._drawTabla(doc, headers, rows, y, { colWidths: [70, 170, 100, 60, 60, 60] });
      if ((datos.bajoMinimoDetalle || []).length > 0) {
        y += 20;
        doc.fontSize(12).fill('#CC0000').font('Helvetica-Bold').text('PRODUCTOS BAJO MINIMO', 40, y);
        y += 20;
        const headersBajo = ['Codigo', 'Producto', 'Stock', 'Minimo', 'Deficit'];
        const rowsBajo = datos.bajoMinimoDetalle.map(p => [p.codigo, p.nombre, p.stock, p.minimo, p.minimo - p.stock]);
        y = this._drawTabla(doc, headersBajo, rowsBajo, y, { colWidths: [70, 180, 90, 100, 80], headerBg: '#CC0000' });
      }
      this._drawFooter(doc, 1);
      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  async generarFacturaElectronica(factura, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'letter' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      this._drawHeader(doc, 'FACTURA ELECTRONICA', `N° ${factura.numeroFactura}`);
      doc.fontSize(11).font('Helvetica-Bold').fill(this.primaryColor).text('DATOS DEL EMPRESA', 40, 110);
      doc.fontSize(9).font('Helvetica').fill('#333333');
      const empresa = factura.empresa || {};
      doc.text(`Razon Social: ${empresa.razonSocial || 'N/A'}`, 40, 128);
      doc.text(`NIT: ${empresa.nit || 'N/A'}`, 40, 142);
      doc.text(`Direccion: ${empresa.direccion || 'N/A'}`, 40, 156);
      doc.fontSize(11).font('Helvetica-Bold').fill(this.primaryColor).text('DATOS DEL CLIENTE', 320, 110);
      doc.fontSize(9).font('Helvetica').fill('#333333');
      const cliente = factura.cliente || {};
      doc.text(`Nombre: ${cliente.nombre || 'N/A'}`, 320, 128);
      doc.text(`CC/NIT: ${cliente.documento || 'N/A'}`, 320, 142);
      doc.text(`Direccion: ${cliente.direccion || 'N/A'}`, 320, 156);
      doc.fontSize(9).fill('#333333');
      doc.text(`Fecha Emision: ${factura.fechaEmision}`, 40, 190);
      doc.text(`Forma de Pago: ${factura.formaPago || 'Contado'}`, 320, 190);
      let y = 215;
      doc.moveTo(40, y).lineTo(doc.page.width - 40, y).lineWidth(1).stroke(this.primaryColor);
      y += 15;
      doc.fontSize(12).fill(this.primaryColor).font('Helvetica-Bold').text('DETALLE DE PRODUCTOS', 40, y);
      y += 20;
      const headers = ['#', 'Descripcion', 'Cant.', 'P.Unitario', 'Descuento', 'Total'];
      const rows = (factura.detalle || []).map((item, i) => [i + 1, item.descripcion, item.cantidad, this._formatCOP(item.precioUnitario), `${item.descuento || 0}%`, this._formatCOP(item.total)]);
      y = this._drawTabla(doc, headers, rows, y, { colWidths: [35, 200, 50, 90, 70, 90] });
      y += 15;
      const totalesX = 350, valoresX = 490;
      doc.fontSize(10).fill('#333333').font('Helvetica-Bold').text('Subtotal:', totalesX, y, { width: 120 });
      doc.font('Helvetica').text(this._formatCOP(factura.subtotal || 0), valoresX, y, { width: 100, align: 'right' });
      y += 16;
      doc.font('Helvetica-Bold').text('IVA (19%):', totalesX, y, { width: 120 });
      doc.font('Helvetica').text(this._formatCOP(factura.iva || 0), valoresX, y, { width: 100, align: 'right' });
      y += 20;
      doc.moveTo(totalesX, y).lineTo(valoresX + 100, y).lineWidth(1).stroke('#333333');
      y += 8;
      doc.fontSize(14).font('Helvetica-Bold').fill(this.primaryColor).text('TOTAL A PAGAR:', totalesX, y, { width: 120 });
      doc.fill(this.primaryColor).text(this._formatCOP(factura.total || 0), valoresX, y, { width: 100, align: 'right' });
      this._drawFooter(doc, 1);
      doc.end();
      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }
}

module.exports = new PDFService();
