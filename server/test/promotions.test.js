'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('promotions');
process.env.SEED_PASSWORD_JESUS = 'admin-test-pw';

const request = require('supertest');
const { initDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function adminToken() {
  const res = await request(app).post('/api/auth/token').send({ username: 'jesus', password: 'admin-test-pw' });
  return res.body.token;
}

describe('POST /api/estados — promociones con descuento', () => {
  test('discount_type=percent sin discount_value -> 400', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/estados').set('Authorization', `Bearer ${token}`)
      .field('discount_type', 'percent')
      .attach('media', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  test('discount_type=percent con valor fuera de rango -> 400', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/estados').set('Authorization', `Bearer ${token}`)
      .field('discount_type', 'percent').field('discount_value', '150')
      .attach('media', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  test('discount_type=percent válido -> 201 y queda en la respuesta pública', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/estados').set('Authorization', `Bearer ${token}`)
      .field('discount_type', 'percent').field('discount_value', '15')
      .field('product_id', '1').field('product_name', 'Producto X')
      .attach('media', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.estado.discount_type).toBe('percent');
    expect(Number(res.body.estado.discount_value)).toBe(15);

    const list = await request(app).get('/api/estados').set('Authorization', `Bearer ${token}`);
    const found = list.body.estados.find(e => e.id === res.body.estado.id);
    expect(found.discount_type).toBe('percent');
  });

  test('discount_type=2x1 no exige discount_value -> 201', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/estados').set('Authorization', `Bearer ${token}`)
      .field('discount_type', '2x1')
      .attach('media', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.estado.discount_type).toBe('2x1');
  });

  test('sin discount_type -> publicación normal (sin promoción)', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/estados').set('Authorization', `Bearer ${token}`)
      .attach('media', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(201);
    expect(res.body.estado.discount_type).toBeNull();
  });

  test('discount_type inválido -> 400', async () => {
    const token = await adminToken();
    const res = await request(app).post('/api/estados').set('Authorization', `Bearer ${token}`)
      .field('discount_type', 'sorpresa')
      .attach('media', Buffer.from([0xff, 0xd8, 0xff]), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });
});
