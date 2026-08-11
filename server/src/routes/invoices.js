// src/routes/invoices.js — Rutas de facturación
const express = require('express');
const { Router } = express;
const { db, runInTransaction } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const invoiceService = require('../services/invoice.service');

const router = Router();

/**
 * POST /api/invoices — Crear factura [admin, worker]
 */
router.post('/', authMiddleware(['admin', 'worker']), (req, res) => {
  const { order_id, customer } = req.body;
  if (!order_id) return res.status(400).json({ error: 'El campo "order_id" es obligatorio' });

  try {
    const result = runInTransaction((dbTx) => {
      return invoiceService.createInvoice(dbTx, { orderId: order_id, customer, paymentMethod: req.body.payment_method });
    });

    const invoice = invoiceService.getInvoice(db, result.id);
    res.status(201).json({ data: invoice, message: 'Factura creada exitosamente' });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

/**
 * GET /api/invoices — Listar facturas [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const { from, to, status, page = 1, limit = 20 } = req.query;
  const result = invoiceService.getInvoices(db, { from, to, status, page, limit });
  res.json(result);
});

/**
 * GET /api/invoices/:id — Obtener factura [admin, worker]
 */
router.get('/:id', authMiddleware(['admin', 'worker']), (req, res) => {
  const invoice = invoiceService.getInvoice(db, req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json({ data: invoice });
});

/**
 * GET /api/invoices/:id/pdf — Generar PDF de factura [admin]
 */
router.get('/:id/pdf', authMiddleware(['admin']), (req, res) => {
  try {
    const result = invoiceService.generatePdf(db, req.params.id);
    res.json({ data: result });
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }
});

/**
 * POST /api/invoices/:id/send-dian — Enviar factura a DIAN [admin]
 */
router.post('/:id/send-dian', authMiddleware(['admin']), (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

  if (invoice.dian_status === 'aceptada') {
    return res.status(422).json({ error: 'Esta factura ya fue aceptada por la DIAN' });
  }

  const now = require('../utils/dates').nowBogota();
  const result = invoiceService.provider.sendToDian(req.params.id);

  db.prepare(`
    UPDATE invoices SET dian_status = ?, dian_response = ?, cufe = ?, dian_sent_at = ?
    WHERE id = ?
  `).run(result.status, result.response, result.cufe, now, req.params.id);

  const updated = invoiceService.getInvoice(db, req.params.id);
  res.json({ data: updated, message: `Factura ${result.status === 'aceptada' ? 'aceptada' : 'rechazada'} por la DIAN` });
});

/**
 * POST /api/invoices/:id/credit-note — Generar nota crédito [admin]
 */
router.post('/:id/credit-note', authMiddleware(['admin']), (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

  const { reason, items } = req.body;
  if (!reason) return res.status(400).json({ error: 'El campo "reason" es obligatorio' });

  const { generateId } = require('../utils/ids');
  const now = require('../utils/dates').nowBogota();

  // Crear nota crédito como factura con tipo 'nota_credito'
  const noteId = generateId();
  const number = db.prepare('SELECT MAX(number) as last FROM invoices').get()?.last || 0;
  const fullNumber = `NC${String(number + 1).padStart(6, '0')}`;

  let totalCredit = 0;
  if (items && Array.isArray(items)) {
    for (const item of items) {
      totalCredit += item.line_total || 0;
    }
  }

  db.prepare(`
    INSERT INTO invoices (id, order_id, type, prefix, number, full_number,
      customer_name, customer_doc, subtotal, total,
      dian_status, issued_at, created_at)
    VALUES (?, ?, 'nota_credito', 'NC', ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
  `).run(noteId, invoice.order_id, number + 1, fullNumber,
    invoice.customer_name, invoice.customer_doc, 0, totalCredit, now, now);

  res.status(201).json({
    data: { id: noteId, full_number: fullNumber, total: totalCredit, reason },
    message: 'Nota crédito generada exitosamente',
  });
});

/**
 * GET /api/invoices/numbering — Estado de numeración [admin]
 */
router.get('/numbering', authMiddleware(['admin']), (req, res) => {
  const status = invoiceService.getNumberingStatus(db);
  res.json({ data: status });
});

module.exports = router;
