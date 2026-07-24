'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('password-reset');
process.env.SEED_PASSWORD_JESUS = 'admin-test-pw';

const request = require('supertest');
const crypto  = require('crypto');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function registerClient(phone, email) {
  return request(app).post('/api/auth/register').send({
    phone, password: 'password123', display_name: 'Cliente Reset',
    email, address: 'Calle de prueba 123',
  });
}

describe('POST /api/auth/forgot-password', () => {
  test('correo invalido -> 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'no-es-correo' });
    expect(res.status).toBe(400);
  });

  test('respuesta generica igual exista o no la cuenta (anti-enumeracion)', async () => {
    const r1 = await request(app).post('/api/auth/forgot-password').send({ email: 'no-registrado-xyz@example.com' });
    expect(r1.status).toBe(200);
    expect(r1.body.message).toMatch(/Si el correo está registrado/i);

    await registerClient('3003330001', 'reset-a@example.com');
    const r2 = await request(app).post('/api/auth/forgot-password').send({ email: 'reset-a@example.com' });
    expect(r2.status).toBe(200);
    expect(r2.body.message).toBe(r1.body.message);
  });

  test('crea un codigo hasheado (nunca en claro) con vencimiento a 5 minutos', async () => {
    await registerClient('3003330002', 'reset-b@example.com');
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset-b@example.com' });

    const db = getDB();
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE email = $1', ['reset-b@example.com']);
    const { rows } = await db.query('SELECT * FROM password_resets WHERE user_id = $1', [userRows[0].id]);
    expect(rows.length).toBe(1);
    expect(rows[0].code_hash).toHaveLength(64); // sha256 hex
    expect(rows[0].used).toBe(0);
    const ttlMinutes = (new Date(rows[0].expires_at) - Date.now()) / 60000;
    expect(ttlMinutes).toBeGreaterThan(4);
    expect(ttlMinutes).toBeLessThanOrEqual(5);
  });

  test('pedir un codigo nuevo invalida el anterior (solo uno activo por usuario)', async () => {
    await registerClient('3003330003', 'reset-c@example.com');
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset-c@example.com' });
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset-c@example.com' });

    const db = getDB();
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE email = $1', ['reset-c@example.com']);
    const { rows } = await db.query('SELECT * FROM password_resets WHERE user_id = $1', [userRows[0].id]);
    expect(rows.length).toBe(1);
  });
});

describe('POST /api/auth/reset-password', () => {
  test('codigo correcto y vigente -> cambia la contraseña y el codigo queda usado', async () => {
    await registerClient('3003330010', 'reset-ok@example.com');
    const db = getDB();
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE email = $1', ['reset-ok@example.com']);
    await db.query(
      'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
      [userRows[0].id, hashCode('111111'), new Date(Date.now() + 5 * 60 * 1000).toISOString()]
    );

    const res = await request(app).post('/api/auth/reset-password')
      .send({ email: 'reset-ok@example.com', code: '111111', new_password: 'nuevaClave123' });
    expect(res.status).toBe(200);

    const loginOld = await request(app).post('/api/auth/token').send({ username: 'reset-ok@example.com', password: 'password123' });
    expect(loginOld.status).toBe(401);
    const loginNew = await request(app).post('/api/auth/token').send({ username: 'reset-ok@example.com', password: 'nuevaClave123' });
    expect(loginNew.status).toBe(200);

    const { rows } = await db.query('SELECT used FROM password_resets WHERE user_id = $1', [userRows[0].id]);
    expect(rows[0].used).toBe(1);
  });

  test('el mismo codigo no se puede reutilizar', async () => {
    await registerClient('3003330011', 'reset-reuse@example.com');
    const db = getDB();
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE email = $1', ['reset-reuse@example.com']);
    await db.query(
      'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
      [userRows[0].id, hashCode('222222'), new Date(Date.now() + 5 * 60 * 1000).toISOString()]
    );
    const first = await request(app).post('/api/auth/reset-password')
      .send({ email: 'reset-reuse@example.com', code: '222222', new_password: 'primeraClave1' });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/auth/reset-password')
      .send({ email: 'reset-reuse@example.com', code: '222222', new_password: 'segundaClave2' });
    expect(second.status).toBe(400);
  });

  test('codigo vencido -> 400', async () => {
    await registerClient('3003330012', 'reset-expired@example.com');
    const db = getDB();
    const { rows: userRows } = await db.query('SELECT id FROM users WHERE email = $1', ['reset-expired@example.com']);
    await db.query(
      'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
      [userRows[0].id, hashCode('333333'), new Date(Date.now() - 1000).toISOString()]
    );
    const res = await request(app).post('/api/auth/reset-password')
      .send({ email: 'reset-expired@example.com', code: '333333', new_password: 'claveValida12' });
    expect(res.status).toBe(400);
  });

  test('contraseña muy corta -> 400 sin tocar la base', async () => {
    const res = await request(app).post('/api/auth/reset-password')
      .send({ email: 'reset-ok@example.com', code: '111111', new_password: '123' });
    expect(res.status).toBe(400);
  });
});
