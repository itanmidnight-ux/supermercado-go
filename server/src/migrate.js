// src/migrate.js — Ejecutor de migraciones para la base de datos
// Cada migración es idempotente (CREATE TABLE IF NOT EXISTS / ALTER TABLE IF NOT EXISTS)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const config = require('./config');
const dbPath = path.resolve(config.dbPath);

// Asegurar directorio
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ─── Tabla de control de migraciones ────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

function getAppliedVersions() {
  const rows = db.prepare('SELECT version FROM schema_migrations').all();
  return new Set(rows.map(r => r.version));
}

function markApplied(version) {
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, now);
}

/**
 * Verifica si una columna existe en una tabla.
 * Usado para migraciones ALTER TABLE idempotentes.
 */
function columnExists(db, table, column) {
  const info = db.pragma(`table_info(${table})`);
  return info.some(col => col.name === column);
}

// ─── Migraciones ────────────────────────────────────────────

const migrations = [];

// 001 — Tablas iniciales
migrations.push({
  version: 1,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin','worker','client')),
        avatar TEXT,
        fcm_token TEXT,
        is_active INTEGER DEFAULT 1,
        earnings REAL DEFAULT 0,
        doc_type TEXT,
        doc_number TEXT,
        must_change_password INTEGER DEFAULT 0,
        accepted_privacy_at TEXT,
        last_login_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        cost REAL DEFAULT 0,
        compare_price REAL DEFAULT 0,
        stock REAL DEFAULT 0,
        stock_min REAL DEFAULT 0,
        stock_max REAL,
        sku TEXT,
        barcode TEXT UNIQUE,
        category_id TEXT REFERENCES categories(id),
        image TEXT,
        unit TEXT DEFAULT 'un',
        tax_rate REAL DEFAULT 0,
        is_weighed INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        is_offer INTEGER DEFAULT 0,
        offer_price REAL,
        brand TEXT,
        expiry_date TEXT,
        supplier_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        items TEXT DEFAULT '[]',
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','preparing','ready','assigned','in_transit','delivered','cancelled','picked_up')),
        subtotal INTEGER DEFAULT 0,
        delivery_fee INTEGER DEFAULT 0,
        discount INTEGER DEFAULT 0,
        tax_total INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        payment_method TEXT DEFAULT 'efectivo',
        payment_status TEXT DEFAULT 'pending',
        delivery_address TEXT,
        delivery_lat REAL,
        delivery_lng REAL,
        fulfillment_type TEXT DEFAULT 'delivery' CHECK(fulfillment_type IN ('delivery','pickup')),
        pickup_code TEXT,
        pickup_ready_at TEXT,
        scheduled_for TEXT,
        worker_id TEXT REFERENCES users(id),
        client_name TEXT,
        client_phone TEXT,
        worker_name TEXT,
        cancelled_reason TEXT,
        cancelled_by TEXT,
        rating INTEGER,
        rating_comment TEXT,
        invoice_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_history (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        status TEXT NOT NULL,
        changed_by TEXT REFERENCES users(id),
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_worker ON orders(worker_id);
      CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id);
      CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
    `);
  }
});

// 002 — Tabla order_items (separada de la columna items legacy)
migrations.push({
  version: 2,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        product_id TEXT REFERENCES products(id),
        product_name TEXT NOT NULL,
        product_sku TEXT,
        unit TEXT DEFAULT 'un',
        qty REAL NOT NULL CHECK(qty > 0),
        unit_price INTEGER NOT NULL,
        discount INTEGER DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount INTEGER DEFAULT 0,
        line_total INTEGER NOT NULL,
        qty_delivered REAL DEFAULT 0,
        status TEXT DEFAULT 'ok' CHECK(status IN ('ok','sustituido','faltante','devuelto')),
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
    `);

    // Migrar datos de orders.items (JSON) a order_items si es necesario
    const orders = db.prepare(`
      SELECT id, items FROM orders
      WHERE items IS NOT NULL AND items != '[]'
      AND id NOT IN (SELECT DISTINCT order_id FROM order_items)
    `).all();

    if (orders.length > 0) {
      const insertItem = db.prepare(
        'INSERT INTO order_items (id, order_id, product_id, product_name, product_sku, unit, qty, unit_price, discount, tax_rate, tax_amount, line_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const now = new Date().toISOString();
      const insertMany = db.transaction((items) => {
        for (const item of items) {
          insertItem.run(
            uuidv4(), item.order_id, item.product_id || '', item.name || '',
            item.sku || '', item.unit || 'un', item.qty || 0,
            Math.round(item.price || 0), Math.round(item.discount || 0),
            item.tax_rate || 0, Math.round(item.tax_amount || 0),
            Math.round(item.total || 0), now
          );
        }
      });

      const allItems = [];
      for (const order of orders) {
        try {
          const parsed = JSON.parse(order.items);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              allItems.push({
                order_id: order.id,
                product_id: item.product_id || item.id || '',
                name: item.name || item.product_name || '',
                sku: item.sku || '',
                unit: item.unit || 'un',
                qty: item.qty || item.quantity || 0,
                price: item.price || item.unit_price || 0,
                discount: item.discount || 0,
                tax_rate: item.tax_rate || 0,
                tax_amount: item.tax_amount || 0,
                total: item.total || item.line_total || 0,
              });
            }
          }
        } catch (e) {
          // JSON inválido, saltar
        }
      }
      if (allItems.length > 0) {
        insertMany(allItems);
      }
    }
  }
});

