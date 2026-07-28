'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('products-public-catalog');
process.env.SEED_PASSWORD_ADMIN = 'admin-test-pw';

const request = require('supertest');
const { initDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function adminToken() {
  const res = await request(app).post('/api/auth/token').send({ username: 'admin', password: 'admin-test-pw' });
  return res.body.token;
}

describe('GET /api/products/public -- catálogo para modo invitado en el sitio web', () => {
  test('sin Authorization devuelve el catálogo (no 401)', async () => {
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Público A', price: 2500, aliases: [], stock: 10, sku: 'SKU-SECRETO' });

    const res = await request(app).get('/api/products/public');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find(p => p.name === 'Producto Público A');
    expect(found).toBeTruthy();
  });

  test('no expone stock ni sku (detalle interno de inventario)', async () => {
    const res = await request(app).get('/api/products/public');
    const found = res.body.find(p => p.name === 'Producto Público A');
    expect(found.stock).toBeUndefined();
    expect(found.sku).toBeUndefined();
  });

  test('no incluye productos no disponibles', async () => {
    const token = await adminToken();
    const create = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Oculto', price: 900, aliases: [] });
    await request(app).put(`/api/products/${create.body.id}`).set('Authorization', `Bearer ${token}`)
      .send({ available: 0 });

    const res = await request(app).get('/api/products/public');
    expect(res.body.some(p => p.name === 'Producto Oculto')).toBe(false);
  });
});

describe('GET /api/products/images/:filename -- accesible sin auth (fotos de producto)', () => {
  test('sin Authorization no responde 401 (404 si el archivo no existe, no auth error)', async () => {
    const res = await request(app).get('/api/products/images/no-existe-este-archivo.jpg');
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(401);
  });
});
