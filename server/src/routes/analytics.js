// src/routes/analytics.js — Rutas de análisis y estadísticas [admin]
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

/**
 * GET /api/analytics/dashboard — Panel principal [admin]
 */
router.get('/dashboard', authMiddleware(['admin']), (req, res) => {
  // Total de pedidos
  const totalOrders = db.prepare("SELECT COUNT(*) as value FROM orders WHERE status NOT IN ('cancelled')").get();

  // Ingresos totales
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as value FROM orders WHERE status NOT IN ('cancelled')").get();

  // Total de usuarios
  const totalUsers = db.prepare("SELECT COUNT(*) as value FROM users WHERE is_active = 1").get();

  // Pedidos activos (no completados ni cancelados)
  const activeOrders = db.prepare(`
    SELECT COUNT(*) as value FROM orders
    WHERE status IN ('pending','confirmed','preparing','ready','assigned','in_transit')
  `).get();

  // Últimos 10 pedidos
  const recentOrders = db.prepare(`
    SELECT o.id, o.status, o.total, o.client_name, o.worker_name, o.created_at
    FROM orders o ORDER BY o.created_at DESC LIMIT 10
  `).all();

  // Ventas por día (últimos 7 días)
  const salesByDay = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as orders, SUM(total) as revenue
    FROM orders
    WHERE status NOT IN ('cancelled')
      AND DATE(created_at) >= DATE('now', '-7 days', 'localtime')
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `).all();

  // Top 10 productos más vendidos
  const topProducts = db.prepare(`
    SELECT p.id, p.name, p.image, SUM(oi.qty) as total_qty, SUM(oi.line_total) as total_revenue
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN orders o ON o.id = oi.order_id
    WHERE o.status NOT IN ('cancelled')
    GROUP BY oi.product_id
    ORDER BY total_qty DESC
    LIMIT 10
  `).all();

  res.json({
    data: {
      total_orders: totalOrders.value,
      total_revenue: totalRevenue.value,
      total_users: totalUsers.value,
      active_orders: activeOrders.value,
      recent_orders: recentOrders,
      sales_by_day: salesByDay,
      top_products: topProducts,
    },
  });
});

/**
 * GET /api/analytics/sales — Ventas con filtros [admin]
 */
router.get('/sales', authMiddleware(['admin']), (req, res) => {
  const { from, to, group_by = 'day' } = req.query;

  let where = "WHERE o.status NOT IN ('cancelled')";
  const params = [];
  if (from) { where += ' AND DATE(o.created_at) >= ?'; params.push(from); }
  if (to) { where += ' AND DATE(o.created_at) <= ?'; params.push(to); }

  const groupField = group_by === 'month' ? "strftime('%Y-%m', o.created_at)" : "DATE(o.created_at)";

  const data = db.prepare(`
    SELECT ${groupField} as period,
           COUNT(*) as orders,
           SUM(o.subtotal) as subtotal,
           SUM(o.delivery_fee) as delivery_fees,
           SUM(o.discount) as discounts,
           SUM(o.tax_total) as taxes,
           SUM(o.total) as revenue
    FROM orders o
    ${where}
    GROUP BY ${groupField}
    ORDER BY period ASC
  `).all(...params);

  res.json({ data });
});

/**
 * GET /api/analytics/products — Análisis de productos [admin]
 */
router.get('/products', authMiddleware(['admin']), (req, res) => {
  const { from, to } = req.query;

  let where = "WHERE o.status NOT IN ('cancelled')";
  const params = [];
  if (from) { where += ' AND DATE(o.created_at) >= ?'; params.push(from); }
  if (to) { where += ' AND DATE(o.created_at) <= ?'; params.push(to); }

  const data = db.prepare(`
    SELECT p.id, p.name, p.category_id, c.name as category_name,
           SUM(oi.qty) as total_qty,
           SUM(oi.line_total) as total_revenue,
           COUNT(DISTINCT o.id) as order_count,
           p.stock as current_stock
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN orders o ON o.id = oi.order_id
    ${where}
    GROUP BY oi.product_id
    HAVING total_qty > 0
    ORDER BY total_revenue DESC
    LIMIT 50
  `).all(...params);

  res.json({ data });
});

/**
 * GET /api/analytics/workers — Rendimiento de trabajadores [admin]
 */
router.get('/workers', authMiddleware(['admin']), (req, res) => {
  const { from, to } = req.query;

  let where = "WHERE o.status IN ('delivered','picked_up')";
  const params = [];
  if (from) { where += ' AND DATE(o.created_at) >= ?'; params.push(from); }
  if (to) { where += ' AND DATE(o.created_at) <= ?'; params.push(to); }

  const data = db.prepare(`
    SELECT u.id, u.name, u.phone, u.avatar,
           COUNT(o.id) as total_deliveries,
           SUM(o.total) as total_revenue,
           AVG(o.total) as avg_order_value
    FROM users u
    LEFT JOIN orders o ON o.worker_id = u.id
    ${where}
    GROUP BY u.id
    HAVING u.role = 'worker'
    ORDER BY total_deliveries DESC
  `).all();

  res.json({ data });
});

/**
 * GET /api/analytics/export — Exportar datos [admin]
 */
router.get('/export', authMiddleware(['admin']), (req, res) => {
  const { format = 'json' } = req.query;

  if (format === 'json') {
    const orders = db.prepare(`
      SELECT o.id, o.status, o.subtotal, o.delivery_fee, o.discount, o.tax_total, o.total,
             o.payment_method, o.client_name, o.worker_name, o.created_at,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o ORDER BY o.created_at DESC LIMIT 500
    `).all();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=pedidos_export.json');
    return res.json({ data: orders, exported_at: new Date().toISOString() });
  }

  if (format === 'csv') {
    const orders = db.prepare(`
      SELECT id, status, subtotal, delivery_fee, discount, tax_total, total,
             payment_method, client_name, worker_name, created_at
      FROM orders ORDER BY created_at DESC LIMIT 500
    `).all();

    const headers = Object.keys(orders[0] || {}).join(',');
    const rows = orders.map(o => Object.values(o).map(v => `"${v}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=pedidos_export.csv');
    return res.send(csv);
  }

  res.status(400).json({ error: 'Formato de exportación no válido. Use "json" o "csv"' });
});

module.exports = router;
