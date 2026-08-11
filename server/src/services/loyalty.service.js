// src/services/loyalty.service.js — Programa de fidelización completo
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');

// ─── Constantes del programa ─────────────────────────────────
const POINTS_PER_COP = 100;          // 1 punto por cada $100 COP
const REDEMPTION_RATE = 100;         // 100 puntos = $1,000 descuento
const REDEMPTION_VALUE = 1000;       // Valor en COP por cada 100 puntos canjeados

const LEVELS = {
  BRONZE: { name: 'Bronce', min: 0, max: 999 },
  SILVER: { name: 'Plata', min: 1000, max: 4999 },
  GOLD:   { name: 'Oro',   min: 5000, max: Infinity },
};

const BENEFITS = {
  BRONZE: {
    level: 'Bronce',
    discountPercent: 0,
    freeShipping: false,
    freeShippingMinOrder: 0,
    exclusiveOffers: false,
    description: 'Sin beneficios adicionales. ¡Sigue acumulando puntos!',
  },
  SILVER: {
    level: 'Plata',
    discountPercent: 5,
    freeShipping: true,
    freeShippingMinOrder: 30000,
    exclusiveOffers: false,
    description: '5% de descuento en compras. Envío gratis en pedidos superiores a $30,000.',
  },
  GOLD: {
    level: 'Oro',
    discountPercent: 10,
    freeShipping: true,
    freeShippingMinOrder: 0,
    exclusiveOffers: true,
    description: '10% de descuento en compras. Envío gratis siempre. Ofertas exclusivas.',
  },
};

