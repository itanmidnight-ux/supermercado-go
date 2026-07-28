'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('analytics-real-data');
process.env.SEED_PASSWORD_ADMIN = 'admin-test-pw';

const request = require('supertest');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function adminToken() {
  const res = await request(app).post('/api/auth/token').send({ username: 'admin', password: 'admin-test-pw' });
  return res.body.token;
}

describe('GET /api/analytics/summary — active_orders reemplaza el foco en ticket promedio', () => {
  test('incluye active_orders con el conteo real de pedidos pending/claimed/en_camino', async () => {
    const token = await adminToken();
    const db = getDB();
    const { rows: custRows } = await db.query("INSERT INTO customers (phone, name) VALUES ('573001112222','Cliente Analytics') RETURNING id");
    await db.query(
      `INSERT INTO orders (customer_id, product_name, requested_at, status) VALUES ($1,'Prod A',now_iso(),'pending')`,
      [custRows[0].id]
    );
    await db.query(
      `INSERT INTO orders (customer_id, product_name, requested_at, status) VALUES ($1,'Prod B',now_iso(),'en_camino')`,
      [custRows[0].id]
    );

    const res = await request(app).get('/api/analytics/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.active_orders).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/analytics/products — needs_attention unifica stock bajo y poca demanda', () => {
  test('incluye productos con stock bajo (reason low_stock)', async () => {
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Stock Bajo', price: 1000, aliases: [], stock: 2 });
    const db = getDB();
    await db.query(`UPDATE products SET low_stock_threshold = 5 WHERE name = 'Producto Stock Bajo'`);

    const res = await request(app).get('/api/analytics/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.needs_attention.find(a => a.name === 'Producto Stock Bajo');
    expect(found).toBeTruthy();
    expect(found.reason).toBe('low_stock');
  });

  test('incluye productos con poca demanda (reason low_demand) sin duplicar los de low_stock', async () => {
    const token = await adminToken();
    await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Sin Ventas', price: 1000, aliases: [] });

    const res = await request(app).get('/api/analytics/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.needs_attention.find(a => a.name === 'Producto Sin Ventas');
    expect(found).toBeTruthy();
    expect(found.reason).toBe('low_demand');
    // no debe aparecer duplicado en needs_attention
    const occurrences = res.body.needs_attention.filter(a => a.name === 'Producto Sin Ventas');
    expect(occurrences).toHaveLength(1);
  });
});

describe('GET /api/analytics/customers — incluye email y fecha de registro', () => {
  test('top_customers trae email si el cliente tiene cuenta en la app', async () => {
    const token = await adminToken();
    await request(app).post('/api/auth/register').send({
      phone: '3009990001', password: 'password123', display_name: 'Cliente Top', email: 'top-customer@example.com', address: 'Calle 1',
    });
    const login = await request(app).post('/api/auth/token').send({ username: '573009990001', password: 'password123' });
    const prod = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Producto Top Customer', price: 2000, aliases: [] });
    await request(app).post('/api/cart').set('Authorization', `Bearer ${login.body.token}`)
      .send({ product_id: prod.body.id, quantity: 1 });
    const checkout = await request(app).post('/api/cart/checkout').set('Authorization', `Bearer ${login.body.token}`)
      .send({ payment_method: 'nequi', payment_reference: 'R1', delivery_mode: 'address', delivery_address: 'Cra 1' });
    expect(checkout.status).toBe(201);

    // marcar el pedido como entregado para que cuente en el reporte
    const db = getDB();
    await db.query(
      `UPDATE orders SET status='delivered', delivered_at=now_iso() WHERE product_name LIKE '%Producto Top Customer%'`
    );

    const res = await request(app).get('/api/analytics/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const found = res.body.top_customers.find(c => c.phone === '573009990001');
    expect(found).toBeTruthy();
    expect(found.email).toBe('top-customer@example.com');
    expect(found.customer_since).toBeTruthy();
  });
});
