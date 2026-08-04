// src/config.js — Única fuente de verdad para la configuración de la aplicación
const dotenv = require('dotenv');

dotenv.config();

function required(name) {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    return null;
  }
  return val.trim();
}

function intDefault(name, def) {
  const val = process.env[name];
  if (val === undefined || val === null || val.trim() === '') return def;
  const n = parseInt(val, 10);
  return isNaN(n) ? def : n;
}

function strDefault(name, def) {
  const val = process.env[name];
  if (val === undefined || val === null || val.trim() === '') return def;
  return val.trim();
}

function boolDefault(name, def) {
  const val = process.env[name];
  if (val === undefined || val === null) return def;
  return val.trim() === 'true' || val.trim() === '1';
}

const nodeEnv = strDefault('NODE_ENV', 'development');

// Validación crítica en producción
if (nodeEnv === 'production') {
  const jwtSecret = required('JWT_SECRET');
  const apiKey = required('API_KEY');
  if (!jwtSecret) {
    console.error('[CONFIG] ERROR: JWT_SECRET es obligatorio en producción.');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('[CONFIG] ERROR: API_KEY es obligatorio en producción.');
    process.exit(1);
  }
}

const config = {
  // Servidor
  port: intDefault('PORT', 3777),
  host: strDefault('HOST', '0.0.0.0'),

  // Base de datos
  dbPath: strDefault('DB_PATH', './data/supermercados.db'),

  // JWT
  jwtSecret: strDefault('JWT_SECRET', 'supermercados-go-jwt-secret-dev'),
  jwtExpiresIn: strDefault('JWT_EXPIRES_IN', '24h'),

  // API
  apiKey: strDefault('API_KEY', 'supermercados-go-api-key-dev'),
  corsOrigins: strDefault('CORS_ORIGINS', '*'),

  // Datos del negocio
  business: {
    name: strDefault('BUSINESS_NAME', 'Supermercados Go'),
    phone: strDefault('BUSINESS_PHONE', '+573044016277'),
    email: strDefault('BUSINESS_EMAIL', 'carrierjawerly@gmail.com'),
    address: strDefault('BUSINESS_ADDRESS', 'KDX 1-2B Los Mangos'),
    city: strDefault('BUSINESS_CITY', 'Cúcuta'),
    department: strDefault('BUSINESS_DEPARTMENT', 'Norte de Santander'),
    hours: strDefault('BUSINESS_HOURS', '6:00 AM - 6:00 PM'),
    tagline: strDefault('BUSINESS_TAGLINE', 'Tu supermercado, donde vayas'),
  },

  // Colores de marca
  brand: {
    primary: strDefault('BRAND_PRIMARY', '#00B860'),
    accent: strDefault('BRAND_ACCENT', '#FF8C00'),
    dark: strDefault('BRAND_DARK', '#1a7a3a'),
  },

  // Delivery
  delivery: {
    feeDefault: intDefault('DELIVERY_FEE_DEFAULT', 4900),
    freeMin: intDefault('FREE_DELIVERY_MIN', 50000),
    zone: strDefault('OPERATING_ZONE', 'Cúcuta'),
  },

  // WhatsApp
  whatsapp: {
    enabled: boolDefault('WA_ENABLED', false),
    businessNumber: strDefault('WA_BUSINESS_NUMBER', ''),
    verifyToken: strDefault('WA_VERIFY_TOKEN', ''),
    accessToken: strDefault('WA_ACCESS_TOKEN', ''),
    phoneId: strDefault('WA_PHONE_ID', ''),
  },

  nodeEnv,
};

module.exports = config;
