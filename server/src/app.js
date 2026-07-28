'use strict';
require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path    = require('path');
const logger = require('./utils/logger');
const pinoHttp = require('pino-http');

const app = express();

// Necesario cuando el servidor está detrás de un proxy (ngrok, nginx, etc.)
// Sin esto express-rate-limit lanza ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
app.set('trust proxy', 1);
app.use(compression());

const { ipActivityMiddleware, startIpActivityFlusher } = require('./middleware/ipActivity');
app.use(ipActivityMiddleware);
if (process.env.NODE_ENV !== 'test') startIpActivityFlusher();

// ── Seguridad global (API + sitio web) ───────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", "data:", "https:"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// ── Sitio web (server/src/website, generado por website/ vía Vite --
// ver compilar-web.sh) servido en la raíz. Reemplaza la app Flutter Web
// que vivía en /app -- Android sigue siendo Flutter (android-app/), pero
// el sitio público ahora es HTML/CSS/JS real, sin Flutter.
app.use(express.static(path.join(__dirname, 'website')));

// ── CORS restrictivo ─────────────────────────────────────────
// Ningun dominio real va hardcodeado aqui -- cada instalacion configura el
// suyo desde la pestaña Configuracion del dashboard (settings.server_domain /
// settings.extra_domains, tabla `settings`) o via env SERVER_DOMAIN como
// respaldo. Cache corto para no golpear la DB en cada request.
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
];
let originsCache = { at: 0, list: [] };
const ORIGINS_CACHE_MS = 5000;

function normalizeDomain(raw) {
  const d = String(raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(:[0-9]{1,5})?$/i.test(d) ? d : null;
}

async function getAllowedOrigins(now) {
  if (now - originsCache.at < ORIGINS_CACHE_MS) return originsCache.list;
  const domains = new Set();
  if (process.env.SERVER_DOMAIN) domains.add(normalizeDomain(process.env.SERVER_DOMAIN));
  try {
    const { getDB } = require('./db/database');
    const { rows } = await getDB().query(`SELECT value FROM settings WHERE key IN ('server_domain','extra_domains')`);
    for (const r of rows) {
      String(r.value || '').split(',').forEach(d => domains.add(normalizeDomain(d)));
    }
  } catch (_e) { /* DB aun no lista (arranque) -- usa solo env/localhost por ahora */ }
  const list = [...LOCAL_DEV_ORIGINS, ...[...domains].filter(Boolean).map(d => `https://${d}`)];
  originsCache = { at: now, list };
  return list;
}

app.use(cors({
  origin: async (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      const allowed = await getAllowedOrigins(Date.now());
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error('Origen no permitido por CORS'));
    } catch (e) { cb(e); }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate limiting (desactivado en tests: no aporta nada y solo hace
// que los tests se pisen entre sí a través del contador compartido) ──
// Store: Redis si REDIS_URL esta configurada (necesario para que el limite
// sea real con mas de una instancia del server); si no, memoria del proceso
// como hasta ahora. Ver utils/hybridRateLimitStore.js.
if (process.env.NODE_ENV !== 'test') {
  const HybridRateLimitStore = require('./utils/hybridRateLimitStore');
  app.use('/api/', rateLimit({
    windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false,
    store: new HybridRateLimitStore('rl:api:', 60_000),
  }));
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera 15 minutos.' },
    store: new HybridRateLimitStore('rl:auth:', 15 * 60_000),
  }));
  app.use('/api/webhook', rateLimit({
    windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false,
    store: new HybridRateLimitStore('rl:webhook:', 60_000),
  }));
}

app.use('/api', pinoHttp({ logger }));

// ── Rutas API ─────────────────────────────────────────────────
app.use('/api/webhook',  require('./routes/webhook'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/bot',      require('./routes/bot'));
app.use('/api/email',    require('./routes/emailConfig'));
app.use('/api/estados',  require('./routes/estados'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/chat',     require('./routes/chat'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/staff-locations', require('./routes/staffLocations'));
app.use('/api/payments', require('./routes/payments'));

app.get('/health',  (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/cache-stats', (req, res) => {
  const { allStats } = require('./utils/memoryCache');
  res.json(allStats());
});
app.get('/preview', (req, res) => res.sendFile(path.join(__dirname, 'preview.html')));

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, next) => {
  // multer LIMIT_FILE_SIZE / LIMIT_UNEXPECTED_FILE → 400 not 500
  const isMulterLimit = err.code && err.code.startsWith('LIMIT_');
  const status = err.status || (isMulterLimit ? 400 : 500);
  if (status >= 500) logger.error({ err: err.message, at: err.stack?.split('\n')[1] }, 'Error no manejado');
  res.status(status).json({
    error: status >= 500 ? 'Error interno del servidor' : (err.message || 'Error'),
  });
});

module.exports = app;
