// src/services/whatsapp-bot.service.js — Bot de WhatsApp con Baileys (multi-device)
// Interpreta pedidos en lenguaje natural, detecta intenciones y crea pedidos en la BD.
// Requiere: npm install @whiskeysockets/baileys pino
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { generateId } = require('../utils/ids');
const { formatCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');

// ─── Configuración ──────────────────────────────────────────
const SESSION_DIR = path.resolve(__dirname, '../../data/wa-session');
const AUTH_STATE_PATH = path.join(SESSION_DIR, 'auth_state.json');
const CONTACTS_FILE = path.join(SESSION_DIR, 'lid_map.json');
const RECONNECT_WINDOW_MS = 30_000;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BACKOFF_MS = 3000;

// ─── Estado del bot ─────────────────────────────────────────
let sock = null;
let db = null;
let isConnecting = false;
let reconnectTimer = null;
let lastDisconnectTime = 0;
let messageQueue = [];
let processingQueue = false;

// ─── Mapa LID → número real (resolución de privacidad multi-device) ──
let lidToNumber = {};

// ─── Intenciones detectadas ─────────────────────────────────
const INTENTS = {
  PEDIDO: 'pedido',
  CONSULTA_PRECIO: 'consulta_precio',
  RECLAMO: 'reclamo',
  AGRADECIMIENTO: 'agradecimiento',
  SALUDO: 'saludo',
  AYUDA: 'ayuda',
  DESCONOCIDO: 'desconocido',
};

// ─── Patrones de detección de intención ─────────────────────
const INTENT_PATTERNS = {
  [INTENTS.PEDIDO]: [
    /(?:quiero|deseo|necesito|pedir|comprar|llevar|env(?:i|í)ame|tráeme|ponme|surtirme|llévame)\b/i,
    /\b(?:bulto|paquete|kilo|kg|lb|libra|litro|lt|ml|docena|unid|pieza|atado|manojo)\b/i,
    /\d+\s+(?:de\s+)?(?:leche|arroz|aceite|huevo|pan|carne|pollo|papa|cebolla|tomate|aguacate|banana|naranja|manzana|yogurt|mantequilla|queso|caf[eé]|az[uú]car|sal|harina|fideo|sals[aá]|atún|sardina|cerveza|gaseosa|agua|jugo|pañales|jabón|detergente|cloro|papel)/i,
    /agregar?\s+al?\s*carrito/i,
    /hacer\s+(?:un\s+)?pedido/i,
    /meter\s+(?:al\s+)?carrito/i,
  ],
  [INTENTS.CONSULTA_PRECIO]: [
    /(?:cu[aá]nto|precio|costo|vale|cuánto cuesta|a cuánto|qué precio)/i,
    /\b(?:leche|arroz|aceite|huevo|pan|carne|pollo|papa|cebolla|tomate|aguacate|banana|naranja|manzana|yogurt|mantequilla|queso|caf[eé]|az[uú]car|sal|harina|fideo|sals[aá]|atún|sardina|cerveza|gaseosa|agua|jugo|pañales|jabón|detergente|cloro|papel)\b.*(?:cuesta|vale)/i,
    /cu[aá]nto\s+(?:vale|cuesta)/i,
    /precio\s+de/i,
  ],
  [INTENTS.RECLAMO]: [
    /(?:reclamo|queja|problema|defectuoso|dañado|vencido|malo|no sirve|devolver|devoluci[oó]n|reembolso|compensar|molesto|furioso|enfadado|indignado)/i,
    /(?:se\s+rompió|se\s+dañó|llegó\s+(?:mal|ROTO|dañado|vencido))/i,
    /(?:no\s+(?:me\s+)?(?:llegó|cayo|cayó|funciona))/i,
    /(?:est(?:á|a)\s+(?:mal|ROTO|dañado|vencido))/i,
  ],
  [INTENTS.AGRADECIMIENTO]: [
    /(?:gracias|muchas\s+gracias|mil\s+gracias|agradezco|te\s+felicito|excelente|perfecto|genial|bien\s+hecho|buen\s+servicio|recomendado)/i,
    /(?:excelente\s+(?:servicio|atención|pedido|delivery))/i,
    /(?:todo\s+perfecto|todo\s+bien|todo\s+ok)/i,
  ],
  [INTENTS.SALUDO]: [
    /(?:hola|buenos?\s*(?:d[ií]as?|tardes?|noches?)|hey|qué\s+(?:tal|pasa)|c[oó]mo\s+(?:est[aá]s?|va|and[aá]s?)|saludos)/i,
  ],
  [INTENTS.AYUDA]: [
    /(?:ayuda|help|opciones|men[uú]|qu[eé]\s+puedo|c[oó]mo\s+(?:funciona|se\s+hace|pedo))/i,
  ],
};

// ─── Palabras de stopwords para búsqueda de productos ────────
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'con', 'para', 'por', 'que', 'se', 'su', 'al', 'lo',
  'como', 'más', 'mas', 'menos', 'muy', 'bien', 'mal', 'también',
  'tambien', 'quiero', 'deseo', 'necesito', 'pedir', 'comprar',
  'llevar', 'traer', 'poner', 'meter', 'agregar', 'avisar',
  'bultos', 'bulto', 'paquete', 'paquetes', 'kilo', 'kilos',
  'libra', 'libras', 'litro', 'litros', 'docena', 'unidades',
  'pieza', 'piezas', 'atado', 'manojo', 'docenas', 'kilogramos',
  'por', 'favor', 'porfa', 'porfis', 'gracias', 'ok', 'dale',
  'si', 'no', 'algo', 'otro', 'otra', 'otros', 'otras',
  'todo', 'toda', 'todos', 'todas', 'nada', 'nada',
  'me', 'te', 'le', 'nos', 'les', 'mi', 'tu', 'su',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'aqui', 'ahí', 'ahi', 'alla', 'donde', 'cuando', 'como',
]);

