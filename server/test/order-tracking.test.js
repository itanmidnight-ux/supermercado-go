'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('order-tracking');
process.env.SEED_PASSWORD_JESUS  = 'admin-test-pw';
process.env.SEED_PASSWORD_JOHANA = 'worker-test-pw';

const request = require('supertest');
const { initDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function workerToken() {
  const res = await request(app).post('/api/auth/token').send({ username: 'johana', password: 'worker-test-pw' });
  return res.body.token;
}

async function makeClientWithOrder(phone, email) {
  await request(app).post('/api/auth/register').send({
    phone, password: 'password123', display_name: 'Cliente Track', email, address: 'Calle 1',
  });
  const login = await request(app).post('/api/auth/token').send({ username: '57' + phone, password: 'password123' });
  const token = login.body.token;

  const admin = await request(app).post('/api/auth/token').send({ username: 'jesus', password: 'admin-test-pw' });
  const prod = await request(app).post('/api/products').set('Authorization', `Bearer ${admin.body.token}`)
    .send({ name: `Producto Track ${phone}`, price: 3000, aliases: [] });

  await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
    .send({ product_id: prod.body.id, quantity: 1 });
  const checkout = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${token}`)
    .send({ payment_method: 'nequi', payment_reference: 'REF1', delivery_mode: 'address', delivery_address: 'Cra 1' });

  const orders = await request(app).get('/api/orders/mine').set('Authorization', `Bearer ${token}`);
  const order = orders.body.find(o => o.product_name.includes(`Producto Track ${phone}`));
  return { token, orderId: order.id, checkoutBody: checkout.body };
}

describe('GET /api/orders/:id/track', () => {
  test('pedido pendiente (sin reclamar) -> tracking_available false, mensaje de espera', async () => {
    const { token, orderId } = await makeClientWithOrder('3008880001', 'track-a@example.com');
    const res = await request(app).get(`/api/orders/${orderId}/track`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tracking_available).toBe(false);
    expect(res.body.message).toMatch(/aún no ha sido enviado/i);
    expect(res.body.lat).toBeUndefined();
  });

  test('pedido reclamado pero NO en camino -> sigue sin exponer ubicación (privacidad)', async () => {
    const { token, orderId } = await makeClientWithOrder('3008880002', 'track-b@example.com');
    const wToken = await workerToken();
    await request(app).put(`/api/orders/${orderId}/claim`).set('Authorization', `Bearer ${wToken}`);
    // El trabajador reporta su ubicación (va camino a recoger el pedido) --
    // pero como el pedido no está "en_camino" todavía, no debe filtrarse.
    await request(app).post('/api/staff-locations').set('Authorization', `Bearer ${wToken}`)
      .send({ lat: 7.89, lng: -72.49 });

    const res = await request(app).get(`/api/orders/${orderId}/track`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tracking_available).toBe(false);
    expect(res.body.lat).toBeUndefined();
  });

  test('pedido en_camino con ubicación reportada -> tracking_available true con lat/lng', async () => {
    const { token, orderId } = await makeClientWithOrder('3008880003', 'track-c@example.com');
    const wToken = await workerToken();
    await request(app).put(`/api/orders/${orderId}/claim`).set('Authorization', `Bearer ${wToken}`);
    await request(app).post('/api/staff-locations').set('Authorization', `Bearer ${wToken}`)
      .send({ lat: 7.891, lng: -72.497 });
    await request(app).put(`/api/orders/${orderId}/en_camino`).set('Authorization', `Bearer ${wToken}`);

    const res = await request(app).get(`/api/orders/${orderId}/track`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tracking_available).toBe(true);
    expect(res.body.lat).toBeCloseTo(7.891, 3);
    expect(res.body.lng).toBeCloseTo(-72.497, 3);
    expect(res.body.worker_name).toBeTruthy();
  });

  test('un cliente no puede rastrear el pedido de otro cliente -> 404', async () => {
    const { orderId } = await makeClientWithOrder('3008880004', 'track-d@example.com');
    const { token: otherToken } = await makeClientWithOrder('3008880005', 'track-e@example.com');
    const res = await request(app).get(`/api/orders/${orderId}/track`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
