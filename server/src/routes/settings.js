// src/routes/settings.js — Rutas de configuración del sistema
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');
const config = require('../config');

const router = Router();

/**
 * GET /api/settings — Obtener todas las configuraciones [admin]
 */
router.get('/', authMiddleware(['admin']), (req, res) => {
  const settings = db.prepare('SELECT key, value, updated_at FROM settings ORDER BY key').all();

  // Convertir a objeto
  const obj = {};
  for (const s of settings) {
    obj[s.key] = s.value;
  }

  res.json({ data: obj });
});

/**
 * PUT /api/settings — Actualizar configuraciones [admin]
 */
router.put('/', authMiddleware(['admin']), (req, res) => {
  const entries = req.body;
  if (!entries || typeof entries !== 'object') {
    return res.status(400).json({ error: 'Se requiere un objeto con las configuraciones a actualizar' });
  }

  const now = nowBogota();
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);

  const batch = db.transaction((items) => {
    for (const [key, value] of Object.entries(items)) {
      upsert.run(key, String(value), now);
    }
  });

  batch(entries);

  res.json({ message: 'Configuraciones actualizadas exitosamente' });
});

/**
 * GET /api/settings/public — Información pública del negocio + contenido personalizable
 * Público: no requiere autenticación
 */
router.get('/public', (req, res) => {
  // Obtener settings personalizados de la tabla
  const allSettings = db.prepare('SELECT key, value FROM settings').all();
  const custom = {};
  for (const s of allSettings) { custom[s.key] = s.value; }

  res.json({
    data: {
      business_name: config.business.name,
      business_phone: config.business.phone,
      business_email: config.business.email,
      business_address: config.business.address,
      business_city: config.business.city,
      business_department: config.business.department,
      business_hours: config.business.hours,
      business_tagline: config.business.tagline,
      brand_primary: config.brand.primary,
      brand_accent: config.brand.accent,
      brand_dark: config.brand.dark,
      delivery_fee: config.delivery.feeDefault,
      free_delivery_min: config.delivery.freeMin,
      operating_zone: config.delivery.zone,
      whatsapp_enabled: config.whatsapp.enabled,
      // Contenido personalizable
      delivery_zones: custom.delivery_zones || '["Cúcuta"]',
      delivery_info_text: custom.delivery_info_text || 'Realizamos entregas en Cúcuta y zonas aledañas.',
      how_to_buy_text: custom.how_to_buy_text || '',
      app_welcome_message: custom.app_welcome_message || '',
      help_faq: custom.help_faq || '',
    },
  });
});

module.exports = router;