// ─── Tokenización y extracción de ítems ─────────────────────
const NUM_MAP = {
  'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
  'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9,
  'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
  'quince': 15, 'veinte': 20, 'treinta': 30, 'cuarenta': 40,
  'cincuenta': 50, 'cien': 100,
};

const UNIT_MAP = {
  'bulto': 'un', 'bultos': 'un', 'paquete': 'un', 'paquetes': 'un',
  'kilo': 'kg', 'kilos': 'kg', 'kg': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
  'lb': 'lb', 'libra': 'lb', 'libras': 'lb',
  'lt': 'lt', 'litro': 'lt', 'litros': 'lt',
  'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
  'docena': 'doc', 'docenas': 'doc',
  'unid': 'un', 'unidades': 'un', 'pieza': 'un', 'piezas': 'un',
  'atado': 'atado', 'manojo': 'manojo', 'manojos': 'manojo',
  'botella': 'botella', 'botellas': 'botella', 'lata': 'lata', 'latas': 'lata',
  'bolsa': 'bolsa', 'bolsas': 'bolsa', 'saco': 'saco', 'sacos': 'saco',
};

/**
 * Normaliza texto: minúsculas, sin tildes, sin caracteres especiales.
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae un número de una cadena (dígito o palabra en español).
 */
function parseNumber(str) {
  const s = str.toLowerCase().trim();
  if (NUM_MAP[s] !== undefined) return NUM_MAP[s];
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * Tokeniza un mensaje en segmentos separados por comas, "y", "también", etc.
 */
function tokenizeMessage(text) {
  const normalized = normalizeText(text);
  return normalized
    .split(/[,;]|\by\b|\btambi[eé]n\b|\badesem[aá]s\b|\bora?\b|\bluego\b/)
    .map(t => t.trim())
    .filter(t => t.length > 2);
}

/**
 * Extrae ítems (producto, cantidad, unidad) de un segmento de texto.
 * Ejemplo: "2 bultos de leche" → [{ name: 'leche', qty: 2, unit: 'un' }]
 */
function extractItemsFromSegment(segment) {
  const items = [];
  const words = segment.split(/\s+/);

  let qty = 1;
  let unit = 'un';
  let nameWords = [];
  let foundProduct = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Detectar número al inicio o después de stopwords
    const num = parseNumber(word);
    if (num !== null && (i === 0 || nameWords.length === 0)) {
      qty = num;
      continue;
    }

    // Detectar unidad después del número
    const unitNorm = UNIT_MAP[word];
    if (unitNorm && nameWords.length === 0) {
      unit = unitNorm;
      continue;
    }

    // Saltar preposiciones y stopwords comunes
    if (STOP_WORDS.has(word)) {
      if (nameWords.length > 0) foundProduct = true;
      continue;
    }

    // Si ya encontramos producto y hay más palabras, podrían ser parte del nombre
    if (foundProduct && nameWords.length > 0) {
      // Verificar si es un número (cantidad adicional) o continuar nombre
      if (num !== null) {
        break; // Nueva cantidad, nuevo ítem potencial
      }
    }

    nameWords.push(word);
  }

  if (nameWords.length > 0) {
    items.push({
      name: nameWords.join(' '),
      qty,
      unit,
    });
  }

  return items;
}

// ─── Base de datos: búsqueda de productos ────────────────────
/**
 * Busca productos por nombre similar (fuzzy search con LIKE + ranking).
 * @param {Database} database
 * @param {string} query
 * @param {number} limit
 * @returns {Array} Productos encontrados
 */
function searchProducts(database, query, limit = 5) {
  const normalized = normalizeText(query);
  const terms = normalized.split(/\s+/).filter(t => t.length > 1);

  if (terms.length === 0) return [];

  // Construir consulta con múltiples LIKE para cada término
  const conditions = terms.map(() => "LOWER(REPLACE(REPLACE(REPLACE(p.name, 'á','a'), 'é','e'), 'í','i')) LIKE ?").join(' AND ');
  const params = terms.map(t => `%${t}%`);

  const sql = `
    SELECT p.id, p.name, p.price, p.cost, p.stock, p.unit, p.sku,
           p.compare_price, p.is_weighed, p.is_offer, p.offer_price,
           c.name as category_name,
           CASE
             WHEN LOWER(p.name) = ? THEN 100
             WHEN LOWER(p.name) LIKE ? THEN 90
             WHEN ${conditions} THEN 80
             ELSE 0
           END as relevance
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND p.stock > 0
    HAVING relevance > 0
    ORDER BY relevance DESC, p.name ASC
    LIMIT ?
  `;

  const allParams = [normalized, `${normalized}%`, ...params, limit];
  return database.prepare(sql).all(...allParams);
}

