'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('checkout-delivery');
process.env.SEED_PASSWORD_JESUS = 'admin-test-pw';

const request = require('supertest');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function registerAndLogin(phone, email) {
  await request(app).post('/api/auth/register').send({
    phone, password: 'password123', display_name: 'Cliente Checkout', email, address: 'Calle 1',
  });
  const res = await request(app).post('/api/auth/token').send({ username: '57' + phone, password: 'password123' });
  return res.body.token;
}

async function makeProduct(name) {
  const admin = await request(app).post('/api/auth/token').send({ username: 'jesus', password: 'admin-test-pw' });
  const res = await request(app).post('/api/products').set('Authorization', `Bearer ${admin.body.token}`)
    .send({ name, price: 5000, aliases: [] });
  return res.body.id;
}

async function addToCart(token, productId, qty = 1) {
  return request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
    .send({ product_id: productId, quantity: qty });
}

describe('POST /api/cart/checkout — entrega y métodos de pago', () => {
  test('contra entrega sin ubicación GPS -> 400 (bloqueado por el servidor)', async () => {
    const token = await registerAndLogin('3005550001', 'checkout-a@example.com');
    const productId = await makeProduct('Producto Checkout A');
    await addToCart(token, productId);

    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${token}`)
      .send({ payment_method: 'contra_entrega', delivery_mode: 'address', delivery_address: 'Calle 123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ubicación en tiempo real/i);
  });

  test('contra entrega CON ubicación GPS -> se acepta y queda sin pagar', async () => {
    const token = await registerAndLogin('3005550002', 'checkout-b@example.com');
    const productId = await makeProduct('Producto Checkout B');
    await addToCart(token, productId, 2);

    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${token}`)
      .send({ payment_method: 'contra_entrega', delivery_mode: 'gps', delivery_lat: 7.8891, delivery_lng: -72.4967 });
    expect(res.status).toBe(201);

    const db = getDB();
    const { rows: ordersRows } = await db.query(
      `SELECT * FROM orders WHERE delivery_mode='gps' AND payment_method='contra_entrega' ORDER BY id DESC LIMIT 1`
    );
    expect(ordersRows[0].paid).toBe(0);
    expect(ordersRows[0].delivery_lat).toBeCloseTo(7.8891, 3);
    expect(ordersRows[0].delivery_lng).toBeCloseTo(-72.4967, 3);
  });

  test('nequi con referencia -> se acepta y queda pagado', async () => {
    const token = await registerAndLogin('3005550003', 'checkout-c@example.com');
    const productId = await makeProduct('Producto Checkout C');
    await addToCart(token, productId);

    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${token}`)
      .send({ payment_method: 'nequi', payment_reference: 'ABC123', delivery_mode: 'address', delivery_address: 'Cra 5 #10-20' });
    expect(res.status).toBe(201);

    const db = getDB();
    const { rows } = await db.query(
      `SELECT * FROM orders WHERE payment_method='nequi' AND payment_reference='ABC123' ORDER BY id DESC LIMIT 1`
    );
    expect(rows[0].paid).toBe(1);
    expect(rows[0].delivery_mode).toBe('address');
  });

  test('visa sin referencia -> 400', async () => {
    const token = await registerAndLogin('3005550004', 'checkout-d@example.com');
    const productId = await makeProduct('Producto Checkout D');
    await addToCart(token, productId);

    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${token}`)
      .send({ payment_method: 'visa', delivery_mode: 'address', delivery_address: 'Cra 5 #10-20' });
    expect(res.status).toBe(400);
  });

  test('delivery_mode invalido -> 400', async () => {
    const token = await registerAndLogin('3005550005', 'checkout-e@example.com');
    const productId = await makeProduct('Producto Checkout E');
    await addToCart(token, productId);

    const res = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${token}`)
      .send({ payment_method: 'contra_entrega', delivery_mode: 'teletransporte', delivery_lat: 1, delivery_lng: 1 });
    expect(res.status).toBe(400);
  });

  test('GET /api/payments/methods incluye visa disponible', async () => {
    const token = await registerAndLogin('3005550006', 'checkout-f@example.com');
    const res = await request(app).get('/api/payments/methods').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.visa.available).toBe(true);
    expect(res.body.contra_entrega).toBe(true);
  });
});