// 003 — Movimientos de inventario
migrations.push({
  version: 3,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id),
        type TEXT NOT NULL CHECK(type IN ('compra','venta','ajuste','devolucion','merma','vencimiento','traslado','inicial')),
        qty REAL NOT NULL,
        stock_before REAL NOT NULL,
        stock_after REAL NOT NULL,
        unit_cost REAL DEFAULT 0,
        reference_type TEXT,
        reference_id TEXT,
        user_id TEXT REFERENCES users(id),
        reason TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_movements(type);
      CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_movements(created_at);
    `);
  }
});

// 004 — Direcciones de clientes
migrations.push({
  version: 4,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS addresses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        label TEXT,
        address TEXT NOT NULL,
        detail TEXT,
        neighborhood TEXT,
        city TEXT DEFAULT 'Cúcuta',
        lat REAL,
        lng REAL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
    `);
  }
});

// 005 — Proveedores
migrations.push({
  version: 5,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nit TEXT,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );
    `);
  }
});

// 006 — Compras a proveedores
migrations.push({
  version: 6,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        supplier_id TEXT REFERENCES suppliers(id),
        invoice_number TEXT,
        subtotal INTEGER DEFAULT 0,
        tax_total INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente','recibida','anulada')),
        user_id TEXT REFERENCES users(id),
        received_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchase_items (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL REFERENCES purchases(id),
        product_id TEXT REFERENCES products(id),
        qty REAL NOT NULL,
        unit_cost INTEGER NOT NULL,
        line_total INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
    `);
  }
});

// 007 — Pagos
migrations.push({
  version: 7,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id),
        method TEXT NOT NULL CHECK(method IN ('efectivo','nequi','daviplata','tarjeta','pse','bold')),
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente','aprobado','rechazado','reembolsado')),
        provider TEXT,
        provider_ref TEXT,
        raw_response TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    `);
  }
});

// 008 — Facturación
migrations.push({
  version: 8,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        order_id TEXT REFERENCES orders(id),
        type TEXT DEFAULT 'factura',
        prefix TEXT DEFAULT 'SETP',
        number INTEGER NOT NULL,
        full_number TEXT NOT NULL UNIQUE,
        resolution_number TEXT,
        resolution_from INTEGER,
        resolution_to INTEGER,
        resolution_valid_until TEXT,
        customer_doc_type TEXT,
        customer_doc TEXT,
        customer_name TEXT,
        customer_email TEXT,
        customer_address TEXT,
        subtotal INTEGER DEFAULT 0,
        discount_total INTEGER DEFAULT 0,
        tax_total INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        payment_method TEXT,
        cufe TEXT,
        qr_data TEXT,
        xml_path TEXT,
        pdf_path TEXT,
        dian_status TEXT DEFAULT 'pendiente',
        dian_response TEXT,
        dian_sent_at TEXT,
        issued_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id),
        product_id TEXT,
        description TEXT NOT NULL,
        qty REAL NOT NULL,
        unit_price INTEGER NOT NULL,
        discount INTEGER DEFAULT 0,
        tax_rate REAL DEFAULT 0,
        tax_amount INTEGER DEFAULT 0,
        line_total INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(full_number);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    `);
  }
});

// 009 — Notificaciones
migrations.push({
  version: 9,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        body TEXT,
        type TEXT,
        data_json TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at);
    `);
  }
});

// 010 — Promociones
migrations.push({
  version: 10,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS promotions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('porcentaje','monto_fijo','envio_gratis','2x1')),
        value REAL NOT NULL,
        min_order INTEGER DEFAULT 0,
        max_uses INTEGER,
        uses INTEGER DEFAULT 0,
        starts_at TEXT,
        ends_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
      CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
    `);
  }
});