/**
 * Busca productos por código de barras o SKU exacto.
 */
function searchProductByCode(database, code) {
  return database.prepare(`
    SELECT p.id, p.name, p.price, p.cost, p.stock, p.unit, p.sku,
           p.compare_price, p.is_weighed, p.is_offer, p.offer_price,
           c.name as category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = 1 AND (p.barcode = ? OR p.sku = ?)
  `).get(code, code);
}

/**
 * Obtiene precio efectivo de un producto (oferta si aplica).
 */
function getEffectivePrice(product) {
  if (product.is_offer && product.offer_price && product.offer_price < product.price) {
    return product.offer_price;
  }
  return product.price;
}

// ─── Resolución de LID (multi-device privacy) ───────────────
/**
 * Carga el mapa LID → número del archivo.
 */
function loadLidMap() {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
      lidToNumber = JSON.parse(data);
      console.log(`[WA-BOT] Mapa LID cargado: ${Object.keys(lidToNumber).length} entradas.`);
    }
  } catch (e) {
    console.warn('[WA-BOT] Error cargando mapa LID:', e.message);
    lidToNumber = {};
  }
}

/**
 * Guarda el mapa LID → número al archivo.
 */
function saveLidMap() {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(lidToNumber, null, 2));
  } catch (e) {
    console.warn('[WA-BOT] Error guardando mapa LID:', e.message);
  }
}

/**
 * Resuelve un identificador @lid a número real.
 */
function resolveLidUser(jid) {
  if (!jid) return null;
  // Si ya es un número de teléfono, devolver directamente
  if (/^\d+@s\.whatsapp\.net$/.test(jid)) {
    return jid.replace('@s.whatsapp.net', '');
  }
  // Si es un LID, buscar en el mapa
  const number = lidToNumber[jid];
  if (number) return number;
  // Intentar extraer del JID si es posible
  const match = jid.match(/^(\d+)@/);
  return match ? match[1] : null;
}

/**
 * Registra una relación LID → número.
 */
function registerLidMapping(jid, phoneNumber) {
  if (!jid || !phoneNumber) return;
  if (jid.includes('@lid')) {
    lidToNumber[jid] = phoneNumber;
    saveLidMap();
    console.log(`[WA-BOT] LID registrado: ${jid} → ${phoneNumber}`);
  }
}

// ─── Detección de mensajes reenviados ────────────────────────
function isForwardedMessage(msg) {
  if (!msg) return false;
  // Baileys marca mensajes reenviados con esta propiedad
  if (msg.key?.remoteJid === 'status@broadcast') return true;
  // Verificar encabezados de reenvío
  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  if (contextInfo?.isForwarded) return true;
  // Verificar si tiene historial de reenvío
  if (contextInfo?.forwardingScore > 0) return true;
  // Verificar timestamp antiguo (posible reenvío en reconexión)
  const msgTimestamp = (msg.messageTimestamp || 0) * 1000;
  if (Date.now() - msgTimestamp > RECONNECT_WINDOW_MS) return true;
  return false;
}

// ─── Interpretación de mensajes ──────────────────────────────
/**
 * Detecta la intención principal de un mensaje.
 */
function detectIntent(text) {
  if (!text || text.trim().length === 0) return INTENTS.DESCONOCIDO;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return intent;
    }
  }

  // Verificar si parece una orden (contiene cantidades + nombres de productos)
  const tokens = tokenizeMessage(text);
  for (const token of tokens) {
    const items = extractItemsFromSegment(token);
    if (items.length > 0 && items[0].name.length > 2) return INTENTS.PEDIDO;
  }

  return INTENTS.DESCONOCIDO;
}

/**
 * Interpreta un mensaje de pedido y extrae los ítems solicitados.
 */
function parseOrderItems(text) {
  const tokens = tokenizeMessage(text);
  const allItems = [];

  for (const token of tokens) {
    const items = extractItemsFromSegment(token);
    allItems.push(...items);
  }

  return allItems;
}

// ─── Procesamiento de pedidos ───────────────────────────────
/**
 * Resuelve los ítems del pedido contra productos reales de la BD.
 */
function resolveOrderItems(database, rawItems) {
  const resolved = [];
  const notFound = [];

  for (const raw of rawItems) {
    const products = searchProducts(database, raw.name, 3);

    if (products.length === 0) {
      notFound.push(raw.name);
      continue;
    }

    // Tomar el producto más relevante
    const best = products[0];
    const price = getEffectivePrice(best);

    // Verificar stock
    if (best.stock < raw.qty) {
      notFound.push(`${best.name} (solo quedan ${best.stock} ${best.unit || 'un'})`);
      continue;
    }

    resolved.push({
      product_id: best.id,
      product_name: best.name,
      product_sku: best.sku || '',
      unit: best.unit || raw.unit || 'un',
      qty: raw.qty,
      unit_price: Math.round(price),
      line_total: Math.round(price * raw.qty),
      stock_available: best.stock,
      is_weighed: best.is_weighed,
    });
  }

  return { resolved, notFound };
}

/**
 * Crea un pedido completo en la BD.
 */
