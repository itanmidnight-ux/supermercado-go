// src/db/index.js — Inicialización y helpers para la base de datos SQLite
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Asegurar que el directorio de datos existe
const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true, mode: 0o750 });
}

const dbPath = path.resolve(config.dbPath);
const db = new Database(dbPath);

// Configuración pragma para rendimiento y seguridad
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('secure_delete = ON');      // Sobrescribe datos eliminados
db.pragma('synchronous = NORMAL');    // Balance entre integridad y rendimiento

// Asegurar permisos del archivo de BD (solo propietario puede leer/escribir)
try {
  fs.chmodSync(dbPath, 0o640);
} catch {
  // Ignorar si no se pueden cambiar permisos (e.g., en desarrollo)
}

/**
 * Obtiene la instancia de la base de datos.
 * @returns {Database} Instancia de better-sqlite3
 */
function getDb() {
  return db;
}

/**
 * Ejecuta una función dentro de una transacción de base de datos.
 * Si la función lanza un error, se hace rollback automáticamente.
 * @param {Function} fn - Función que recibe db y ejecuta operaciones
 * @returns {*} Resultado de la función
 */
function runInTransaction(fn) {
  return db.transaction(fn)(db);
}

/**
 * Crea un backup de la base de datos.
 * @returns {string} Ruta del archivo de backup
 */
function backupDb() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dbDir, `backup-${timestamp}.db`);
  db.backup(backupPath);
  return backupPath;
}

module.exports = { db, getDb, runInTransaction, backupDb };
