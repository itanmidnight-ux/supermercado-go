'use strict';
const express = require('express');
const router  = express.Router();
const { adminAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');

// GET /api/email/status — estado de la cuenta emisora (admin, desde dashboard.py)
router.get('/status', adminAuth, async (req, res, next) => {
  try { res.json(await emailService.getStatus()); } catch (e) { next(e); }
});

// POST /api/email/configure — { email, app_password, smtp_host?, smtp_port? }
router.post('/configure', adminAuth, async (req, res) => {
  const { email, app_password, smtp_host, smtp_port } = req.body || {};
  try {
    const result = await emailService.configure(
      email, app_password, smtp_host, smtp_port ? Number(smtp_port) : undefined
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/email/disconnect
router.post('/disconnect', adminAuth, async (req, res) => {
  try { await emailService.disconnect(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/email/test — envía un correo de prueba a la propia cuenta conectada
router.post('/test', adminAuth, async (req, res) => {
  try {
    const status = await emailService.getStatus();
    if (!status.connected) return res.status(400).json({ error: 'No hay cuenta de correo conectada' });
    await emailService.sendMail({
      to: status.email,
      subject: 'Correo de prueba — Supermercado GO',
      html: '<p>La conexión de correo del panel de control está funcionando correctamente.</p>',
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
