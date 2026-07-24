'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('client-detail');
process.env.SEED_PASSWORD_JESUS = 'admin-test-pw';

const request = require('supertest');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function adminToken() {
  const res = await request(app).post('/api/auth/token').send({ username: 'jesus', password: 'admin-test-pw' });
  return res.body.token;
}

describe('GET /api/users/clients — ficha de detalle para el panel admin', () => {
  test('incluye teléfono, correo y order_count real', async () => {
    const token = await adminToken();
    await request(app).post('/api/auth/register').send({
      phone: '3007771234', password: 'password123', display_name: 'Cliente Detalle', email: 'detalle@example.com', address: 'Calle 1',
    });
    const login = await request(app).post('/api/auth/token').send({ username: '573007771234', password: 'password123' });

    const prod = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Detalle Cliente', price: 1500, aliases: [] });
    await request(app).post('/api/cart').set('Authorization', `Bearer ${login.body.token}`)
      .send({ product_id: prod.body.id, quantity: 1 });
    await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${login.body.token}`)
      .send({ payment_method: 'nequi', payment_reference: 'R1', delivery_mode: 'address', delivery_address: 'Cra 1' });

    const res = await request(app).get('/api/users/clients').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.clients.find(c => c.phone === '573007771234');
    expect(found).toBeTruthy();
    expect(found.email).toBe('detalle@example.com');
    expect(found.display_name).toBe('Cliente Detalle');
    expect(found.order_count).toBe(1);
  });

  test('requiere admin', async () => {
    const res = await request(app).get('/api/users/clients');
    expect(res.status).toBe(401);
  });
});
