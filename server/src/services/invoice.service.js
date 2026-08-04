// src/services/invoice.service.js — Servicio de facturación con proveedor mock
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { db } = require('../db');

/**
 * MockProveedorFacturacion — Simula un proveedor de facturación electrónica.
 * Genera numeración secuencial con prefijo 'SETP'.
 */
class MockProvider {
  constructor() {
    this.prefix = 'SETP';
    this.resolutions = {
      number: '18764',
      from: 1,
      to: 10000,
      validUntil: '2026-12-31',
    };
  }

  /**
   * Genera el siguiente número consecutivo de factura.
   */
  getNextNumber() {
    const last = db.prepare(`
      SELECT number FROM invoices ORDER BY number DESC LIMIT 1
    `).get();

    return last ? last.number + 1 : this.resolutions.from;
  }

  /**
   * Envia la factura a la DIAN (simulado).
   */
  sendToDian(invoiceId) {
    return {
      status: 'aceptada',
      cufe: generateId().substring(0, 20).toUpperCase(),
      response: JSON.stringify({ statusCode: 200, message: 'Factura aceptada por la DIAN' }),
    };
  }
}

const provider = new MockProvider();

/**
 * Crea una factura para un pedido.
 * @param {Database} dbConn - Instancia de base de datos (puede estar en transacción)
 * @param {Object} params
 * @param {string} params.orderId - ID del pedido
 * @param {Object} params.customer - Datos del cliente (name, doc, email, address)
 * @param {string} params.paymentMethod - Método de pago
 * @returns {Object} Factura creada
 */
function createInvoice(dbConn, params) {
  const { orderId, customer, paymentMethod } = params;

  // Obtener datos del pedido
  const order = dbConn.prepare(`
    SELECT o.*, u.name as client_name, u.email as client_email, u.phone as client_phone,
           u.doc_type as client_doc_type, u.doc_number as client_doc_number
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) throw new Error('Pedido no encontrado');

  // Verificar que no tenga factura ya
  if (order.invoice_id) throw new Error('Este pedido ya tiene una factura asociada');

  // Obtener items del pedido
  const items = dbConn.prepare(`
    SELECT oi.* FROM order_items oi WHERE oi.order_id = ?
  `).all(orderId);

  if (!items || items.length === 0) throw new Error('El pedido no tiene items');

  // Generar número
  const number = provider.getNextNumber();
  const prefix = provider.prefix;
  const fullNumber = `${prefix}${String(number).padStart(6, '0')}`;

  const now = nowBogota();
  const invoiceId = generateId();

  // Calcular totales
  let subtotal = 0, taxTotal = 0, discountTotal = 0;
  for (const item of items) {
    subtotal += item.line_total || (item.qty * item.unit_price);
    taxTotal += item.tax_amount || 0;
    discountTotal += item.discount || 0;
  }
  subtotal = roundCOP(subtotal);
  taxTotal = roundCOP(taxTotal);
  discountTotal = roundCOP(discountTotal);
  const total = roundCOP(subtotal - discountTotal + taxTotal);

  // Insertar factura
  dbConn.prepare(`
    INSERT INTO invoices (
      id, order_id, type, prefix, number, full_number,
      resolution_number, resolution_from, resolution_to, resolution_valid_until,
      customer_doc_type, customer_doc, customer_name, customer_email, customer_address,
      subtotal, discount_total, tax_total, total, payment_method,
      dian_status, issued_at, created_at
    ) VALUES (?, ?, 'factura', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
  `).run(
    invoiceId, orderId, prefix, number, fullNumber,
    provider.resolutions.number, provider.resolutions.from, provider.resolutions.to, provider.resolutions.validUntil,
    customer?.doc_type || order.client_doc_type || '',
    customer?.doc || order.client_doc_number || '',
    customer?.name || order.client_name || order.client_name || '',
    customer?.email || order.client_email || '',
    customer?.address || order.delivery_address || '',
    subtotal, discountTotal, taxTotal, total,
    paymentMethod || order.payment_method || 'efectivo',
    now, now
  );

  // Insertar items de factura
  for (const item of items) {
    dbConn.prepare(`
      INSERT INTO invoice_items (
        id, invoice_id, product_id, description, qty, unit_price, discount, tax_rate, tax_amount, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(), invoiceId, item.product_id,
      item.product_name || item.description || '',
      item.qty, item.unit_price, item.discount || 0, item.tax_rate || 0, item.tax_amount || 0, item.line_total
    );
  }

  // Asociar factura al pedido
  dbConn.prepare('UPDATE orders SET invoice_id = ?, updated_at = ? WHERE id = ?').run(invoiceId, now, orderId);

  return {
    id: invoiceId,
    order_id: orderId,
    full_number: fullNumber,
    total,
    dian_status: 'pendiente',
  };
}

/**
 * Obtiene una factura por ID con sus items.
 */
function getInvoice(dbConn, id) {
  const invoice = dbConn.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!invoice) return null;
  invoice.items = dbConn.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
  return invoice;
}

/**
 * Lista facturas con filtros.
 */
function getInvoices(dbConn, filters = {}) {
  const { from, to, status, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];
  if (from) { where += ' AND issued_at >= ?'; params.push(from); }
  if (to) { where += ' AND issued_at <= ?'; params.push(to); }
  if (status) { where += ' AND dian_status = ?'; params.push(status); }

  const count = dbConn.prepare(`SELECT COUNT(*) as total FROM invoices ${where}`).get(...params);
  const data = dbConn.prepare(`
    SELECT * FROM invoices ${where}
    ORDER BY issued_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { data, pagination: { page, limit, total: count.total, pages: Math.ceil(count.total / limit) } };
}

/**
 * Genera PDF de factura (simulado — devuelve la ruta donde se guardaría).
 */
function generatePdf(dbConn, invoiceId) {
  const invoice = getInvoice(dbConn, invoiceId);
  if (!invoice) throw new Error('Factura no encontrada');

  const pdfPath = `data/invoices/${invoice.full_number}.pdf`;
  // En producción se generaría con ReportLab/JSPDF/Puppeteer
  dbConn.prepare('UPDATE invoices SET pdf_path = ? WHERE id = ?').run(pdfPath, invoiceId);
  return { invoice_id: invoiceId, pdf_path: pdfPath, message: 'PDF generado exitosamente' };
}

/**
 * Obtiene el estado de numeración (rango disponible).
 */
function getNumberingStatus(dbConn) {
  const last = dbConn.prepare('SELECT MAX(number) as last_used FROM invoices').get();
  return {
    prefix: provider.prefix,
    resolution: provider.resolutions.number,
    from: provider.resolutions.from,
    to: provider.resolutions.to,
    valid_until: provider.resolutions.validUntil,
    last_used: last?.last_used || 0,
    available: (provider.resolutions.to - (last?.last_used || 0)),
  };
}

module.exports = {
  createInvoice,
  getInvoice,
  getInvoices,
  generatePdf,
  getNumberingStatus,
  provider,
};