function createOrder(database, params) {
  const {
    clientPhone,
    clientName,
    items,
    fulfillmentType = 'delivery',
    deliveryAddress = null,
    paymentMethod = 'efectivo',
    notes = null,
  } = params;

  const orderId = generateId();
  const now = nowBogota();

  // Calcular totales
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const deliveryFee = fulfillmentType === 'delivery' ? 4900 : 0;
  const discount = 0;
  const taxTotal = 0;
  const total = subtotal + deliveryFee - discount + taxTotal;

  // Buscar usuario existente por teléfono
  const normalizedPhone = clientPhone.replace(/\D/g, '');
  let userId = null;
  const user = database.prepare(
    "SELECT id FROM users WHERE REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', '') LIKE ? OR phone = ?"
  ).get(`%${normalizedPhone.slice(-10)}`, clientPhone);

  if (user) {
    userId = user.id;
  }

  // Insertar pedido
  database.prepare(`
    INSERT INTO orders (
      id, user_id, items, status, subtotal, delivery_fee, discount, tax_total, total,
      payment_method, payment_status, fulfillment_type, delivery_address,
      client_name, client_phone, notes, created_at, updated_at
    ) VALUES (?, ?, '[]', 'pending', ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    userId,
    subtotal,
    deliveryFee,
    discount,
    taxTotal,
    total,
    paymentMethod,
    fulfillmentType,
    deliveryAddress,
    clientName || null,
    clientPhone,
    notes,
    now,
    now
  );

  // Insertar ítems
  const insertItem = database.prepare(`
    INSERT INTO order_items (
      id, order_id, product_id, product_name, product_sku, unit,
      qty, unit_price, discount, tax_rate, tax_amount, line_total, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `);

  for (const item of items) {
    insertItem.run(
      generateId(), orderId, item.product_id, item.product_name,
      item.product_sku, item.unit, item.qty, item.unit_price,
      item.line_total, now
    );
  }

  // Registrar historial
  database.prepare(`
    INSERT INTO order_history (id, order_id, status, changed_by, note, created_at)
    VALUES (?, ?, 'pending', ?, ?, ?)
  `).run(generateId(), orderId, userId, 'Pedido creado desde WhatsApp', now);

  return {
    id: orderId,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    items_count: items.length,
    items,
    created_at: now,
  };
}

// ─── Formateo de respuestas ─────────────────────────────────
function formatPrice(price) {
  return formatCOP(price);
}

function formatOrderSummary(order) {
  let summary = `*Pedido #${order.id.slice(0, 8)}*\n\n`;
  summary += `*Productos:*\n`;

  for (const item of order.items) {
    const lineTotal = formatPrice(item.line_total);
    summary += `  • ${item.product_name} x${item.qty} — ${lineTotal}\n`;
  }

  summary += `\n*Subtotal:* ${formatPrice(order.subtotal)}\n`;
  if (order.delivery_fee > 0) {
    summary += `*Envío:* ${formatPrice(order.delivery_fee)}\n`;
  }
  summary += `*Total:* ${formatPrice(order.total)}\n`;
  summary += `\n*Estado:* Pendiente de confirmación`;

  return summary;
}

function formatProductSearchResults(products, query) {
  if (products.length === 0) {
    return `No encontré productos similares a "${query}". ¿Puedes escribir el nombre completo?`;
  }

  let msg = `Encontré ${products.length} producto(s) para "${query}":\n\n`;
  for (const p of products) {
    const price = getEffectivePrice(p);
    const offerTag = p.is_offer ? ' 🔥 OFERTA' : '';
    msg += `*${p.name}*\n`;
    msg += `  Precio: ${formatPrice(price)}${offerTag}\n`;
    msg += `  Stock: ${p.stock} ${p.unit || 'un'}\n\n`;
  }

  return msg;
}

// ─── Generación de respuestas por intención ──────────────────
function generateGreetingResponse() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 12) greeting = 'Buenos días';
  else if (hour < 18) greeting = 'Buenas tardes';
  else greeting = 'Buenas noches';

  return `${greeting}! 👋 Soy el asistente de *Supermercados Go*.\n\n` +
    `Puedo ayudarte con:\n` +
    `🛒 *Hacer un pedido* — Ej: "Quiero 2 bultos de leche y 1 arroz"\n` +
    `💰 *Consultar precios* — Ej: "¿Cuánto cuesta el aceite?"\n` +
    `📦 *Consultar tu pedido* — Ej: "¿Dónde está mi pedido?"\n` +
    `❓ *Ayuda* — Escribe "ayuda" para ver opciones\n\n` +
    `¿En qué puedo ayudarte?`;
}

function generateHelpResponse() {
  return `*Opciones disponibles:*\n\n` +
    `🛒 *Hacer un pedido*\n` +
    `Escribe lo que necesitas en lenguaje natural:\n` +
    `  "Quiero 2 bultos de leche, 1 arroz y 3 kilos de papa"\n` +
    `  "Necesito un paquete de pañales y detergente"\n\n` +
    `💰 *Consultar precios*\n` +
    `  "¿Cuánto cuesta el café?"\n` +
    `  "Precio de leche en polvo"\n\n` +
    `📦 *Tu pedido*\n` +
    `  "¿Dónde está mi pedido?"\n` +
    `  "Estado del pedido"\n\n` +
    `📋 *Formas de pago*\n` +
    `  Efectivo, Nequi, Daviplata, tarjeta\n\n` +
    `🕐 *Horario de atención*\n` +
    `  Lunes a sábado: 6:00 AM - 6:00 PM\n` +
    `  Domingos: 7:00 AM - 2:00 PM\n\n` +
    `📞 *Contacto*\n` +
    `  Si tienes problemas, escribe "reclamo"`;
}

