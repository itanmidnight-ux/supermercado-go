// src/utils/passwords.js — Hashing de contraseñas con bcrypt (con soporte legacy SHA-256)
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Factor de costo: 12 = ~250ms por hash (balance seguridad/rendimiento)
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

// Prefijo que usamos para distinguir hashes bcrypt de los legacy SHA-256
const BCRYPT_PREFIX = '$2';

function isBcryptHash(hash) {
  return typeof hash === 'string' && hash.startsWith(BCRYPT_PREFIX);
}

/**
 * Hashea una contraseña en texto plano usando bcrypt.
 * @param {string} plain - Contraseña en texto plano
 * @returns {Promise<string>} Hash bcrypt
 */
async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano contra un hash almacenado.
 * Soporta hashes bcrypt (modernos) y SHA-256 (legacy).
 *
 * Si el hash almacenado es legacy y la contraseña coincide, lo migra
 * automáticamente a bcrypt y devuelve { match: true, migrated: true, newHash }.
 *
 * @param {string} plain - Contraseña en texto plano
 * @param {string} storedHash - Hash almacenado en la DB
 * @returns {Promise<{match: boolean, migrated?: boolean, newHash?: string}>}
 */
async function verifyPassword(plain, storedHash) {
  if (!storedHash) return { match: false };

  if (isBcryptHash(storedHash)) {
    const match = await bcrypt.compare(plain, storedHash);
    return { match };
  }

  // Hash legacy SHA-256 (sin salt) — se valida y se migra automáticamente.
  const legacyHash = crypto.createHash('sha256').update(plain).digest('hex');
  if (legacyHash === storedHash) {
    const newHash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
    return { match: true, migrated: true, newHash };
  }

  return { match: false };
}

module.exports = {
  hashPassword,
  verifyPassword,
  isBcryptHash,
};
