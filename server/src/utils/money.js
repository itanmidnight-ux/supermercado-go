// src/utils/money.js — Utilidades para trabajar con pesos colombianos (COP)
// El peso colombiano NO tiene decimales, todos los valores son enteros.

/**
 * Formatea un valor en COP como cadena legible.
 * Ejemplo: 15000 → '$15.000'
 * @param {number} amount - Monto en pesos colombianos
 * @returns {string} Cadena formateada
 */
function formatCOP(amount) {
  const n = Math.round(amount);
  return '$' + n.toLocaleString('es-CO');
}

/**
 * Redondea un valor al entero más cercano (COP no usa decimales).
 * @param {number} amount - Monto a redondear
 * @returns {number} Valor redondeado
 */
function roundCOP(amount) {
  return Math.round(amount);
}

module.exports = { formatCOP, roundCOP };
