// src/utils/mailer.js — Servicio de envío de correos con Nodemailer
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = config.smtp.host;
  const smtpPort = config.smtp.port;
  const smtpUser = config.smtp.user;
  const smtpPass = config.smtp.pass;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[MAILER] SMTP no configurado. Los correos no se enviarán.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[MAILER] Correo NO enviado (SMTP no configurado): ${subject} → ${to}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const info = await transport.sendMail({
      from: `"${config.business.name}" <${config.smtp.user}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`[MAILER] Correo enviado: ${info.messageId} → ${to}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[MAILER] Error enviando correo a ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

async function verifyConnection() {
  const transport = getTransporter();
  if (!transport) return false;
  try {
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}

// ── Templates de correos ──────────────────────────────────────────────

function passwordResetEmail(userName, resetCode, businessName) {
  const subject = `${businessName} — Recuperación de contraseña`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#00B860,#00964F);padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">${businessName}</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Recuperación de contraseña</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#333;font-size:15px;line-height:1.6;">Hola <strong>${userName}</strong>,</p>
          <p style="color:#555;font-size:14px;line-height:1.6;">Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
          <div style="text-align:center;margin:24px 0;">
            <div style="display:inline-block;background:#f0fdf4;border:2px dashed #00B860;border-radius:12px;padding:16px 32px;">
              <span style="font-size:32px;font-weight:800;color:#00B860;letter-spacing:8px;">${resetCode}</span>
            </div>
          </div>
          <p style="color:#999;font-size:12px;text-align:center;">Este código expira en 30 minutos.</p>
          <p style="color:#999;font-size:12px;text-align:center;">Si no solicitaste este cambio, ignora este mensaje.</p>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
          <p style="color:#aaa;font-size:11px;margin:0;">© ${new Date().getFullYear()} ${businessName} — Cúcuta, Colombia</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return { subject, html };
}

function passwordResetConfirm(userName, businessName) {
  const subject = `${businessName} — Contraseña actualizada`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
      <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#00B860,#00964F);padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">${businessName}</h1>
        </div>
        <div style="padding:32px;text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">✅</div>
          <h2 style="color:#333;margin:0 0 12px;">Contraseña actualizada</h2>
          <p style="color:#555;font-size:14px;line-height:1.6;">Hola <strong>${userName}</strong>, tu contraseña ha sido cambiada exitosamente.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return { subject, html };
}

module.exports = { sendMail, verifyConnection, passwordResetEmail, passwordResetConfirm };
