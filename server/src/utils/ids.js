// src/utils/ids.js — Generador de IDs únicos usando UUID v4
const { v4: uuidv4 } = require('uuid');

/**
 * Genera un identificador único (UUID v4 sin guiones para compatibilidad).
 * @returns {string} UUID v4
 */
function generateId() {
  return uuidv4();
}

module.exports = { generateId };
