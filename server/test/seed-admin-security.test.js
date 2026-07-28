'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('seed-admin-security');
delete process.env.SEED_PASSWORD_ADMIN;

const bcrypt = require('bcrypt');
const { initDB, getDB } = require('../src/db/database');

afterAll(async () => {
  await teardownTestSchema();
});

test('el admin NUNCA se crea con password literal "admin" cuando falta SEED_PASSWORD_ADMIN', async () => {
  await initDB();
  const { rows } = await getDB().query('SELECT password_hash FROM users WHERE username = $1', ['admin']);
  const isDefaultWeak = await bcrypt.compare('admin', rows[0].password_hash);
  expect(isDefaultWeak).toBe(false);
});
