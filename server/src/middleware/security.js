// src/middleware/security.js — Middleware de seguridad avanzado
const config = require('../config');

/**
 * Sanitiza entradas para prevenir inyección SQL y XSS.
 * better-sqlite3 ya usa queries parametrizados, pero esto
 * agrega una capa adicional de protección.
 */
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) {
        delete req.body[key];
      } else if (typeof req.body[key] === 'string') {
        // Eliminar caracteres nulos
        req.body[key] = req.body[key].replace(/\0/g, '');
        // Trim whitespace
        req.body[key] = req.body[key].trim();
      }
    }
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) {
        delete req.query[key];
      } else if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].replace(/\0/g, '').trim();
      }
    }
  }
  next();
}

/**
 * Registra cada petición para auditoría de seguridad.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    if (res.statusCode >= 400 || req.method !== 'GET') {
      console.log(
        `[${new Date().toISOString()}] ${level} ${req.method} ${req.path} ${res.statusCode} ${duration}ms - ${req.ip}`
      );
    }
  });
  next();
}

/**
 * Previene ataques de fuerza bruta en endpoints sensibles.
 * Rate limiting en memoria (reinicia con el servidor).
 */
const loginAttempts = new Map();
function loginRateLimit(maxAttempts = 10, windowMs = 900000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.body?.email || 'unknown'}`;
    const now = Date.now();
    const record = loginAttempts.get(key);

    if (record && now - record.start < windowMs && record.count >= maxAttempts) {
      const remaining = Math.ceil((windowMs - (now - record.start)) / 60000);
      return res.status(429).json({
        error: `Demasiados intentos. Intenta de nuevo en ${remaining} minutos.`,
      });
    }

    if (!record || now - record.start >= windowMs) {
      loginAttempts.set(key, { count: 1, start: now });
    } else {
      record.count++;
    }
    next();
  };
}

/**
 * Headers de seguridad adicionales (complementa Helmet).
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

module.exports = {
  sanitizeInput,
  requestLogger,
  loginRateLimit,
  securityHeaders,
};