// 011 — Sesiones de caja
migrations.push({
  version: 11,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cash_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        opening_amount INTEGER DEFAULT 0,
        expected_amount INTEGER,
        counted_amount INTEGER,
        difference INTEGER,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_cash_sessions_user ON cash_sessions(user_id);
    `);
  }
});

// 012 — Registro de auditoría
migrations.push({
  version: 12,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        action TEXT NOT NULL,
        entity TEXT,
        entity_id TEXT,
        before_json TEXT,
        after_json TEXT,
        ip TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
    `);
  }
});

// 013 — Campos adicionales (ALTER TABLE idempotente) + seed admin
migrations.push({
  version: 13,
  up() {
    // ── Campos adicionales para products ──
    const productCols = {
      sku: 'TEXT',
      barcode: 'TEXT UNIQUE',
      cost: 'REAL DEFAULT 0',
      tax_rate: 'REAL DEFAULT 0',
      stock_min: 'REAL DEFAULT 0',
      stock_max: 'REAL',
      is_weighed: 'INTEGER DEFAULT 0',
      expiry_date: 'TEXT',
      supplier_id: 'TEXT',
      brand: 'TEXT',
    };
    for (const [col, typeDef] of Object.entries(productCols)) {
      if (!columnExists(db, 'products', col)) {
        db.exec(`ALTER TABLE products ADD COLUMN ${col} ${typeDef}`);
      }
    }

    // ── Campos adicionales para orders ──
    const orderCols = {
      fulfillment_type: "TEXT DEFAULT 'delivery' CHECK(fulfillment_type IN ('delivery','pickup'))",
      pickup_code: 'TEXT',
      pickup_ready_at: 'TEXT',
      scheduled_for: 'TEXT',
      cancelled_reason: 'TEXT',
      cancelled_by: 'TEXT',
      rating: 'INTEGER',
      rating_comment: 'TEXT',
      invoice_id: 'TEXT',
      client_name: 'TEXT',
      client_phone: 'TEXT',
      worker_name: 'TEXT',
    };
    for (const [col, typeDef] of Object.entries(orderCols)) {
      if (!columnExists(db, 'orders', col)) {
        db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${typeDef}`);
      }
    }

    // ── Campos adicionales para users ──
    const userCols = {
      doc_type: 'TEXT',
      doc_number: 'TEXT',
      must_change_password: 'INTEGER DEFAULT 0',
      accepted_privacy_at: 'TEXT',
      last_login_at: 'TEXT',
    };
    for (const [col, typeDef] of Object.entries(userCols)) {
      if (!columnExists(db, 'users', col)) {
        db.exec(`ALTER TABLE users ADD COLUMN ${col} ${typeDef}`);
      }
    }

    // ── Seed: crear admin si no existe ──
    const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (!adminExists) {
      const adminId = uuidv4();
      const randomPassword = crypto.randomBytes(12).toString('hex');
      const hash = require('crypto').createHash('sha256').update(randomPassword).digest('hex');
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, name, email, phone, password, role, is_active, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, ?, ?)
      `).run(
        adminId,
        'Administrador',
        'admin@supermercadosgo.com',
        '+573044016277',
        hash,
        now,
        now
      );

      // Guardar credenciales en archivo seguro
      const credPath = path.join(dbDir, 'PRIMER_ACCESO.txt');
      const credContent = `═══════════════════════════════════════════\n  SUPERMERCADOS GO — Primer Acceso Admin\n═══════════════════════════════════════════\n\nEmail:    admin@supermercadosgo.com\nContraseña: ${randomPassword}\n\nIMPORTANTE: Cambie la contraseña después del primer ingreso.\n═══════════════════════════════════════════\n`;
      fs.writeFileSync(credPath, credContent, { mode: 0o600 });
      console.log(`[MIGRATE] Admin creado. Credenciales en: ${credPath}`);
      console.log(`[MIGRATE] Email: admin@supermercadosgo.com`);
      console.log(`[MIGRATE] Contraseña: ${randomPassword}`);
      console.log('[MIGRATE] ⚠ Cambie la contraseña después del primer ingreso.');
    }
  }
});

