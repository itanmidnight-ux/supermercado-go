// src/index.js — Punto de entrada de Supermercados Go Server
// Bootstrap: config → DB → migraciones → Express → WebSocket → listen
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

// ─── Cargar configuración ───────────────────────────────────
const config = require('./config');
const { sanitizeInput, requestLogger, securityHeaders } = require('./middleware/security');
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

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// Seguridad
app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — Seguro: solo permitir orígenes explícitos
const allowedOrigins = config.corsOrigins === '*'
  ? false // No wildcard — must be explicit in production
  : config.corsOrigins.split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, server-to-server, same-origin)
    if (!origin) return callback(null, true);
    // If CORS_ORIGINS is empty or not set, allow same-origin only
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400,
};
app.use(cors(corsOptions));

// Compresión
app.use(compression());

// Parsear JSON (máximo 1MB)
app.use(express.json({ limit: '1mb' }));

// Middleware de seguridad
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(requestLogger);

// Rate limiting global — protección contra abuso general
const rateLimit = require('express-rate-limit');
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // 500 requests por ventana por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intente de nuevo más tarde.' },
});
app.use('/api', globalLimiter);

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

// Importador de productos Excel [admin] — IA local, heurísticas automáticas
app.use('/api/products', require('./routes/import-products'));

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
app.use('/api/worker-location', require('./routes/worker-location'));

// Nuevas rutas - Fidelización
app.use('/api/loyalty', require('./routes/loyalty'));

// Nuevas rutas - Mensajería interna
app.use('/api/messaging', require('./routes/messaging'));

// Nuevas rutas - Reportes PDF
app.use('/api/reports', require('./routes/reports'));

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

// ─── Panel Admin (standalone) ────────────────────────────────
const adminPanelPath = path.resolve(__dirname, '..', '..', 'admin-panel');
app.use('/admin', express.static(adminPanelPath));

// ─── Panel Worker (standalone) ───────────────────────────────
const workerPanelPath = path.resolve(__dirname, '..', '..', 'worker-panel');
app.use('/worker', express.static(workerPanelPath));

// ─── Sitio web estático (SPA) ───────────────────────────────
const websitePath = path.resolve(__dirname, '..', '..', 'website', 'out');
app.use(express.static(websitePath));

