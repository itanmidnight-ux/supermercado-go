'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('messages-access-control');
process.env.SEED_PASSWORD_JESUS  = 'admin-test-pw';
process.env.SEED_PASSWORD_JOHANA = 'worker-a-pw';
process.env.SEED_PASSWORD_FELIPE = 'worker-b-pw';

const request = require('supertest');
const { initDB, getDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function login(username, password) {
  const res = await request(app).post('/api/auth/token').send({ username, password });
  return res.body.token;
}

describe('Chats -- solo visibles al trabajador que reclamó el pedido (o admin)', () => {
  let adminToken, workerAToken, workerBToken, phone;

  beforeAll(async () => {
    adminToken  = await login('jesus', 'admin-test-pw');
    workerAToken = await login('johana', 'worker-a-pw');
    workerBToken = await login('felipe', 'worker-b-pw');

    phone = '573001230099';
    const db = getDB();
    const { rows: custRows } = await db.query(
      "INSERT INTO customers (phone, name) VALUES ($1,'Cliente Chat Test') RETURNING id", [phone]
    );
    await db.query(
      `INSERT INTO orders (customer_id, product_name, requested_at, status) VALUES ($1,'Prod Chat',now_iso(),'pending')`,
      [custRows[0].id]
    );
    await db.query(
      `INSERT INTO messages (phone, content, direction, sent, type) VALUES ($1,'hola','inbound',1,'direct')`,
      [phone]
    );

    // worker A reclama el pedido de este cliente
    const { rows: orderRows } = await db.query('SELECT id FROM orders WHERE customer_id=$1', [custRows[0].id]);
    const claimRes = await request(app).put(`/api/orders/${orderRows[0].id}/claim`)
      .set('Authorization', `Bearer ${workerAToken}`);
    expect(claimRes.status).toBe(200);
  });

  test('worker A (reclamó el pedido) ve la conversación en el listado', async () => {
    const res = await request(app).get('/api/messages').set('Authorization', `Bearer ${workerAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some(c => c.phone === phone)).toBe(true);
  });

  test('worker B (no reclamó nada de este cliente) NO ve la conversación en el listado', async () => {
    const res = await request(app).get('/api/messages').set('Authorization', `Bearer ${workerBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some(c => c.phone === phone)).toBe(false);
  });

  test('worker B no puede abrir la conversación directamente -> 403', async () => {
    const res = await request(app).get(`/api/messages/${phone}`).set('Authorization', `Bearer ${workerBToken}`);
    expect(res.status).toBe(403);
  });

  test('worker B no puede enviar mensaje a ese cliente -> 403', async () => {
    const res = await request(app).post('/api/messages/send').set('Authorization', `Bearer ${workerBToken}`)
      .send({ phone, content: 'hola intento' });
    expect(res.status).toBe(403);
  });

  test('worker A sí puede abrir y enviar en esa conversación', async () => {
    const getRes = await request(app).get(`/api/messages/${phone}`).set('Authorization', `Bearer ${workerAToken}`);
    expect(getRes.status).toBe(200);
    const sendRes = await request(app).post('/api/messages/send').set('Authorization', `Bearer ${workerAToken}`)
      .send({ phone, content: 'hola cliente' });
    expect(sendRes.status).toBe(200);
  });

  test('admin ve y accede a todas las conversaciones', async () => {
    const list = await request(app).get('/api/messages').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.some(c => c.phone === phone)).toBe(true);
    const conv = await request(app).get(`/api/messages/${phone}`).set('Authorization', `Bearer ${adminToken}`);
    expect(conv.status).toBe(200);
  });
});
