'use strict';
const path = require('path');
const os = require('os');

const { setupTestEnv, teardownTestSchema } = require('./helpers/testDb');
setupTestEnv('compression');
process.env.REPORTS_DIR = path.join(os.tmpdir(), `reports-compression-${Date.now()}`);

const request = require('supertest');
const { initDB } = require('../src/db/database');
const app = require('../src/app');

beforeAll(async () => { await initDB(); });
afterAll(async () => { await teardownTestSchema(); });

test('respuestas grandes del sitio web se sirven comprimidas con gzip', async () => {
  // El bundle de layout (header/footer/animaciones, compartido por todas las
  // páginas) es el asset más grande del sitio -- suficiente para superar el
  // umbral de compression(). El hash del nombre cambia en cada build, así
  // que se descubre el path real desde el index en vez de hardcodearlo.
  const index = await request(app).get('/');
  const match = index.text.match(/\/assets\/layout-[\w-]+\.js/);
  expect(match).toBeTruthy();

  const res = await request(app)
    .get(match[0])
    .set('Accept-Encoding', 'gzip');
  expect(res.status).toBe(200);
  expect(res.headers['content-encoding']).toBe('gzip');
});