function generatePriceResponse(products, query) {
  return formatProductSearchResults(products, query);
}

function generateComplaintResponse() {
  return `Lamentamos los inconvenientes. 😔\n\n` +
    `Para atender tu reclamo, por favor indícanos:\n` +
    `1️⃣ *Número de pedido* (si lo tienes)\n` +
    `2️⃣ *Descripción del problema*\n` +
    `3️⃣ *Foto del producto* (si aplica)\n\n` +
    `Un asesor se comunicará contigo en los próximos minutos.\n` +
    `También puedes llamarnos: ${formatPhone('+573044016277')}`;
}

function generateThanksResponse() {
  return `¡Gracias a ti! 😊\n\n` +
    `Esperamos que disfrutes tu pedido. Si necesitas algo más, aquí estamos.\n\n` +
    `¿Puedo ayudarte con algo adicional?`;
}

function generateUnknownResponse() {
  return `No estoy seguro de entender. 🤔\n\n` +
    `Puedo ayudarte con:\n` +
    `• *Hacer un pedido* — Escribe los productos que necesitas\n` +
    `• *Consultar precios* — Pregunta por el precio de un producto\n` +
    `• *Ayuda* — Escribe "ayuda" para ver opciones\n\n` +
    `¿Qué necesitas?`;
}

function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('57') && cleaned.length >= 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
}

// ─── Manejo de mensajes de voz ───────────────────────────────
function generateVoiceTranscriptionResponse() {
  return `Recibí tu mensaje de voz. 🎤\n\n` +
    `Por ahora no puedo transcribir audio. Por favor, escribe tu pedido en texto.\n\n` +
    `Ejemplo: "Quiero 2 bultos de leche y 1 arroz"`;
}

// ─── Manejo de imágenes ─────────────────────────────────────
function generateImageResponse() {
  return `Recibí tu imagen. 📸\n\n` +
    `Si deseas hacer un pedido, por favor escribe los productos en texto.\n\n` +
    `Ejemplo: "Quiero 2 bultos de leche y 1 arroz"`;
}

// ─── Manejo de documentos ────────────────────────────────────
function generateDocumentResponse() {
  return `Recibí tu documento. 📄\n\n` +
    `Si necesitas ayuda, escribe "ayuda" para ver las opciones disponibles.`;
}

// ─── Cola de mensajes ────────────────────────────────────────
async function enqueueMessage(jid, text) {
  messageQueue.push({ jid, text, timestamp: Date.now() });
  if (!processingQueue) {
    await processMessageQueue();
  }
}

async function processMessageQueue() {
  processingQueue = true;
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift();
    try {
      // Evitar mensajes duplicados o muy antiguos
      if (Date.now() - msg.timestamp > 60_000) {
        console.log('[WA-BOT] Mensaje descartado por antigüedad:', msg.jid);
        continue;
      }
      await sock.sendMessage(msg.jid, { text: msg.text });
      // Pequeña pausa entre mensajes para evitar rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error('[WA-BOT] Error enviando mensaje:', err.message);
      // Reintentar una vez más si es error de conexión
      if (err.output?.statusCode === 408 || err.message.includes('Connection')) {
        messageQueue.unshift(msg);
        await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS));
      }
    }
  }
  processingQueue = false;
}

// ─── Procesamiento principal de mensajes ─────────────────────
async function handleIncomingMessage(messageInfo) {
  const { messages, type } = messageInfo;
  if (type !== 'notify') return;

  for (const msg of messages) {
    try {
      // Filtrar mensajes reenviados en reconexión
      if (isForwardedMessage(msg)) {
        console.log('[WA-BOT] Mensaje reenviado/antiguo descartado.');
        continue;
      }

      // Ignorar mensajes propios
      if (msg.key.fromMe) continue;

      // Ignorar mensajes de grupos (por ahora)
      if (msg.key.remoteJid?.includes('@g.us')) continue;

      // Ignorar status broadcasts
      if (msg.key.remoteJid === 'status@broadcast') continue;

      // Resolver LID si es necesario
      const senderJid = msg.key.participant || msg.key.remoteJid;
      const senderNumber = resolveLidUser(senderJid);

      if (!senderNumber) {
        console.warn('[WA-BOT] No se pudo resolver número del remitente:', senderJid);
        // Intentar registrar el mapeo si el JID contiene un número
        const match = senderJid.match(/^(\d+)@/);
        if (match) {
          lidToNumber[senderJid] = match[1];
          saveLidMap();
        }
      }

      // Obtener contenido del mensaje
      const messageContent = msg.message;
      if (!messageContent) continue;

      // Extraer texto según tipo de mensaje
      let text = '';
      let messageType = 'text';

      if (messageContent.conversation) {
        text = messageContent.conversation;
      } else if (messageContent.extendedTextMessage?.text) {
        text = messageContent.extendedTextMessage.text;
      } else if (messageContent.imageMessage?.caption) {
        text = messageContent.imageMessage.caption;
        messageType = 'image';
      } else if (messageContent.videoMessage?.caption) {
        text = messageContent.videoMessage.caption;
        messageType = 'video';
      } else if (messageContent.documentMessage?.caption) {
        text = messageContent.documentMessage.caption;
        messageType = 'document';
      } else if (messageContent.audioMessage) {
        messageType = 'audio';
      } else if (messageContent.stickerMessage) {
        continue; // Ignorar stickers
      }

      console.log(`[WA-BOT] Mensaje de ${senderNumber || senderJid}: "${text}" (${messageType})`);

      // Procesar según tipo de mensaje
      let response;
      const chatJid = msg.key.remoteJid;

      if (messageType === 'audio') {
        response = generateVoiceTranscriptionResponse();
      } else if (messageType === 'image') {
        response = text ? await processTextMessage(text, senderNumber) : generateImageResponse();
      } else if (messageType === 'document') {
        response = text ? await processTextMessage(text, senderNumber) : generateDocumentResponse();
      } else if (messageType === 'video') {
        response = text ? await processTextMessage(text, senderNumber) : generateImageResponse();
      } else {
        response = await processTextMessage(text, senderNumber);
      }

      // Enviar respuesta
      await enqueueMessage(chatJid, response);

      // Marcar como leído
      try {
        await sock.readMessages([msg.key]);
      } catch (e) {
        // Ignorar errores de marcado
      }

    } catch (err) {
      console.error('[WA-BOT] Error procesando mensaje:', err.message);
    }
  }
}

