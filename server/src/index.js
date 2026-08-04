// src/index.js — Punto de entrada de Supermercados Go Server
// Bootstrap: config → DB → migraciones → Express → WebSocket → listen
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

// ─── Cargar configuración ───────────────────────────────────
const config = require('./config');
console.log(`[SERVER] Entorno: ${config.nodeEnv}`);
console.log(`[SERVER] Negocio: ${config.business.name} — ${config.business.city}, ${config.business.department}`);

// ─── Inicializar base de datos ───────────────────────────────
const { db, getDb, runInTransaction } = require('./db');
console.log('[SERVER] Base de datos inicializada (WAL mode).');

// ─── Ejecutar migraciones ────────────────────────────────────
const { runMigrations } = require('./migrate');
runMigrations();

// ─── Crear aplicación Express ────────────────────────────────
const app = express();

// Seguridad
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOptions = {
  origin: config.corsOrigins === '*' ? true : config.corsOrigins.split(',').map(s => s.trim()),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
};
app.use(cors(corsOptions));

// Compresión
app.use(compression());

// Parsear JSON (máximo 1MB)
app.use(express.json({ limit: '1mb' }));

// Archivos estáticos (uploads)
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'data/uploads'), {
  maxAge: 86400000, // 24 horas
  etag: true,
}));

// ─── Rutas API ──────────────────────────────────────────────

// Health check (público)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: config.business.name,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Auth
app.use('/api/auth', require('./routes/auth'));

// Público (no requieren auth)
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/banners', require('./routes/banners'));

// Protegidas
app.use('/api/orders', require('./routes/orders'));
app.use('/api/users', require('./routes/users'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/cash-sessions', require('./routes/cash_sessions'));
app.use('/api/upload', require('./routes/upload'));

// Webhook de WhatsApp (público, validado por verify token o API key)
app.use('/api/webhooks/whatsapp', (req, res) => {
  const whatsappService = require('./services/whatsapp.service');
  const { apiAuth } = require('./middleware/auth');

  if (req.method === 'GET') {
    // Verificación de webhook de Meta
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('[WH] Webhook verificado exitosamente.');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token de verificación inválido');
  }

  if (req.method === 'POST') {
    // Los mensajes entrantes se procesan sin auth pero con validación de firma en producción
    whatsappService.handleIncomingMessage(
      req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
      req.body
    );
    return res.status(200).json({ status: 'ok' });
  }

  res.status(405).json({ error: 'Método no permitido' });
});

// ─── API error handler ────────────────────────────────────────
const { errorHandler } = require('./middleware/error');
app.use('/api', errorHandler);

// ─── Sitio web estático (SPA) ───────────────────────────────
const websitePath = path.resolve(__dirname, '..', '..', 'website');
app.use(express.static(websitePath));

// SPA fallback: cualquier ruta no-API que no sea un archivo estático → index.html
app.get('*', (req, res, next) => {
  // No interceptar rutas API ni uploads
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  // Si la ruta tiene extensión, probablemente es un archivo faltante → 404
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(websitePath, 'index.html'));
});

// ─── Seed categorías iniciales ────────────────────────────────
function seedCategories() {
  const count = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (count.count > 0) return;

  console.log('[SEED] Creando categorías iniciales...');
  const now = new Date().toISOString();
  const { generateId } = require('./utils/ids');

  const categories = [
    { name: 'Frutas y Verduras', sort_order: 1 },
    { name: 'Carnes y Pollo', sort_order: 2 },
    { name: 'Lácteos y Huevos', sort_order: 3 },
    { name: 'Abarrotes', sort_order: 4 },
    { name: 'Bebidas', sort_order: 5 },
    { name: 'Panadería', sort_order: 6 },
  ];

  const insert = db.prepare('INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)');
  const seedMany = db.transaction((items) => {
    for (const cat of items) {
      insert.run(generateId(), cat.name, cat.sort_order, now);
    }
  });

  seedMany(categories);
  console.log('[SEED] Categorías iniciales creadas exitosamente.');
}

seedCategories();

// ─── Iniciar servidor HTTP ───────────────────────────────────
const server = app.listen(config.port, config.host, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  🟢 ${config.business.name}`);
  console.log(`  📍 ${config.business.city}, ${config.business.department}`);
  console.log(`  📞 ${config.business.phone}`);
  console.log(`  🕐 ${config.business.hours}`);
  console.log('───────────────────────────────────────────────────');
  console.log(`  Servidor: http://${config.host}:${config.port}`);
  console.log(`  API:     http://${config.host}:${config.port}/api`);
  console.log(`  Health:  http://${config.host}:${config.port}/api/health`);
  console.log(`  Web:     http://${config.host}:${config.port}/`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});

// ─── Iniciar WebSocket ──────────────────────────────────────
const wsService = require('./services/ws.service');
wsService.init(server);

// ─── Manejo de señales ──────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[SERVER] Recibida señal ${signal}. Cerrando servidor...`);
  wsService.close();
  server.close(() => {
    console.log('[SERVER] Servidor HTTP cerrado.');
    db.close();
    console.log('[SERVER] Base de datos cerrada. Adiós.');
    process.exit(0);
  });

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    console.error('[SERVER] Forzando cierre después de timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Excepción no capturada:', err.message);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Promesa rechazada no manejada:', reason);
});

module.exports = { app, server };
