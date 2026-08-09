const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db');
const pdfService = require('../services/pdf.service');
const path = require('path');
const fs = require('fs');

// POST /api/reports/daily — Reporte diario de pedidos
router.post('/daily', authMiddleware(['admin']), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const orders = db.prepare(`
      SELECT o.*, GROUP_CONCAT(p.name || ' x' || oi.qty) as products_summary
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE DATE(o.created_at) = DATE(?)
      GROUP BY o.id
    `).all(today);

    const totalPedidos = orders.length;
    const completados = orders.filter(o => o.status === 'delivered' || o.status === 'picked_up').length;
    const pendientes = orders.filter(o => !['delivered', 'cancelled', 'picked_up'].includes(o.status)).length;
    const cancelados = orders.filter(o => o.status === 'cancelled').length;
    const ingresosTotales = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (o.total || 0), 0);
    const ticketPromedio = completados > 0 ? Math.round(ingresosTotales / completados) : 0;

    const productosMasVendidos = db.prepare(`
      SELECT p.name as nombre, SUM(oi.qty) as unidadesVendidas, SUM(oi.line_total) as totalVendido
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) = DATE(?) AND o.status != 'cancelled'
      GROUP BY p.id ORDER BY unidadesVendidas DESC LIMIT 10
    `).all(today);

    const porMetodoPago = db.prepare(`
      SELECT payment_method as metodo, COUNT(*) as cantidad, SUM(total) as total
      FROM orders WHERE DATE(created_at) = DATE(?) AND status != 'cancelled'
      GROUP BY payment_method
    `).all(today);

    const datos = { totalPedidos, completados, pendientes, cancelados, ingresosTotales, ticketPromedio, productosMasVendidos, porMetodoPago };

    const reportsDir = path.resolve(__dirname, '..', '..', 'data', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const outputPath = path.join(reportsDir, `reporte_diario_${today}.pdf`);

    await pdfService.generarReporteDiarioPedidos(datos, outputPath);
    res.download(outputPath, `reporte_diario_${today}.pdf`);
  } catch (err) {
    console.error('[REPORTS] Error generando reporte diario:', err.message);
    res.status(500).json({ error: 'Error generando reporte' });
  }
});

// POST /api/reports/sales — Reporte de ventas por rango
router.post('/sales', authMiddleware(['admin']), async (req, res) => {
  try {
    const { from, to } = req.body;
    const fechaInicio = from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const fechaFin = to || new Date().toISOString().split('T')[0];

    const ventas = db.prepare(`
      SELECT DATE(created_at) as fecha, COUNT(*) as pedidos, SUM(total) as ingresos
      FROM orders WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?) AND status != 'cancelled'
      GROUP BY DATE(created_at) ORDER BY fecha
    `).all(fechaInicio, fechaFin);

    const totalVentas = ventas.reduce((sum, v) => sum + (v.ingresos || 0), 0);
    const totalTransacciones = ventas.reduce((sum, v) => sum + v.pedidos, 0);
    const dias = ventas.length || 1;

    const topProductos = db.prepare(`
      SELECT p.name as nombre, SUM(oi.qty) as unidades, SUM(oi.line_total) as ingresos
      FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) BETWEEN DATE(?) AND DATE(?) AND o.status != 'cancelled'
      GROUP BY p.id ORDER BY ingresos DESC LIMIT 10
    `).all(fechaInicio, fechaFin);

    const datos = {
      fechaInicio, fechaFin, totalVentas, totalTransacciones,
      promedioDiario: Math.round(totalVentas / dias),
      desgloseDiario: ventas.map(v => ({ ...v, ticketPromedio: v.pedidos > 0 ? Math.round(v.ingresos / v.pedidos) : 0 })),
      topProductos,
    };

    const reportsDir = path.resolve(__dirname, '..', '..', 'data', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const outputPath = path.join(reportsDir, `ventas_${fechaInicio}_${fechaFin}.pdf`);

    await pdfService.generarReporteVentasPorFecha(datos, outputPath);
    res.download(outputPath, `ventas_${fechaInicio}_${fechaFin}.pdf`);
  } catch (err) {
    console.error('[REPORTS] Error generando reporte de ventas:', err.message);
    res.status(500).json({ error: 'Error generando reporte' });
  }
});

// POST /api/reports/inventory — Reporte de inventario
router.post('/inventory', authMiddleware(['admin']), async (req, res) => {
  try {
    const stockActual = db.prepare(`
      SELECT p.sku as codigo, p.name as nombre, c.name as categoria, p.stock, p.stock_min as minimo
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 ORDER BY p.stock ASC
    `).all();

    const bajoMinimoDetalle = stockActual.filter(p => p.stock <= p.minimo);
    const valorTotal = stockActual.reduce((sum, p) => sum + (p.stock * (p.cost || 0)), 0);

    const datos = {
      totalProductos: stockActual.length,
      stockTotalUnidades: stockActual.reduce((sum, p) => sum + p.stock, 0),
      valorTotalInventario: valorTotal,
      bajoMinimo: bajoMinimoDetalle.length,
      stockActual, bajoMinimoDetalle,
    };

    const reportsDir = path.resolve(__dirname, '..', '..', 'data', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const outputPath = path.join(reportsDir, `inventario_${new Date().toISOString().split('T')[0]}.pdf`);

    await pdfService.generarReporteInventario(datos, outputPath);
    res.download(outputPath, `inventario_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (err) {
    console.error('[REPORTS] Error generando reporte de inventario:', err.message);
    res.status(500).json({ error: 'Error generando reporte' });
  }
});

module.exports = router;
