// src/middleware/auth.js — Middleware de autenticación con JWT
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Middleware de autenticación por JWT.
 * Opcionalmente filtra por roles permitidos.
 * @param {string[]} roles - Roles permitidos (ej: ['admin', 'worker'])
 * @returns {Function} Middleware de Express
 */
function authMiddleware(roles) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      });
      req.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
      };

      if (roles && roles.length > 0 && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
      }

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'El token ha expirado' });
      }
      return res.status(401).json({ error: 'Token de autenticación inválido' });
    }
  };
}

/**
 * Middleware de autenticación por API Key (X-API-Key header).
 * Usado para integraciones externas y webhooks.
 */
function apiAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'API Key requerida' });
  }

  const crypto = require('crypto');
  const provided = Buffer.from(String(apiKey));
  const expected = Buffer.from(config.apiKey);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(403).json({ error: 'API Key inválida' });
  }

  next();
}

module.exports = { authMiddleware, apiAuth };