// ─── Migración 014: Banners (carrusel personalizable) ──────────
migrations.push({
  version: 14,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS banners (
        id            TEXT PRIMARY KEY,
        title         TEXT NOT NULL,
        subtitle      TEXT,
        image_url     TEXT,
        link_type     TEXT DEFAULT 'none' CHECK(link_type IN ('none','category','product','promo','url')),
        link_value    TEXT,
        bg_color      TEXT DEFAULT '#00B860',
        text_color    TEXT DEFAULT '#FFFFFF',
        sort_order    INTEGER DEFAULT 0,
        is_active     INTEGER DEFAULT 1,
        starts_at     TEXT,
        ends_at       TEXT,
        created_at    TEXT DEFAULT (datetime('now','localtime')),
        updated_at    TEXT DEFAULT (datetime('now','localtime'))
      )
    `);

    // Seed banners por defecto
    const existing = db.prepare('SELECT COUNT(*) as c FROM banners').get();
    if (existing.c === 0) {
      const now = new Date().toISOString();
      const insertBanner = db.prepare(
        'INSERT INTO banners (id, title, subtitle, image_url, bg_color, text_color, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const seedBanners = db.transaction(() => {
        insertBanner.run(uuidv4(), 'Compra fácil desde tu casa!', 'Encuentra todo lo que necesitas con delivery en Cúcuta', '', '#00B860', '#FFFFFF', 1, 1, now, now);
        insertBanner.run(uuidv4(), 'Ofertas de la semana', 'Aprovecha descuentos exclusivos en tus productos favoritos', '', '#FF8C00', '#FFFFFF', 2, 1, now, now);
        insertBanner.run(uuidv4(), 'Pago fácil y seguro', 'Aceptamos efectivo, Nequi, Daviplata, tarjeta y más', '', '#1a7a3a', '#FFFFFF', 3, 1, now, now);
        insertBanner.run(uuidv4(), 'Recoge en tienda', 'Pide en línea y recoge sin filas en KDX 1-2B Los Mangos', '', '#FFD93D', '#333333', 4, 1, now, now);
      });
      seedBanners();
    }
  }
});

// ─── Migración 015: Configuración extendida (zona de entrega) ───
migrations.push({
  version: 15,
  up() {
    const defaults = [
      ['delivery_zones', '["Cúcuta","Los Patios","Villa del Rosario","Pamplonita","El Zulia"]'],
      ['delivery_zone_enabled', 'true'],
      ['delivery_info_text', 'Realizamos entregas en Cúcuta y zonas aledañas. El tiempo estimado es de 30-60 minutos según la distancia.'],
      ['delivery_info_link', ''],
      ['how_to_buy_text', '1. Regístrate con tu correo y teléfono\n2. Agrega productos al carrito\n3. Elige entrega a domicilio o recoger en tienda\n4. Paga con el método que prefieras\n5. ¡Recibe tu pedido!'],
      ['app_welcome_message', '¡Bienvenido a Supermercados Go!\nTu supermercado en línea, donde vayas.'],
      ['min_order_amount', '0'],
    ];
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    for (const [key, value] of defaults) {
      insert.run(key, value, now);
    }
  }
});

// ─── Migración 016: Favoritos de usuarios ────────────────
migrations.push({
  version: 16,
  up() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        created_at TEXT NOT NULL,
        UNIQUE(user_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_favorites_product ON favorites(product_id);
    `);
  }
});

// ─── Ejecutar migraciones ────────────────────────────────────
function runMigrations() {
  const applied = getAppliedVersions();
  const pending = migrations.filter(m => !applied.has(m.version));

  if (pending.length === 0) {
    console.log('[MIGRATE] Base de datos actualizada. No hay migraciones pendientes.');
    return;
  }

  console.log(`[MIGRATE] Ejecutando ${pending.length} migración(es) pendiente(s)...`);

  for (const migration of pending) {
    console.log(`[MIGRATE] Aplicando migración ${String(migration.version).padStart(3, '0')}...`);
    try {
      migration.up();
      markApplied(migration.version);
      console.log(`[MIGRATE] ✓ Migración ${String(migration.version).padStart(3, '0')} aplicada correctamente.`);
    } catch (err) {
      console.error(`[MIGRATE] ✗ Error en migración ${String(migration.version).padStart(3, '0')}:`, err.message);
      process.exit(1);
    }
  }

  console.log('[MIGRATE] Todas las migraciones aplicadas exitosamente.');
}

// Ejecutar directamente si se corre con node src/migrate.js
if (require.main === module) {
  runMigrations();
  db.close();
} else {
  // Exportar para uso desde index.js
  module.exports = { runMigrations, db: () => db };
}
