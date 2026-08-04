// src/services/inventory.service.js — Servicio ÚNICO para modificar stock
// Todas las operaciones de stock DEBEN pasar por aquí.
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');

/**
 * Registra un movimiento de inventario. DEBE ejecutarse dentro de una transacción.
 * Actualiza products.stock e inserta un registro en inventory_movements.
 * @param {Database} db - Instancia de base de datos (dentro de transacción)
 * @param {Object} params
 * @param {string} params.productId - ID del producto
 * @param {string} params.type - Tipo de movimiento (compra, venta, ajuste, devolucion, merma, vencimiento, traslado, inicial)
 * @param {number} params.qty - Cantidad (positiva para entrada, negativa para salida)
 * @param {number} [params.unitCost] - Costo unitario
 * @param {string} [params.referenceType] - Tipo de referencia (ej: 'purchase', 'order')
 * @param {string} [params.referenceId] - ID de la referencia
 * @param {string} [params.userId] - ID del usuario que realiza el movimiento
 * @param {string} [params.reason] - Motivo del movimiento
 * @returns {Object} Registro del movimiento creado
 */
function registrarMovimiento(db, params) {
  const { productId, type, qty, unitCost, referenceType, referenceId, userId, reason } = params;

  // Obtener stock actual del producto
  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
  if (!product) {
    throw new Error('Producto no encontrado');
  }

  const stockBefore = product.stock;
  const stockAfter = stockBefore + qty;

  // No permitir stock negativo
  if (stockAfter < 0) {
    throw new Error(`Stock insuficiente. Stock actual: ${stockBefore}, intenta descontar: ${Math.abs(qty)}`);
  }

  // Actualizar stock del producto
  db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(
    stockAfter, nowBogota(), productId
  );

  // Insertar movimiento
  const id = generateId();
  db.prepare(`
    INSERT INTO inventory_movements (id, product_id, type, qty, stock_before, stock_after, unit_cost, reference_type, reference_id, user_id, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, productId, type, qty, stockBefore, stockAfter, unitCost || 0, referenceType || null, referenceId || null, userId || null, reason || null, nowBogota());

  return { id, product_id: productId, type, qty, stock_before: stockBefore, stock_after: stockAfter };
}

/**
 * Obtiene movimientos de inventario con filtros opcionales.
 */
function getMovements(db, filters = {}) {
  const { product_id, type, from, to, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (product_id) { where += ' AND im.product_id = ?'; params.push(product_id); }
  if (type) { where += ' AND im.type = ?'; params.push(type); }
  if (from) { where += ' AND im.created_at >= ?'; params.push(from); }
  if (to) { where += ' AND im.created_at <= ?'; params.push(to); }

  const count = db.prepare(`SELECT COUNT(*) as total FROM inventory_movements im ${where}`).get(...params);
  const rows = db.prepare(`
    SELECT im.*, p.name as product_name, p.sku as product_sku, u.name as user_name
    FROM inventory_movements im
    LEFT JOIN products p ON p.id = im.product_id
    LEFT JOIN users u ON u.id = im.user_id
    ${where}
    ORDER BY im.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { data: rows, pagination: { page, limit, total: count.total, pages: Math.ceil(count.total / limit) } };
}

/**
 * Obtiene productos con stock bajo (debajo de stock_min).
 */
function getLowStock(db) {
  return db.prepare(`
    SELECT p.id, p.name, p.sku, p.stock, p.stock_min, p.unit, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.stock <= p.stock_min
    ORDER BY p.stock ASC
  `).all();
}

/**
 * Obtiene productos próximos a vencer.
 */
function getExpiring(db, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return db.prepare(`
    SELECT p.id, p.name, p.sku, p.expiry_date, p.stock, p.unit
    FROM products p
    WHERE p.is_active = 1 AND p.expiry_date IS NOT NULL AND p.expiry_date <= ?
    ORDER BY p.expiry_date ASC
  `).all(cutoffStr);
}

/**
 * Obtiene el Kardex de un producto (movimientos por período).
 */
function getKardex(db, productId, from, to) {
  let where = 'WHERE im.product_id = ?';
  const params = [productId];
  if (from) { where += ' AND im.created_at >= ?'; params.push(from); }
  if (to) { where += ' AND im.created_at <= ?'; params.push(to); }

  return db.prepare(`
    SELECT im.*, u.name as user_name
    FROM inventory_movements im
    LEFT JOIN users u ON u.id = im.user_id
    ${where}
    ORDER BY im.created_at ASC
  `).all(...params);
}

/**
 * Obtiene la valorización del inventario (stock * costo).
 */
function getValuation(db) {
  return db.prepare(`
    SELECT
      COUNT(*) as total_products,
      SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) as products_with_stock,
      SUM(stock * cost) as total_cost_value,
      SUM(stock * price) as total_sale_value
    FROM products WHERE is_active = 1
  `).get();
}

/**
 * Ajusta el stock de un producto manualmente.
 */
function adjustStock(db, productId, qty, reason, userId) {
  const type = qty >= 0 ? 'ajuste' : 'ajuste';
  return registrarMovimiento(db, {
    productId,
    type,
    qty,
    reason: reason || 'Ajuste manual de inventario',
    userId,
  });
}

/**
 * Realiza conteo físico de inventario.
 * Compara stock contado con stock del sistema y genera ajustes.
 */
function physicalCount(db, items, userId) {
  const results = [];
  for (const item of items) {
    const product = db.prepare('SELECT stock, name FROM products WHERE id = ?').get(item.product_id);
    if (!product) {
      results.push({ product_id: item.product_id, error: 'Producto no encontrado' });
      continue;
    }

    const diff = item.counted - product.stock;
    if (diff !== 0) {
      const movement = registrarMovimiento(db, {
        productId: item.product_id,
        type: 'ajuste',
        qty: diff,
        reason: `Conteo físico: contado ${item.counted}, sistema ${product.stock}`,
        userId,
      });
      results.push({ product_id: item.product_id, product_name: product.name, before: product.stock, counted: item.counted, diff, movement_id: movement.id });
    } else {
      results.push({ product_id: item.product_id, product_name: product.name, before: product.stock, counted: item.counted, diff: 0, message: 'Sin diferencias' });
    }
  }
  return results;
}

module.exports = {
  registrarMovimiento,
  getMovements,
  getLowStock,
  getExpiring,
  getKardex,
  getValuation,
  adjustStock,
  physicalCount,
};
