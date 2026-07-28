'use strict';
const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('profile-security');
process.env.SEED_PASSWORD_ADMIN = 'admin-test-pw';

const request = require('supertest');
const { initDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

async function registerAndLogin(phone, email) {
  await request(app).post('/api/auth/register').send({
    phone, password: 'password123', display_name: 'Cliente Perfil', email, address: 'Calle 1',
  });
  const res = await request(app).post('/api/auth/token').send({ username: '57' + phone, password: 'password123' });
  return res.body.token;
}

describe('PUT /api/users/me — cambio de correo requiere contraseña', () => {
  test('sin current_password -> 400', async () => {
    const token = await registerAndLogin('3006660001', 'profile-a@example.com');
    const res = await request(app).put('/api/users/me').set('Authorization', `Bearer ${token}`)
      .send({ email: 'nuevo-a@example.com' });
    expect(res.status).toBe(400);
  });

  test('con contraseña incorrecta -> 401', async () => {
    const token = await registerAndLogin('3006660002', 'profile-b@example.com');
    const res = await request(app).put('/api/users/me').set('Authorization', `Bearer ${token}`)
      .send({ email: 'nuevo-b@example.com', current_password: 'incorrecta' });
    expect(res.status).toBe(401);
  });

  test('con contraseña correcta -> cambia el correo', async () => {
    const token = await registerAndLogin('3006660003', 'profile-c@example.com');
    const res = await request(app).put('/api/users/me').set('Authorization', `Bearer ${token}`)
      .send({ email: 'nuevo-c@example.com', current_password: 'password123' });
    expect(res.status).toBe(200);

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.email).toBe('nuevo-c@example.com');
  });

  test('no se puede editar nombre/dirección/apodo/bio desde este endpoint (ya no existen)', async () => {
    const token = await registerAndLogin('3006660004', 'profile-d@example.com');
    const res = await request(app).put('/api/users/me').set('Authorization', `Bearer ${token}`)
      .send({ email: 'profile-d@example.com', current_password: 'password123', display_name: 'Otro Nombre' });
    expect(res.status).toBe(200);
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.user.display_name).toBe('Cliente Perfil');
  });
});

describe('PUT /api/users/me/phone — cambio de número requiere contraseña', () => {
  test('sin contraseña -> 400', async () => {
    const token = await registerAndLogin('3006660010', 'profile-e@example.com');
    const res = await request(app).put('/api/users/me/phone').set('Authorization', `Bearer ${token}`)
      .send({ phone: '3009998877' });
    expect(res.status).toBe(400);
  });

  test('celular ya usado por otra cuenta -> 409', async () => {
    await registerAndLogin('3006660011', 'profile-f@example.com');
    const token2 = await registerAndLogin('3006660012', 'profile-g@example.com');
    const res = await request(app).put('/api/users/me/phone').set('Authorization', `Bearer ${token2}`)
      .send({ phone: '3006660011', current_password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('celular nuevo válido -> 200', async () => {
    const token = await registerAndLogin('3006660013', 'profile-h@example.com');
    const res = await request(app).put('/api/users/me/phone').set('Authorization', `Bearer ${token}`)
      .send({ phone: '3001112233', current_password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('573001112233');
  });
});