/**
 * Procesa un mensaje de texto y genera la respuesta apropiada.
 */
async function processTextMessage(text, senderNumber) {
  const intent = detectIntent(text);
  console.log(`[WA-BOT] Intención detectada: ${intent}`);

  switch (intent) {
    case INTENTS.SALUDO:
      return generateGreetingResponse();

    case INTENTS.AYUDA:
      return generateHelpResponse();

    case INTENTS.AGRADECIMIENTO:
      return generateThanksResponse();

    case INTENTS.RECLAMO:
      return generateComplaintResponse();

    case INTENTS.CONSULTA_PRECIO: {
      // Extraer nombre del producto del mensaje
      const productQuery = extractProductQuery(text);
      if (!productQuery) {
        return '¿De qué producto quieres saber el precio? Escribe el nombre del producto.';
      }
      const products = searchProducts(db, productQuery, 5);
      return formatProductSearchResults(products, productQuery);
    }

    case INTENTS.PEDIDO: {
      // Parsear ítems del pedido
      const rawItems = parseOrderItems(text);
      if (rawItems.length === 0) {
        return 'No pude identificar los productos. Intenta algo como:\n"Quiero 2 bultos de leche y 1 arroz"';
      }

      // Resolver contra la BD
      const { resolved, notFound } = resolveOrderItems(db, rawItems);

      if (resolved.length === 0) {
        let response = 'No encontré los productos que mencionas. ¿Puedes verificar los nombres?\n\n';
        if (notFound.length > 0) {
          response += 'No encontré: ' + notFound.join(', ');
        }
        return response;
      }

      // Construir respuesta con el resumen del pedido
      const subtotal = resolved.reduce((sum, item) => sum + item.line_total, 0);
      const deliveryFee = 4900;
      const total = subtotal + deliveryFee;

      let response = '*Tu pedido:*\n\n';
      for (const item of resolved) {
        response += `✅ ${item.product_name} x${item.qty} — ${formatPrice(item.line_total)}\n`;
      }

      response += `\n*Subtotal:* ${formatPrice(subtotal)}\n`;
      response += `*Envío:* ${formatPrice(deliveryFee)}\n`;
      response += `*Total:* ${formatPrice(total)}\n`;

      if (notFound.length > 0) {
        response += `\n⚠️ No encontré: *${notFound.join(', ')}*\n`;
        response += `Si estos productos existen, intenta con el nombre completo.\n`;
      }

      response += `\n¿Confirmas el pedido? Responde *"sí"* o *"confirmar"* para continuar.\n`;
      response += `Si quieres agregar más productos, escríbelos.\n`;
      response += `Para cancelar, escribe *"cancelar"*.`;

      // Guardar estado de pedido pendiente de confirmación
      pendingOrders.set(senderNumber, {
        items: resolved,
        rawItems,
        subtotal,
        deliveryFee,
        total,
        notFound,
        timestamp: Date.now(),
      });

      return response;
    }

    case INTENTS.DESCONOCIDO:
    default: {
      // Verificar si es una confirmación de pedido pendiente
      if (isConfirmationMessage(text) && pendingOrders.has(senderNumber)) {
        return await confirmPendingOrder(senderNumber);
      }

      // Verificar si es una cancelación
      if (isCancellationMessage(text) && pendingOrders.has(senderNumber)) {
        pendingOrders.delete(senderNumber);
        return 'Pedido cancelado. ¿Puedo ayudarte con algo más?';
      }

      // Verificar si es un intento de pedido (contiene números + productos)
      const testItems = parseOrderItems(text);
      if (testItems.length > 0) {
        // Parece un pedido, procesarlo como tal
        return await processTextMessage(text, senderNumber);
      }

      return generateUnknownResponse();
    }
  }
}

// ─── Estado de pedidos pendientes ────────────────────────────
const pendingOrders = new Map();

