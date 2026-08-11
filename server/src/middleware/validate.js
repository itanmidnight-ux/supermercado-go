// src/middleware/validate.js — Middleware de validación de cuerpo de petición
// Validación ligera sin dependencias externas

/**
 * Valida que el cuerpo de la petición cumpla con el esquema proporcionado.
 * @param {Object} schema - Esquema de validación
 *   - required: string[] — campos obligatorios
 *   - optional: string[] — campos opcionales permitidos
 *   - rules: Object<string, (val) => string|null> — reglas personalizadas por campo
 *   - allowExtra: boolean — si permite campos no definidos (default false)
 * @returns {Function} Middleware de Express
 */
function validateBody(schema) {
  return (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) {
      return res.status(400).json({ error: 'El cuerpo de la petición debe ser un objeto JSON' });
    }

    const errors = [];
    const { required = [], optional = [], rules = {}, allowExtra = false } = schema;
    const allowedFields = [...required, ...optional];

    for (const key of Object.keys(body)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) {
        errors.push(`El campo "${key}" no es válido`);
      }
    }

    // Verificar campos obligatorios
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`El campo "${field}" es obligatorio`);
      }
    }

    // Verificar campos no permitidos
    if (!allowExtra) {
      for (const key of Object.keys(body)) {
        if (!allowedFields.includes(key)) {
          errors.push(`El campo "${key}" no es reconocido`);
        }
      }
    }

    // Aplicar reglas personalizadas
    for (const [field, ruleFn] of Object.entries(rules)) {
      if (body[field] !== undefined && body[field] !== null) {
        const error = ruleFn(body[field]);
        if (error) {
          errors.push(error);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('. ') });
    }

    next();
  };
}

module.exports = { validateBody };
