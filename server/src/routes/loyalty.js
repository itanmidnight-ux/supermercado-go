const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db');
const loyaltyService = require('../services/loyalty.service');

// GET /api/loyalty/me — Info de fidelidad del usuario autenticado
router.get('/me', authMiddleware(), (req, res) => {
  try {
    const info = loyaltyService.getUserLoyaltyInfo(db, req.user.id);
    res.json({ data: info });
  } catch (err) {
    console.error('[LOYALTY] Error obteniendo info:', err.message);
    res.status(500).json({ error: 'Error obteniendo información de fidelidad' });
  }
});

// GET /api/loyalty/history — Historial de movimientos de puntos
router.get('/history', authMiddleware(), (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const result = loyaltyService.getPointsHistory(db, req.user.id, { page: parseInt(page), limit: parseInt(limit), type });
    res.json(result);
  } catch (err) {
    console.error('[LOYALTY] Error obteniendo historial:', err.message);
    res.status(500).json({ error: 'Error obteniendo historial de puntos' });
  }
});

// GET /api/loyalty/levels — Información de niveles
router.get('/levels', authMiddleware(), (req, res) => {
  try {
    const levels = loyaltyService.getLevelsInfo();
    res.json({ data: levels });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo niveles' });
  }
});

// POST /api/loyalty/redeem — Canjear puntos
router.post('/redeem', authMiddleware(['client']), (req, res) => {
  try {
    const { points_to_redeem } = req.body;
    if (!points_to_redeem || points_to_redeem < 100 || points_to_redeem % 100 !== 0) {
      return res.status(400).json({ error: 'Los puntos deben ser multiplos de 100 (minimo 100)' });
    }
    const result = loyaltyService.redeemPoints(db, {
      userId: req.user.id,
      pointsToRedeem: points_to_redeem,
    });
    res.json({ data: result });
  } catch (err) {
    console.error('[LOYALTY] Error canjeando puntos:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// GET /api/loyalty/dashboard — Dashboard admin de fidelización
router.get('/dashboard', authMiddleware(['admin']), (req, res) => {
  try {
    const { from, to } = req.query;
    const dashboard = loyaltyService.getLoyaltyDashboard(db, { from, to });
    res.json({ data: dashboard });
  } catch (err) {
    console.error('[LOYALTY] Error en dashboard:', err.message);
    res.status(500).json({ error: 'Error obteniendo dashboard de fidelidad' });
  }
});

// POST /api/loyalty/bonus — Bonificar puntos (admin)
router.post('/bonus', authMiddleware(['admin']), (req, res) => {
  try {
    const { user_id, points, reason } = req.body;
    if (!user_id || !points || points <= 0) {
      return res.status(400).json({ error: 'user_id y points son requeridos' });
    }
    const result = loyaltyService.bonusPoints(db, {
      userId: user_id,
      points: parseInt(points),
      reason: reason || 'Bonificacion admin',
      adminId: req.user.id,
    });
    res.json({ data: result });
  } catch (err) {
    console.error('[LOYALTY] Error bonificando:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/loyalty/check-benefits — Verificar beneficios antes de checkout
router.post('/check-benefits', authMiddleware(['client']), (req, res) => {
  try {
    const { subtotal } = req.body;
    const discount = loyaltyService.getLevelDiscount(db, req.user.id, subtotal || 0);
    const shipping = loyaltyService.getShippingBenefit(db, req.user.id, subtotal || 0);
    const info = loyaltyService.getUserLoyaltyInfo(db, req.user.id);
    res.json({ data: { discount, shipping, level: info.level, points_balance: info.points_balance } });
  } catch (err) {
    res.status(500).json({ error: 'Error verificando beneficios' });
  }
});

module.exports = router;