/**
 * Extrae la consulta de producto del mensaje (para búsqueda de precio).
 */
function extractProductQuery(text) {
  const normalized = normalizeText(text);
  // Remover palabras de intención
  const cleaned = normalized
    .replace(/\b(?:cuanto|cuesta|vale|precio|de|el|la|los|las|un|una|unos|unas)\b/g, '')
    .replace(/\?/g, '')
    .trim();
  return cleaned.length > 1 ? cleaned : null;
}

/**
 * Verifica si el mensaje es una confirmación.
 */
function isConfirmationMessage(text) {
  return /\b(?:s[ií]|ok|confirmo|confirmar|dale|as[ií]|perfecto|de acuerdo|afirmativo)\b/i.test(text);
}

/**
 * Verifica si el mensaje es una cancelación.
 */
function isCancellationMessage(text) {
  return /\b(?:cancelar?|cancelo|no\b.*(?:quiero|deseo|necesito)|olv[ií]dalo|nada)\b/i.test(text);
}

/**
 * Confirma un pedido pendiente y lo crea en la BD.
 */
async function confirmPendingOrder(senderNumber) {
  const pending = pendingOrders.get(senderNumber);
  if (!pending) return 'No hay pedido pendiente.';

  if (Date.now() - pending.timestamp > 30 * 60 * 1000) {
    pendingOrders.delete(senderNumber);
    return 'El pedido expiró (más de 30 minutos). Por favor, crea uno nuevo.';
  }

  try {
    const order = createOrder(db, {
      clientPhone: senderNumber || 'desconocido',
      clientName: null,
      items: pending.items,
      fulfillmentType: 'delivery',
      paymentMethod: 'efectivo',
    });

    pendingOrders.delete(senderNumber);

    let response = `✅ *¡Pedido confirmado!*\n\n`;
    response += formatOrderSummary(order);
    response += `\n\n📞 Te contactaremos para confirmar la entrega.`;
    response += `\n💰 Pago: *Efectivo* a la entrega`;
    response += `\n🕐 Tiempo estimado: 30-60 minutos`;
    response += `\n\n*Gracias por comprar en Supermercados Go!* 🛒`;

    // Notificar al admin (opcional, por WebSocket o DB)
    notifyAdminNewOrder(order);

    return response;
  } catch (err) {
    console.error('[WA-BOT] Error creando pedido:', err.message);
    return `Error al crear el pedido: ${err.message}\nPor favor, intenta de nuevo o contacta soporte.`;
  }
}

/**
 * Notifica a los administradores sobre un nuevo pedido.
 * Emite evento WebSocket para actualización en tiempo real.
 */
function notifyAdminNewOrder(order) {
  try {
    const wsService = require('./ws.service');
    if (wsService && typeof wsService.broadcast === 'function') {
      wsService.broadcast({
        type: 'new_order',
        data: {
          id: order.id,
          total: order.total,
          items_count: order.items_count,
          source: 'whatsapp',
          created_at: order.created_at,
        },
      });
    }
  } catch (e) {
    console.warn('[WA-BOT] No se pudo notificar via WebSocket:', e.message);
  }
}

// ─── Conexión Baileys ───────────────────────────────────────
/**
 * Inicia la conexión con WhatsApp usando Baileys multi-device.
 */
async function connect(database) {
  db = database;

  // Asegurar directorio de sesión
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // Cargar mapa LID
  loadLidMap();

  // Importar Baileys dinámicamente (puede no estar instalado)
  let makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion;
  try {
    const baileys = require('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    DisconnectReason = baileys.DisconnectReason;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  } catch (err) {
    console.error('[WA-BOT] Baileys no está instalado. Ejecuta: npm install @whiskeysockets/baileys');
    console.error('[WA-BOT] El bot de WhatsApp no se iniciará.');
    return null;
  }

  if (isConnecting) {
    console.log('[WA-BOT] Ya hay una conexión en progreso.');
    return sock;
  }

  isConnecting = true;
  console.log('[WA-BOT] Iniciando conexión con WhatsApp...');

  const logger = pino({ level: 'silent' });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_STATE_PATH);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true,
    browser: ['Supermercados Go Bot', 'Chrome', '4.0.0'],
    generateHighQualityLinkPreview: false,
    // Configuración para multi-device
    markOnlineOnConnect: true,
    syncFullHistory: false,
    // Filtros para optimizar reconexión
    getMessage: async (key) => {
      // Devolver null para mensajes que no podemos recuperar
      // Esto evita reenvíos innecesarios en reconexión
      return null;
    },
  });

  // ─── Eventos de conexión ───────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[WA-BOT] QR listo para escanear con WhatsApp.');
      console.log('[WA-BOT] Escanea el QR desde la aplicación de WhatsApp en tu teléfono.');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.reason;
      console.log(`[WA-BOT] Conexión cerrada. Razón: ${reason} (código: ${statusCode})`);

      isConnecting = false;
      sock = null;

      // No reconectar si fue logout intencional
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('[WA-BOT] Sesión cerrada. Limpiando archivos de autenticación...');
        try {
          fs.rmSync(AUTH_STATE_PATH, { recursive: true, force: true });
        } catch (e) {
          // Ignorar
        }
        return;
      }

      // Reconexión con backoff exponencial
      const now = Date.now();
      const timeSinceLastDisconnect = now - lastDisconnectTime;
      lastDisconnectTime = now;

      if (timeSinceLastDisconnect < 5000) {
        // Desconexión muy rápida, esperar más
        console.log('[WA-BOT] Desconexión rápida. Esperando 10 segundos...');
        reconnectTimer = setTimeout(() => connect(db), 10_000);
      } else {
        console.log('[WA-BOT] Reconectando en 5 segundos...');
        reconnectTimer = setTimeout(() => connect(db), 5_000);
      }
    }

    if (connection === 'open') {
      isConnecting = false;
      console.log('[WA-BOT] ¡Conectado a WhatsApp!');
      console.log(`[WA-BOT] Número: ${sock.user?.id}`);

      // Procesar mensajes en cola
      if (messageQueue.length > 0) {
        await processMessageQueue();
      }
    }
  });

  // ─── Guardar credenciales al actualizar ────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ─── Manejar mensajes entrantes ────────────────────────────
  sock.ev.on('messages.upsert', handleIncomingMessage);

  // ─── Actualizar mapa de contactos (LID → número) ───────────
  sock.ev.on('contacts.upsert', (contacts) => {
    for (const contact of contacts) {
      if (contact.id && contact.notify) {
        // Intentar resolver LID si tenemos el número
        const phoneMatch = contact.notify?.match(/(\d+)/);
        if (phoneMatch && contact.id.includes('@lid')) {
          registerLidMapping(contact.id, phoneMatch[1]);
        }
      }
    }
  });

  // ─── Manejar actualizaciones de presencia ──────────────────
  sock.ev.on('presence.update', (update) => {
    // Podría usarse para saber si el usuario está escribiendo
  });

  isConnecting = false;
  return sock;
}