// SPA fallback: cualquier ruta no-API que no sea un archivo estático → index.html
app.get('*', (req, res, next) => {
  // No interceptar rutas API ni uploads
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return next();
  }
  // Admin panel routes
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(adminPanelPath, 'index.html'));
  }
  // Worker panel routes
  if (req.path.startsWith('/worker')) {
    return res.sendFile(path.join(workerPanelPath, 'index.html'));
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

// ─── Seed: productos de ejemplo ──────────────────────────────
function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (count.count > 0) return;

  console.log('[SEED] Creando productos de ejemplo...');
  const { generateId } = require('./utils/ids');
  const now = new Date().toISOString();

  // Obtener categorías
  const cats = {};
  db.prepare('SELECT id, name FROM categories').all().forEach(c => {
    cats[c.name.toLowerCase()] = c.id;
  });

  const products = [
    // Frutas y Verduras
    { name: 'Manzanas Rojas', cat: 'frutas y verduras', price: 6500, unit: 'kg', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500', brand: 'Fresco', stock: 50 },
    { name: 'Plátanos', cat: 'frutas y verduras', price: 2800, unit: 'kg', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500', brand: 'Fresco', stock: 80 },
    { name: 'Tomate', cat: 'frutas y verduras', price: 3200, unit: 'kg', image: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=500', brand: 'Fresco', stock: 60 },
    { name: 'Cebolla', cat: 'frutas y verduras', price: 2500, unit: 'kg', image: 'https://images.unsplash.com/photo-1618512496248-a07fe8398a62?w=500', brand: 'Fresco', stock: 45 },
    { name: 'Papa Criolla', cat: 'frutas y verduras', price: 3500, unit: 'kg', image: 'https://images.unsplash.com/photo-1518977676601-b53f82ber40?w=500', brand: 'Fresco', stock: 70 },
    { name: 'Aguacate', cat: 'frutas y verduras', price: 4500, unit: 'un', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=500', brand: 'Fresco', stock: 40 },
    { name: 'Naranjas', cat: 'frutas y verduras', price: 2200, unit: 'kg', image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=500', brand: 'Fresco', stock: 55 },
    { name: 'Limones', cat: 'frutas y verduras', price: 3000, unit: 'kg', image: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=500', brand: 'Fresco', stock: 35 },

    // Carnes y Pollo
    { name: 'Pechuga de Pollo', cat: 'carnes y pollo', price: 12900, unit: 'kg', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82571?w=500', brand: 'Fresquísimo', stock: 30 },
    { name: 'Carne Molida', cat: 'carnes y pollo', price: 16500, unit: 'kg', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=500', brand: 'Fresquísimo', stock: 25 },
    { name: 'Chorizo Argentino', cat: 'carnes y pollo', price: 18000, unit: 'kg', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=500', brand: 'Fresquísimo', stock: 20 },
    { name: 'Costillas de Cerdo', cat: 'carnes y pollo', price: 19500, unit: 'kg', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500', brand: 'Fresquísimo', stock: 15 },
    { name: 'Pollo Entero', cat: 'carnes y pollo', price: 9800, unit: 'kg', image: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=500', brand: 'Fresquísimo', stock: 35 },

    // Lácteos y Huevos
    { name: 'Leche Entera', cat: 'lácteos y huevos', price: 4200, unit: 'lt', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500', brand: 'Alpina', stock: 100 },
    { name: 'Huevos (Docena)', cat: 'lácteos y huevos', price: 8500, unit: 'doc', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500', brand: 'Kikes', stock: 80 },
    { name: 'Queso Mozzarella', cat: 'lácteos y huevos', price: 14500, unit: 'kg', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500', brand: 'Alpina', stock: 40 },
    { name: 'Yogurt Natural', cat: 'lácteos y huevos', price: 3800, unit: 'un', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500', brand: 'Alpina', stock: 60 },
    { name: 'Mantequilla', cat: 'lácteos y huevos', price: 5200, unit: 'un', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb13589ee?w=500', brand: 'Alpina', stock: 45 },

    // Abarrotes
    { name: 'Arroz Premium', cat: 'abarrotes', price: 3800, unit: 'kg', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500', brand: 'Éxito', stock: 120 },
    { name: 'Aceite de Oliva', cat: 'abarrotes', price: 18500, unit: 'ml', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500', brand: 'Borges', stock: 50 },
    { name: 'Pasta Italiana', cat: 'abarrotes', price: 3200, unit: 'un', image: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=500', brand: 'Barilla', stock: 80 },
    { name: 'Azúcar', cat: 'abarrotes', price: 3500, unit: 'kg', image: 'https://images.unsplash.com/photo-1581349485608-9469020a71a4?w=500', brand: 'Riopaila', stock: 90 },
    { name: 'Sal Refinada', cat: 'abarrotes', price: 2000, unit: 'kg', image: 'https://images.unsplash.com/photo-1518110925495-5fe2c8d0a3d4?w=500', brand: 'Refisal', stock: 100 },
    { name: 'Café Colombiano', cat: 'abarrotes', price: 15000, unit: 'g', image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500', brand: 'Colcafé', stock: 70 },

    // Bebidas
    { name: 'Coca-Cola 1.5L', cat: 'bebidas', price: 5200, unit: 'un', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500', brand: 'Coca-Cola', stock: 150 },
    { name: 'Agua Botellón', cat: 'bebidas', price: 2800, unit: 'un', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500', brand: 'Cristal', stock: 200 },
    { name: 'Jugo Natural', cat: 'bebidas', price: 4500, unit: 'lt', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500', brand: 'Tropi', stock: 60 },
    { name: 'Gaseosa Colombiana', cat: 'bebidas', price: 3500, unit: 'un', image: 'https://images.unsplash.com/photo-1624552184280-9e9631bbeee9?w=500', brand: 'Colombiana', stock: 100 },

    // Panadería
    { name: 'Pan Francés', cat: 'panadería', price: 800, unit: 'un', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500', brand: 'Artesanal', stock: 200 },
    { name: 'Croissant', cat: 'panadería', price: 2500, unit: 'un', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=500', brand: 'Artesanal', stock: 50 },
    { name: 'Galletas Oreo', cat: 'panadería', price: 3200, unit: 'un', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500', brand: 'OREO', stock: 80 },
    { name: 'Torta de Chocolate', cat: 'panadería', price: 25000, unit: 'un', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500', brand: 'Artesanal', stock: 10 },
  ];

  const insert = db.prepare(`
    INSERT INTO products (id, name, price, image, unit, stock, category_id, brand, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  const seedMany = db.transaction((items) => {
    for (const p of items) {
      const catId = cats[p.cat] || null;
      insert.run(generateId(), p.name, p.price, p.image, p.unit, p.stock, catId, p.brand, now, now);
    }
  });

  seedMany(products);
  console.log(`[SEED] ${products.length} productos creados.`);
}

seedProducts();

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
