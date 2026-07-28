'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('product-low-stock');
process.env.SEED_PASSWORD_ADMIN = 'admin-test-pw';

const request = require('supertest');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function loginAdmin() {
  const res = await request(app).post('/api/auth/token').send({ username: 'admin', password: 'admin-test-pw' });
  return res.body.token;
}

async function lastAlertFor(db, phone) {
  const { rows } = await db.query(`
    SELECT * FROM messages WHERE phone=$1 AND direction='outbound' AND type='security_alert'
    ORDER BY id DESC LIMIT 1
  `, [phone]);
  return rows[0];
}

describe('low_stock_threshold editable', () => {
  let token;
  beforeAll(async () => { token = await loginAdmin(); });

  test('POST /api/products acepta low_stock_threshold', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Arroz 500g', price: 3500, stock: 20, low_stock_threshold: 5 });
    expect(res.status).toBe(200);
    expect(res.body.low_stock_threshold).toBe(5);
  });

  test('PUT /api/products/:id actualiza low_stock_threshold', async () => {
    const created = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Aceite 1L', price: 8000, stock: 10, low_stock_threshold: 2 });
    const res = await request(app).put(`/api/products/${created.body.id}`).set('Authorization', `Bearer ${token}`)
      .send({ low_stock_threshold: 3 });
    expect(res.status).toBe(200);
    expect(res.body.low_stock_threshold).toBe(3);
  });

  test('low_stock_threshold negativo es rechazado', async () => {
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Prod Invalido', price: 1000, low_stock_threshold: -1 });
    expect(res.status).toBe(400);
  });

  test('cruzar el umbral hacia abajo encola alerta WhatsApp al admin', async () => {
    const db = getDB();
    await db.query(`UPDATE users SET phone='573001112233' WHERE username='admin'`);

    const created = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Leche 1L', price: 4000, stock: 10, low_stock_threshold: 5 });

    const res = await request(app).put(`/api/products/${created.body.id}`).set('Authorization', `Bearer ${token}`)
      .send({ stock: 3 });
    expect(res.status).toBe(200);

    const msg = await lastAlertFor(db, '573001112233');
    expect(msg).toBeTruthy();
    expect(msg.content).toMatch(/leche 1l/i);
    expect(msg.content).toMatch(/3/);
  });
});