/**
 * Desconecta el bot de WhatsApp.
 */
async function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (sock) {
    try {
      sock.end(undefined);
    } catch (e) {
      // Ignorar
    }
    sock = null;
  }

  isConnecting = false;
  console.log('[WA-BOT] Desconectado de WhatsApp.');
}

/**
 * Envía un mensaje a un número específico.
 */
async function sendMessage(to, text) {
  if (!sock) {
    console.warn('[WA-BOT] No hay conexión. Mensaje encolado.');
    messageQueue.push({ jid: `${to}@s.whatsapp.net`, text, timestamp: Date.now() });
    return;
  }

  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

/**
 * Envía confirmación de pedido creado (desde el sistema, no desde el chat).
 */
async function sendOrderConfirmation(to, orderId, items, total) {
  let msg = `✅ *¡Pedido confirmado!*\n\n`;
  msg += `Pedido #${orderId.slice(0, 8)}\n\n`;
  msg += `*Productos:*\n`;
  for (const item of items) {
    msg += `  • ${item.product_name} x${item.qty} — ${formatPrice(item.line_total)}\n`;
  }
  msg += `\n*Total:* ${formatPrice(total)}\n`;
  msg += `\nGracias por comprar en *Supermercados Go* 🛒`;

  await sendMessage(to, msg);
}

/**
 * Envía notificación de pedido en camino.
 */
async function sendOrderOnTheWay(to, orderId, workerName) {
  const msg = `🚀 *¡Tu pedido va en camino!*\n\n` +
    `Pedido #${orderId.slice(0, 8)}\n` +
    `Repartidor: *${workerName}*\n\n` +
    `Estimado de llegada: 30-60 minutos\n` +
    `Ten el pago listo.`;

  await sendMessage(to, msg);
}

/**
 * Envía notificación de pedido listo para recoger.
 */
async function sendOrderReadyForPickup(to, orderId, pickupCode) {
  const msg = `📦 *¡Tu pedido está listo!*\n\n` +
    `Pedido #${orderId.slice(0, 8)}\n` +
    `Código de recogida: *${pickupCode}*\n\n` +
    `Recógelo en: KDX 1-2B Los Mangos, Cúcuta\n` +
    `Horario: 6:00 AM - 6:00 PM`;

  await sendMessage(to, msg);
}

/**
 * Envía notificación de pedido entregado.
 */
async function sendOrderDelivered(to, orderId) {
  const msg = `✅ *¡Pedido entregado!*\n\n` +
    `Pedido #${orderId.slice(0, 8)}\n\n` +
    `Esperamos que disfrutes tu compra.\n` +
    `Si tienes algún problema, escríbenos con "reclamo".\n\n` +
    `¡Gracias por elegir *Supermercados Go*! 🛒`;

  await sendMessage(to, msg);
}

/**
 * Obtiene el estado de la conexión.
 */
function getConnectionStatus() {
  return {
    connected: sock?.user != null,
    connecting: isConnecting,
    user: sock?.user?.id || null,
    pendingMessages: messageQueue.length,
    lidMapSize: Object.keys(lidToNumber).length,
  };
}

// ─── Exportaciones ───────────────────────────────────────────
module.exports = {
  connect,
  disconnect,
  sendMessage,
  sendOrderConfirmation,
  sendOrderOnTheWay,
  sendOrderReadyForPickup,
  sendOrderDelivered,
  getConnectionStatus,
  // Funciones expuestas para testing / uso externo
  detectIntent,
  parseOrderItems,
  searchProducts,
  createOrder,
  INTENTS,
};
