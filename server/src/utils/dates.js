// src/utils/dates.js — Utilidades de fecha en zona horaria de Bogotá (America/Bogota)

/**
 * Obtiene la fecha y hora actual en la zona horaria de Bogotá.
 * @returns {string} Fecha y hora en formato 'YYYY-MM-DD HH:MM:SS'
 */
function nowBogota() {
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const y = bogota.getFullYear();
  const m = String(bogota.getMonth() + 1).padStart(2, '0');
  const d = String(bogota.getDate()).padStart(2, '0');
  const hh = String(bogota.getHours()).padStart(2, '0');
  const mm = String(bogota.getMinutes()).padStart(2, '0');
  const ss = String(bogota.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

/**
 * Formatea una cadena de fecha para mostrar al usuario.
 * @param {string} dateStr - Cadena de fecha (varios formatos aceptados)
 * @returns {string} Fecha legible en español
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z'));
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

module.exports = { nowBogota, formatDate };
