'use strict';

// Mismo criterio de normalizacion de celular usado en todo el proyecto
// (waBot.js, order_card.dart, message.dart): 10 digitos que empiezan en
// 3 -> se antepone 57. Cualquier otra cosa se rechaza -- no es celular
// colombiano valido.
function normalizeAndValidatePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return '57' + digits;
  if (digits.length === 12 && digits.startsWith('573')) return digits;
  return null;
}

module.exports = { normalizeAndValidatePhone };
