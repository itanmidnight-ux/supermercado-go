'use strict';
const nodemailer = require('nodemailer');
const { getDB } = require('../db/database');
const { encryptText, decryptText } = require('../utils/botCrypto');

function nowIso() {
  return new Date().toISOString();
}

async function getConfig() {
  const { rows } = await getDB().query('SELECT * FROM email_config WHERE id = 1');
  return rows[0] || null;
}

function buildTransport(email, appPassword, host, port) {
  const finalPort = port || 465;
  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: finalPort,
    secure: finalPort === 465,
    auth: { user: email, pass: appPassword },
  });
}

async function getStatus() {
  const cfg = await getConfig();
  if (!cfg || !cfg.email) return { connected: false, status: 'disconnected' };
  return {
    connected:    cfg.status === 'connected',
    status:       cfg.status,
    email:        cfg.email,
    connected_at: cfg.connected_at,
  };
}

// Conecta/reemplaza la cuenta emisora -- igual criterio que Nequi/WhatsApp:
// se verifica contra el SMTP real antes de guardar nada.
async function configure(email, appPassword, host, port) {
  if (!email || !appPassword) throw new Error('Correo y contraseña de aplicación requeridos');
  const transport = buildTransport(email, appPassword, host, port);
  await transport.verify();

  const db = getDB();
  await db.query(
    `UPDATE email_config SET email = $1, app_password_encrypted = $2, smtp_host = $3, smtp_port = $4,
     status = 'connected', connected_at = $5, updated_at = $5 WHERE id = 1`,
    [String(email).trim().toLowerCase(), encryptText(appPassword), host || 'smtp.gmail.com', port || 465, nowIso()]
  );
  return { ok: true, email: String(email).trim().toLowerCase() };
}

async function disconnect() {
  await getDB().query(
    `UPDATE email_config SET email = NULL, app_password_encrypted = NULL, status = 'disconnected',
     connected_at = NULL, updated_at = $1 WHERE id = 1`,
    [nowIso()]
  );
}

async function sendMail({ to, subject, html, text }) {
  const cfg = await getConfig();
  if (!cfg || !cfg.email || !cfg.app_password_encrypted || cfg.status !== 'connected') {
    throw new Error('No hay una cuenta de correo conectada en el panel de control');
  }
  const appPassword = decryptText(cfg.app_password_encrypted);
  const transport = buildTransport(cfg.email, appPassword, cfg.smtp_host, cfg.smtp_port);
  return transport.sendMail({ from: `"Supermercado GO" <${cfg.email}>`, to, subject, html, text });
}

module.exports = { getStatus, configure, disconnect, sendMail };
