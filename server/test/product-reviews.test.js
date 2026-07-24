'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('product-reviews');
process.env.SEED_PASSWORD_JESUS = 'admin-test-pw';

const request = require('supertest');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function loginClient(phone, email) {
  await request(app).post('/api/auth/register').send({
    phone, password: 'password123', display_name: 'Cliente Reseña', email, address: 'Calle 1',
  });
  const res = await request(app).post('/api/auth/token').send({ username: '57' + phone, password: 'password123' });
  return res.body.token;
}

async function makeProduct(name) {
  const admin = await request(app).post('/api/auth/token').send({ username: 'jesus', password: 'admin-test-pw' });
  const res = await request(app).post('/api/products').set('Authorization', `Bearer ${admin.body.token}`)
    .send({ name, price: 1000, aliases: [] });
  return res.body.id;
}

describe('Reseñas de producto', () => {
  test('solo se muestran reseñas de 3 a 5 estrellas -- las de 1-2 quedan ocultas', async () => {
    const productId = await makeProduct('Producto Reseñable A');
    const tokenGood = await loginClient('3004440001', 'review-good@example.com');
    const tokenBad  = await loginClient('3004440002', 'review-bad@example.com');

    await request(app).post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${tokenGood}`).send({ rating: 5, comment: 'Excelente producto' });
    await request(app).post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${tokenBad}`).send({ rating: 1, comment: 'Muy malo' });

    const res = await request(app).get(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${tokenGood}`);
    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.reviews[0].rating).toBe(5);
    expect(res.body.reviews.some(r => r.rating < 3)).toBe(false);
    expect(res.body.count).toBe(1);
    expect(res.body.average).toBe(5);
  });

  test('rating fuera de 1-5 -> 400', async () => {
    const productId = await makeProduct('Producto Reseñable B');
    const token = await loginClient('3004440003', 'review-invalid@example.com');
    const res = await request(app).post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`).send({ rating: 8, comment: 'x' });
    expect(res.status).toBe(400);
  });

  test('un cliente solo puede tener una reseña por producto (upsert reemplaza)', async () => {
    const productId = await makeProduct('Producto Reseñable C');
    const token = await loginClient('3004440004', 'review-upsert@example.com');

    await request(app).post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`).send({ rating: 4, comment: 'Primera' });
    await request(app).post(`/api/products/${productId}/reviews`)
      .set('Authorization', `Bearer ${token}`).send({ rating: 5, comment: 'Actualizada' });

    const db = getDB();
    const { rows } = await db.query('SELECT * FROM product_reviews WHERE product_id = $1', [productId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(5);
    expect(rows[0].comment).toBe('Actualizada');
  });

  test('requiere autenticación', async () => {
    const productId = await makeProduct('Producto Reseñable D');
    const res = await request(app).get(`/api/products/${productId}/reviews`);
    expect(res.status).toBe(401);
  });
});
