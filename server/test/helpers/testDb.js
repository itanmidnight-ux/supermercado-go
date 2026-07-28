'use strict';
// Helper compartido para tests -- cada archivo de test corre en su propio
// schema de Postgres (aislamiento equivalente al "1 archivo SQLite temporal
// por test" de la era anterior), sin pisarse entre si y sin necesitar una
// base de datos ni permisos de superusuario aparte -- CREATE SCHEMA alcanza
// con los permisos que ya tiene el rol dueño de la base (ver
// deploy-linux.sh install_postgresql).
//
// Uso (reemplaza el bloque viejo de `DB_PATH = tmp file` al inicio de cada
// test):
//   const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
//   setupTestEnv('nombre-del-test');
//   ...
//   beforeAll(async () => { await initDB(); });
//   afterAll(async () => { await teardownTestSchema(); });

function uniqueSchemaName(prefix) {
  const safePrefix = String(prefix || 'test').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  return `test_${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Fija las env vars que necesita database.js -- respeta cualquier valor ya
// definido (ej. exportado a mano contra un Postgres real) y solo rellena
// defaults razonables para correr localmente.
const ENV_BACKUP = {};

// Guarda vars de entorno relevantes antes de que un test suite las modifique
function backupEnv() {
  for (const k of ['PG_SCHEMA', 'JWT_SECRET', 'API_KEY', 'SEED_PASSWORD_ADMIN', 'SEED_PASSWORD_JESUS', 'SEED_PASSWORD_JOHANA', 'SEED_PASSWORD_FELIPE', 'SEED_PASSWORD_FABIAN', 'NODE_ENV', 'PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD', 'BOT_ENABLED']) {
    if (k in process.env) ENV_BACKUP[k] = process.env[k];
    else delete ENV_BACKUP[k];
  }
}

// Restaura las vars guardadas y limpia las que no estaban antes
function restoreEnv() {
  for (const k of Object.keys(ENV_BACKUP)) {
    if (ENV_BACKUP[k] !== undefined) process.env[k] = ENV_BACKUP[k];
  }
  for (const k of ['PG_SCHEMA']) {
    if (!(k in ENV_BACKUP)) delete process.env[k];
  }
}

function setupTestEnv(prefix) {
  backupEnv();
  process.env.NODE_ENV    = 'test';
  process.env.PG_HOST     = process.env.PG_HOST     || '127.0.0.1';
  process.env.PG_PORT     = process.env.PG_PORT     || '5433';
  process.env.PG_DATABASE = process.env.PG_DATABASE || 'supermercado';
  process.env.PG_USER     = process.env.PG_USER     || 'pedidosbot';
  process.env.PG_PASSWORD = process.env.PG_PASSWORD || 'pedidosbot';
  process.env.JWT_SECRET  = process.env.JWT_SECRET  || 'test-secret';
  process.env.API_KEY     = process.env.API_KEY     || 'test-api-key';
  process.env.PG_SCHEMA   = uniqueSchemaName(prefix);
  return process.env.PG_SCHEMA;
}

async function teardownTestSchema() {
  const { getDB, closeDB } = require('../../src/db/database');
  const schema = process.env.PG_SCHEMA;
  try {
    if (schema) await getDB().query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } catch (_) { /* pool ya pudo haberse cerrado -- no es fatal para el test */ }
  await closeDB();
  restoreEnv();
}

module.exports = { setupTestEnv, teardownTestSchema, uniqueSchemaName };