// ─── Inicialización de tablas ─────────────────────────────────
function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      points INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_redeemed INTEGER DEFAULT 0,
      level TEXT DEFAULT 'Bronce' CHECK(level IN ('Bronce','Plata','Oro')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loyalty_movements (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES loyalty_accounts(id),
      type TEXT NOT NULL CHECK(type IN ('earn','redeem','expire','adjust','bonus')),
      points INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_user ON loyalty_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_level ON loyalty_accounts(level);
    CREATE INDEX IF NOT EXISTS idx_loyalty_movements_account ON loyalty_movements(account_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_movements_type ON loyalty_movements(type);
    CREATE INDEX IF NOT EXISTS idx_loyalty_movements_created ON loyalty_movements(created_at);
  `);
}

// ─── Helpers internos ────────────────────────────────────────

/**
 * Determina el nivel según los puntos acumulados.
 */
function getLevelForPoints(totalPoints) {
  if (totalPoints >= LEVELS.GOLD.min) return 'Oro';
  if (totalPoints >= LEVELS.SILVER.min) return 'Plata';
  return 'Bronce';
}

/**
 * Calcula los puntos a ganar por un monto en COP.
 */
function calculatePointsForAmount(amountCOP) {
  return Math.floor(amountCOP / POINTS_PER_COP);
}

/**
 * Calcula el descuento por canje de puntos.
 */
function calculateRedemptionDiscount(pointsToRedeem) {
  const batches = Math.floor(pointsToRedeem / REDEMPTION_RATE);
  return roundCOP(batches * REDEMPTION_VALUE);
}

/**
 * Obtiene o crea la cuenta de fidelidad de un usuario.
 */
function getOrCreateAccount(db, userId) {
  ensureTables(db);
  let account = db.prepare('SELECT * FROM loyalty_accounts WHERE user_id = ?').get(userId);

  if (!account) {
    const id = generateId();
    const now = nowBogota();
    db.prepare(`
      INSERT INTO loyalty_accounts (id, user_id, points, total_earned, total_redeemed, level, created_at, updated_at)
      VALUES (?, ?, 0, 0, 0, 'Bronce', ?, ?)
    `).run(id, userId, now, now);
    account = db.prepare('SELECT * FROM loyalty_accounts WHERE id = ?').get(id);
  }

  return account;
}

/**
 * Registra un movimiento de puntos y actualiza el saldo.
 */
function registerMovement(db, accountId, type, points, balanceAfter, refType, refId, description) {
  const id = generateId();
  const now = nowBogota();
  db.prepare(`
    INSERT INTO loyalty_movements (id, account_id, type, points, balance_after, reference_type, reference_id, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, accountId, type, points, balanceAfter, refType || null, refId || null, description || null, now);
  return id;
}

/**
 * Actualiza el nivel de la cuenta según sus puntos.
 */
function updateAccountLevel(db, account) {
  const newLevel = getLevelForPoints(account.points);
  if (newLevel !== account.level) {
    db.prepare('UPDATE loyalty_accounts SET level = ?, updated_at = ? WHERE id = ?')
      .run(newLevel, nowBogota(), account.id);
    account.level = newLevel;
  }
}

// ─── API pública del servicio ─────────────────────────────────

/**
 * Acumula puntos por un pedido confirmado.
 * Se llama cuando el estado del pedido cambia a 'confirmed'.
 * @param {Database} db - Instancia de better-sqlite3
 * @param {Object} params
 * @param {string} params.userId - ID del usuario
 * @param {string} params.orderId - ID del pedido
 * @param {number} params.orderTotal - Total del pedido en COP
 * @returns {Object} Resultado de la acumulación
 */
function earnPoints(db, { userId, orderId, orderTotal }) {
  ensureTables(db);

  const pointsEarned = calculatePointsForAmount(orderTotal);
  if (pointsEarned <= 0) {
    return { pointsEarned: 0, message: 'Monto insuficiente para acumular puntos' };
  }

  const account = getOrCreateAccount(db, userId);
  const newBalance = account.points + pointsEarned;
  const newTotalEarned = account.total_earned + pointsEarned;

  // Actualizar cuenta
  db.prepare(`
    UPDATE loyalty_accounts SET points = ?, total_earned = ?, updated_at = ? WHERE id = ?
  `).run(newBalance, newTotalEarned, nowBogota(), account.id);

  // Registrar movimiento
  registerMovement(
    db, account.id, 'earn', pointsEarned, newBalance,
    'order', orderId,
    `Puntos ganados por pedido #${orderId.substring(0, 8)} — $${orderTotal.toLocaleString('es-CO')}`
  );

  // Actualizar nivel si es necesario
  const updatedAccount = db.prepare('SELECT * FROM loyalty_accounts WHERE id = ?').get(account.id);
  updateAccountLevel(db, updatedAccount);

  return {
    pointsEarned,
    previousBalance: account.points,
    newBalance,
    level: updatedAccount.level,
    orderTotal,
  };
}

/**
 * Canjea puntos en el checkout para obtener descuento.
 * @param {Database} db
 * @param {Object} params
 * @param {string} params.userId
 * @param {number} params.pointsToRedeem - Puntos a canjear (múltiplos de 100)
 * @param {string} [params.orderId] - ID del pedido asociado
 * @returns {Object} Resultado del canje
 */
function redeemPoints(db, { userId, pointsToRedeem, orderId }) {
  ensureTables(db);

  if (!pointsToRedeem || pointsToRedeem <= 0) {
    throw new Error('Cantidad de puntos inválida');
  }

  if (pointsToRedeem % REDEMPTION_RATE !== 0) {
    throw new Error(`Los puntos deben ser múltiplos de ${REDEMPTION_RATE}`);
  }

  const account = getOrCreateAccount(db, userId);

  if (account.points < pointsToRedeem) {
    throw new Error(`Saldo insuficiente. Tienes ${account.points} puntos, intentas canjear ${pointsToRedeem}`);
  }

  const discount = calculateRedemptionDiscount(pointsToRedeem);
  const newBalance = account.points - pointsToRedeem;
  const newTotalRedeemed = account.total_redeemed + pointsToRedeem;

  // Actualizar cuenta
  db.prepare(`
    UPDATE loyalty_accounts SET points = ?, total_redeemed = ?, updated_at = ? WHERE id = ?
  `).run(newBalance, newTotalRedeemed, nowBogota(), account.id);

  // Registrar movimiento
  registerMovement(
    db, account.id, 'redeem', -pointsToRedeem, newBalance,
    'order', orderId || null,
    `Canje de ${pointsToRedeem} puntos por $${discount.toLocaleString('es-CO')} de descuento`
  );

  // Actualizar nivel si es necesario
  const updatedAccount = db.prepare('SELECT * FROM loyalty_accounts WHERE id = ?').get(account.id);
  updateAccountLevel(db, updatedAccount);

  return {
    pointsRedeemed: pointsToRedeem,
    discount,
    previousBalance: account.points,
    newBalance,
    level: updatedAccount.level,
  };
}

/**
 * Otorga bonificación de puntos (promociones, eventos especiales, etc.)
 * @param {Database} db
 * @param {Object} params
 * @param {string} params.userId
 * @param {number} params.points - Puntos a bonificar
 * @param {string} params.reason - Motivo de la bonificación
 * @param {string} [params.referenceType]
 * @param {string} [params.referenceId]
 * @returns {Object}
 */
function bonusPoints(db, { userId, points, reason, referenceType, referenceId }) {
  ensureTables(db);

  if (!points || points <= 0) {
    throw new Error('Cantidad de puntos inválida');
  }

  const account = getOrCreateAccount(db, userId);
  const newBalance = account.points + points;
  const newTotalEarned = account.total_earned + points;

  db.prepare(`
    UPDATE loyalty_accounts SET points = ?, total_earned = ?, updated_at = ? WHERE id = ?
  `).run(newBalance, newTotalEarned, nowBogota(), account.id);

  registerMovement(
    db, account.id, 'bonus', points, newBalance,
    referenceType || 'bonus', referenceId || null,
    reason || 'Bonificación de puntos'
  );

  const updatedAccount = db.prepare('SELECT * FROM loyalty_accounts WHERE id = ?').get(account.id);
  updateAccountLevel(db, updatedAccount);

  return {
    pointsAwarded: points,
    newBalance,
    level: updatedAccount.level,
  };
}

/**
 * Ajusta puntos (corrección manual por admin).
 * @param {Database} db
 * @param {Object} params
 * @param {string} params.userId
 * @param {number} params.points - Puntos a ajustar (positivo o negativo)
 * @param {string} params.reason
 * @param {string} [params.adminId]
 * @returns {Object}
 */
function adjustPoints(db, { userId, points, reason, adminId }) {
  ensureTables(db);

  if (!points || points === 0) {
    throw new Error('La cantidad de puntos no puede ser cero');
  }

  const account = getOrCreateAccount(db, userId);
  const newBalance = account.points + points;

  if (newBalance < 0) {
    throw new Error(`El ajuste dejaría el saldo en negativo (${newBalance})`);
  }

  const newTotalEarned = points > 0 ? account.total_earned + points : account.total_earned;
  const newTotalRedeemed = points < 0 ? account.total_redeemed + Math.abs(points) : account.total_redeemed;

  db.prepare(`
    UPDATE loyalty_accounts SET points = ?, total_earned = ?, total_redeemed = ?, updated_at = ? WHERE id = ?
  `).run(newBalance, newTotalEarned, newTotalRedeemed, nowBogota(), account.id);

  registerMovement(
    db, account.id, 'adjust', points, newBalance,
    'admin', adminId || null,
    reason || 'Ajuste manual de puntos'
  );

  const updatedAccount = db.prepare('SELECT * FROM loyalty_accounts WHERE id = ?').get(account.id);
  updateAccountLevel(db, updatedAccount);

  return {
    adjustedPoints: points,
    previousBalance: account.points,
    newBalance,
    level: updatedAccount.level,
  };
}

/**
 * Obtiene el nivel y beneficios actuales de un usuario.
 * @param {Database} db
 * @param {string} userId
 * @returns {Object} Nivel, beneficios y resumen de cuenta
 */
function getUserLoyaltyInfo(db, userId) {
  ensureTables(db);
  const account = getOrCreateAccount(db, userId);
  const benefits = BENEFITS[account.level] || BENEFITS.BRONZE;

  // Puntos necesarios para el siguiente nivel
  let nextLevel = null;
  let pointsToNextLevel = null;
  if (account.level === 'Bronce') {
    nextLevel = 'Plata';
    pointsToNextLevel = LEVELS.SILVER.min - account.points;
  } else if (account.level === 'Plata') {
    nextLevel = 'Oro';
    pointsToNextLevel = LEVELS.GOLD.min - account.points;
  }

  return {
    account: {
      id: account.id,
      points: account.points,
      totalEarned: account.total_earned,
      totalRedeemed: account.total_redeemed,
      level: account.level,
      createdAt: account.created_at,
    },
    benefits,
    nextLevel,
    pointsToNextLevel,
    // Utilidad para el frontend
    redeemableValue: calculateRedemptionDiscount(account.points),
    maxRedeemablePoints: Math.floor(account.points / REDEMPTION_RATE) * REDEMPTION_RATE,
  };
}

/**
 * Obtiene el historial de movimientos de puntos de un usuario.
 * @param {Database} db
 * @param {string} userId
 * @param {Object} [filters]
 * @param {string} [filters.type] - Filtrar por tipo (earn, redeem, expire, adjust, bonus)
 * @param {string} [filters.from] - Fecha desde
 * @param {string} [filters.to] - Fecha hasta
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 * @returns {Object} Movimientos paginados
 */
function getPointsHistory(db, userId, filters = {}) {
  ensureTables(db);
  const { type, from, to, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const account = db.prepare('SELECT id FROM loyalty_accounts WHERE user_id = ?').get(userId);
  if (!account) {
    return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
  }

  let where = 'WHERE account_id = ?';
  const params = [account.id];

  if (type) { where += ' AND type = ?'; params.push(type); }
  if (from) { where += ' AND created_at >= ?'; params.push(from); }
  if (to) { where += ' AND created_at <= ?'; params.push(to); }

  const count = db.prepare(`SELECT COUNT(*) as total FROM loyalty_movements ${where}`).get(...params);
  const rows = db.prepare(`
    SELECT * FROM loyalty_movements ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: count.total,
      pages: Math.ceil(count.total / limit),
    },
  };
}

/**
 * Dashboard de estadísticas de fidelización para admin.
 * @param {Database} db
 * @param {Object} [filters]
 * @param {string} [filters.from] - Fecha desde
 * @param {string} [filters.to] - Fecha hasta
 * @returns {Object} Estadísticas completas
 */
function getLoyaltyDashboard(db, filters = {}) {
  ensureTables(db);
  const { from, to } = filters;

  let dateFilter = '';
  const params = [];
  if (from) { dateFilter += ' AND created_at >= ?'; params.push(from); }
  if (to) { dateFilter += ' AND created_at <= ?'; params.push(to); }

  // Resumen general de cuentas
  const accountsSummary = db.prepare(`
    SELECT
      COUNT(*) as total_accounts,
      SUM(CASE WHEN level = 'Bronce' THEN 1 ELSE 0 END) as bronze_count,
      SUM(CASE WHEN level = 'Plata' THEN 1 ELSE 0 END) as silver_count,
      SUM(CASE WHEN level = 'Oro' THEN 1 ELSE 0 END) as gold_count,
      SUM(points) as total_points_outstanding,
      SUM(total_earned) as total_points_ever_earned,
      SUM(total_redeemed) as total_points_redeemed
    FROM loyalty_accounts
  `).get();

  // Movimientos del período
  const movementsSummary = db.prepare(`
    SELECT
      type,
      COUNT(*) as count,
      SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as points_in,
      SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END) as points_out
    FROM loyalty_movements
    WHERE 1=1 ${dateFilter}
    GROUP BY type
  `).all(...params);

  // Total de descuentos otorgados por canje
  const redemptions = db.prepare(`
    SELECT
      COUNT(*) as total_redemptions,
      SUM(ABS(points)) as total_points_redeemed,
      COUNT(DISTINCT account_id) as unique_users
    FROM loyalty_movements
    WHERE type = 'redeem' ${dateFilter}
  `).get(...params);

  // Top 10 clientes con más puntos
  const topClients = db.prepare(`
    SELECT
      la.user_id,
      u.name as user_name,
      u.email as user_email,
      la.points,
      la.total_earned,
      la.total_redeemed,
      la.level
    FROM loyalty_accounts la
    JOIN users u ON u.id = la.user_id
    ORDER BY la.points DESC
    LIMIT 10
  `).all();

  // Top 10 clientes por compras (más puntos ganados)
  const topBySpending = db.prepare(`
    SELECT
      la.user_id,
      u.name as user_name,
      u.email as user_email,
      la.total_earned,
      la.level,
      ROUND(la.total_earned * ${POINTS_PER_COP}, 0) as estimated_spend
    FROM loyalty_accounts la
    JOIN users u ON u.id = la.user_id
    ORDER BY la.total_earned DESC
    LIMIT 10
  `).all();

  // Movimientos diarios (para gráfico)
  const dailyMovements = db.prepare(`
    SELECT
      DATE(created_at) as date,
      SUM(CASE WHEN type = 'earn' THEN points ELSE 0 END) as earned,
      SUM(CASE WHEN type = 'redeem' THEN ABS(points) ELSE 0 END) as redeemed,
      SUM(CASE WHEN type = 'bonus' THEN points ELSE 0 END) as bonus
    FROM loyalty_movements
    WHERE 1=1 ${dateFilter}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `).all(...params);

  // Distribución de niveles como porcentaje
  const totalAccounts = accountsSummary.total_accounts || 1;
  const levelDistribution = {
    Bronce: { count: accountsSummary.bronze_count || 0, percent: Math.round(((accountsSummary.bronze_count || 0) / totalAccounts) * 100) },
    Plata:  { count: accountsSummary.silver_count || 0, percent: Math.round(((accountsSummary.silver_count || 0) / totalAccounts) * 100) },
    Oro:    { count: accountsSummary.gold_count || 0,    percent: Math.round(((accountsSummary.gold_count || 0) / totalAccounts) * 100) },
  };

  // Valor estimado de descuentos otorgados
  const estimatedDiscountValue = (redemptions.total_points_redeemed || 0) / REDEMPTION_RATE * REDEMPTION_VALUE;

  return {
    summary: {
      totalAccounts: accountsSummary.total_accounts || 0,
      totalPointsOutstanding: accountsSummary.total_points_outstanding || 0,
      totalPointsEverEarned: accountsSummary.total_points_ever_earned || 0,
      totalPointsRedeemed: accountsSummary.total_points_redeemed || 0,
      estimatedDiscountValue: roundCOP(estimatedDiscountValue),
    },
    levelDistribution,
    movementsByType: movementsSummary,
    redemptions: {
      totalRedemptions: redemptions.total_redemptions || 0,
      totalPointsRedeemed: redemptions.total_points_redeemed || 0,
      uniqueUsers: redemptions.unique_users || 0,
    },
    topClients,
    topBySpending,
    dailyMovements,
    period: { from: from || 'Inicio', to: to || 'Ahora' },
  };
}

/**
 * Calcula el beneficio de envío gratis para un pedido.
 * @param {Database} db
 * @param {string} userId
 * @param {number} orderTotal
 * @returns {Object} Si tiene envío gratis y por qué razón
 */
function getShippingBenefit(db, userId, orderTotal) {
  ensureTables(db);
  const account = getOrCreateAccount(db, userId);
  const benefits = BENEFITS[account.level] || BENEFITS.BRONZE;

  if (!benefits.freeShipping) {
    return { freeShipping: false, reason: `Nivel ${account.level}: sin envío gratis` };
  }

  if (benefits.freeShippingMinOrder > 0 && orderTotal < benefits.freeShippingMinOrder) {
    return {
      freeShipping: false,
      reason: `Envío gratis en pedidos superiores a $${benefits.freeShippingMinOrder.toLocaleString('es-CO')}`,
    };
  }

  return {
    freeShipping: true,
    reason: `Nivel ${account.level}: envío gratis${benefits.freeShippingMinOrder > 0 ? ` (pedidos > $${benefits.freeShippingMinOrder.toLocaleString('es-CO')})` : ' siempre'}`,
  };
}

/**
 * Calcula el descuento por nivel para un pedido.
 * @param {Database} db
 * @param {string} userId
 * @param {number} subtotal
 * @returns {Object} Porcentaje y monto de descuento
 */
function getLevelDiscount(db, userId, subtotal) {
  ensureTables(db);
  const account = getOrCreateAccount(db, userId);
  const benefits = BENEFITS[account.level] || BENEFITS.BRONZE;

  if (benefits.discountPercent <= 0) {
    return { discountPercent: 0, discountAmount: 0, level: account.level };
  }

  const discountAmount = roundCOP(subtotal * (benefits.discountPercent / 100));
  return {
    discountPercent: benefits.discountPercent,
    discountAmount,
    level: account.level,
  };
}

/**
 * Obtiene la información de beneficios de todos los niveles (para mostrar en app).
 * @returns {Object} Configuración de niveles y beneficios
 */
function getLevelsInfo() {
  return {
    levels: Object.entries(LEVELS).map(([key, level]) => ({
      key,
      name: level.name,
      minPoints: level.min,
      maxPoints: level.max === Infinity ? null : level.max,
      benefits: BENEFITS[key],
    })),
    pointsPerCop: POINTS_PER_COP,
    redemptionRate: REDEMPTION_RATE,
    redemptionValue: REDEMPTION_VALUE,
  };
}

module.exports = {
  ensureTables,
  earnPoints,
  redeemPoints,
  bonusPoints,
  adjustPoints,
  getUserLoyaltyInfo,
  getPointsHistory,
  getLoyaltyDashboard,
  getShippingBenefit,
  getLevelDiscount,
  getLevelsInfo,
  // Exportar constantes para uso externo
  POINTS_PER_COP,
  REDEMPTION_RATE,
  REDEMPTION_VALUE,
  LEVELS,
  BENEFITS,
};
