// src/routes/import-products.js — Importador inteligente de productos desde Excel
// Heuristicas avanzadas (IA local sin API externa) para mapeo automatico de columnas,
// deteccion de categorias, duplicados y valores. Todo offline.
const express = require('express');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { roundCOP } = require('../utils/money');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

// ─── Upload config ────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  },
});

// ─── Column mapping heuristics ─────────────────────────────────
const COLUMN_DEFS = {
  name: {
    synonyms: ['nombre', 'name', 'producto', 'product', 'articulo', 'item', 'descripcion', 'product name', 'item name', 'nombre producto', 'producto nombre', 'titulo', 'title'],
    required: true,
    sanitize: function (v) { return String(v).trim(); },
    validate: function (v) { return (!v || v.length < 2) ? 'Nombre demasiado corto (min. 2 caracteres)' : null; },
  },
  description: {
    synonyms: ['descripcion', 'description', 'detalle', 'detail', 'notas', 'notes', 'descripcion producto', 'caracteristicas', 'info'],
    sanitize: function (v) { return String(v).trim(); },
  },
  price: {
    synonyms: ['precio', 'price', 'valor', 'costo venta', 'precio venta', 'pvp', 'precio publico', 'precio unitario', 'unit price', 'precio final'],
    required: true,
    sanitize: function (v) { return roundCOP(parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0); },
    validate: function (v) { return (!v || v <= 0) ? 'Precio debe ser mayor a 0' : null; },
  },
  stock: {
    synonyms: ['stock', 'cantidad', 'quantity', 'inventario', 'inventory', 'existencias', 'disponible', 'unidades', 'qty', 'cant', 'existencia'],
    sanitize: function (v) { return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; },
  },
  sku: {
    synonyms: ['sku', 'codigo', 'code', 'codigo producto', 'product code', 'codigo interno', 'item code', 'cod', 'id producto'],
    sanitize: function (v) { return String(v).trim(); },
  },
  barcode: {
    synonyms: ['codigo de barras', 'barcode', 'ean', 'upc', 'codigo barra', 'cod barras', 'gtin', 'scan code', 'scanner'],
    sanitize: function (v) { return String(v).trim().replace(/\s/g, ''); },
  },
  unit: {
    synonyms: ['unidad', 'unit', 'um', 'u/m', 'medida', 'unidad medida', 'unidad de medida', 'presentacion', 'presentacion'],
    sanitize: function (v) {
      var val = String(v).trim().toLowerCase();
      var map = { unidad: 'un', unidades: 'un', un: 'un', und: 'un', kg: 'kg', kilo: 'kg', kilogramo: 'kg', g: 'g', gramo: 'g', lb: 'lb', libra: 'lb', l: 'lt', lt: 'lt', litro: 'lt', ml: 'ml', mililitro: 'ml', pz: 'pz', pieza: 'pz', doc: 'doc', docena: 'doc', paquete: 'paq', paq: 'paq' };
      return map[val] || val.substring(0, 3);
    },
  },
  brand: {
    synonyms: ['marca', 'brand', 'fabricante', 'manufacturer', 'marca producto'],
    sanitize: function (v) { return String(v).trim(); },
  },
  category_id: {
    synonyms: ['categoria', 'category', 'categoria producto', 'product category', 'tipo', 'type', 'linea', 'familia', 'family', 'seccion', 'departamento', 'section', 'department', 'categorie', 'categoria'],
    sanitize: function (v) { return String(v).trim(); },
  },
  image_url: {
    synonyms: ['imagen', 'image', 'foto', 'photo', 'url imagen', 'image url', 'link imagen', 'picture'],
    sanitize: function (v) { return v ? String(v).trim() : null; },
  },
  is_offer: {
    synonyms: ['oferta', 'offer', 'en oferta', 'descuento', 'discount', 'promocion', 'promotion'],
    sanitize: function (v) {
      var s = String(v).toLowerCase();
      return (s === 'si' || s === 's' || s === 'yes' || s === 'true' || s === '1' || s === 'x') ? 1 : 0;
    },
  },
  tax_rate: {
    synonyms: ['iva', 'tax', 'impuesto', 'tasas', 'tax rate', 'vat', 'arancel'],
    sanitize: function (v) { return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; },
  },
};

// ─── String similarity (Levenshtein normalized) ───────────────
function levenshtein(s1, s2) {
  var m = s1.length, n = s2.length;
  var dp = [];
  for (var i = 0; i <= m; i++) {
    dp[i] = [];
    for (var j = 0; j <= n; j++) {
      if (i === 0) { dp[i][j] = j; }
      else if (j === 0) { dp[i][j] = i; }
      else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1)
        );
      }
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  var l1 = a.toLowerCase(), l2 = b.toLowerCase();
  return 1 - levenshtein(l1, l2) / Math.max(l1.length, l2.length);
}

// ─── Smart column mapping ──────────────────────────────────────
function smartColumnMapping(headers) {
  // Two-pass strategy: pass 1 assigns required+high-confidence matches
  // Pass 2 fills in optional fields with remaining columns

  var mapping = {};
  var used = new Set();

  // Ordered field list: required first (name, price), then others
  var fields = Object.keys(COLUMN_DEFS);
  // Prioritize category_id and required fields first
  var priority = ['name', 'price', 'category_id', 'description', 'sku', 'barcode', 'stock', 'unit', 'brand', 'image_url', 'is_offer', 'tax_rate'];

  // PASS 1: high-confidence matches (>0.85)
  for (var pi = 0; pi < priority.length; pi++) {
    var dbField = priority[pi];
    var colDef = COLUMN_DEFS[dbField];
    if (!colDef) continue;

    var bestScore = -1;
    var bestIdx = -1;

    for (var i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      var header = (headers[i] || '').toLowerCase().trim();
      for (var si = 0; si < colDef.synonyms.length; si++) {
        var score = similarity(header, colDef.synonyms[si].toLowerCase());
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    // High-confidence match
    if (bestScore >= 0.85 && bestIdx >= 0) {
      mapping[dbField] = bestIdx;
      used.add(bestIdx);
    }
  }

  // PASS 2: remaining columns for optional fields (0.6 threshold)
  for (var pi2 = 0; pi2 < priority.length; pi2++) {
    var dbField2 = priority[pi2];
    if (mapping[dbField2] !== undefined) continue;

    var colDef2 = COLUMN_DEFS[dbField2];
    if (!colDef2) continue;

    var bestScore2 = -1;
    var bestIdx2 = -1;

    for (var i2 = 0; i2 < headers.length; i2++) {
      if (used.has(i2)) continue;
      var header2 = (headers[i2] || '').toLowerCase().trim();
      for (var si2 = 0; si2 < colDef2.synonyms.length; si2++) {
        var score2 = similarity(header2, colDef2.synonyms[si2].toLowerCase());
        if (score2 > bestScore2) {
          bestScore2 = score2;
          bestIdx2 = i2;
        }
      }
    }

    if (bestScore2 >= 0.6 && bestIdx2 >= 0 && !colDef2.required) {
      mapping[dbField2] = bestIdx2;
      used.add(bestIdx2);
    }
  }

  return mapping;
}

// ─── Category resolver (fuzzy match + auto-create) ────────────
function resolveCategory(name) {
  if (!name) return null;
  var n = name.trim();
  if (!n) return null;

  // Exact match
  var cat = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND is_active = 1').get(n);
  if (cat) return cat.id;

  // Fuzzy match
  var allCats = db.prepare('SELECT id, name FROM categories WHERE is_active = 1').all();
  for (var i = 0; i < allCats.length; i++) {
    if (similarity(allCats[i].name.toLowerCase(), n.toLowerCase()) >= 0.7) {
      return allCats[i].id;
    }
  }

  // Auto-create
  var now = nowBogota();
  var id = generateId();
  var max = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
  var sortOrder = (max.m || 0) + 1;

  db.prepare('INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)')
    .run(id, n, sortOrder, now);

  console.log('[IMPORT] Nueva categoria: ' + n + ' (id: ' + id + ')');
  return id;
}

// ─── Find existing product by SKU, barcode, or name ───────────
function findExisting(sku, barcode, name) {
  if (sku) {
    var r = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
    if (r) return r.id;
  }
  if (barcode) {
    var r2 = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
    if (r2) return r2.id;
  }
  var r3 = db.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND is_active = 1').get(name);
  if (r3) return r3.id;
  return null;
}

// ─── POST /api/products/import-excel ──────────────────────────
router.post('/import-excel', authMiddleware(['admin']), upload.single('file'), function (req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Se requiere un archivo Excel' });
  }

  try {
    var workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      sheetRows: 10001,
    });
    var sheetName = workbook.SheetNames[0];
    var sheet = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!data.length) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    var headers = data[0].map(function (h) { return String(h).trim(); });
    var rows = data.slice(1).filter(function (r) {
      return r.some(function (cell) { return String(cell).trim() !== ''; });
    });

    if (rows.length > 10000) {
      return res.status(400).json({ error: 'El archivo no puede superar las 10.000 filas' });
    }

    if (!rows.length) {
      return res.status(400).json({ error: 'No se encontraron datos en el archivo' });
    }

    // STEP 1: smart mapping
    var colMap = smartColumnMapping(headers);

    // Check required fields
    var missing = [];
    var fields = Object.keys(COLUMN_DEFS);
    for (var fi = 0; fi < fields.length; fi++) {
      var def = COLUMN_DEFS[fields[fi]];
      if (def.required && colMap[fields[fi]] === undefined) {
        missing.push(def.synonyms[0]);
      }
    }
    if (missing.length) {
      return res.status(400).json({
        error: 'No se pudieron identificar las columnas: ' + missing.join(', '),
        detected_headers: headers,
      });
    }

    // Build human mapping report
    var mappingReport = {};
    var mappedFields = Object.keys(colMap);
    for (var mi = 0; mi < mappedFields.length; mi++) {
      var field = mappedFields[mi];
      mappingReport[field] = headers[colMap[field]];
    }

    // STEP 2: Process rows in transaction
    var results = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      mapping: mappingReport,
    };

    var now = nowBogota();

    var insertStmt = db.prepare(
      'INSERT INTO products (id, name, description, price, cost, compare_price, stock, stock_min, stock_max, sku, barcode, category_id, image, brand, unit, tax_rate, is_weighed, is_offer, offer_price, supplier_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    var updateStmt = db.prepare(
      'UPDATE products SET description=?, price=?, cost=?, stock=?, sku=?, barcode=?, category_id=?, image=?, brand=?, unit=?, tax_rate=?, is_offer=?, updated_at=? WHERE id=?'
    );

    function processRow(row, rowIndex) {
      var excelRow = rowIndex + 2; // 1-based + header row
      try {
        // Extract and sanitize
        var product = {};
        var rowFields = Object.keys(colMap);
        for (var i = 0; i < rowFields.length; i++) {
          var field = rowFields[i];
          var idx = colMap[field];
          var raw = idx !== undefined ? String(row[idx] || '') : '';
          var colDef = COLUMN_DEFS[field];
          product[field] = colDef.sanitize(raw);
        }

        // Validate required fields
        if (!product.name) {
          results.errors.push('Fila ' + excelRow + ': Nombre vacio');
          results.skipped++;
          return;
        }

        if (!product.price || product.price <= 0) {
          results.errors.push('Fila ' + excelRow + ': Precio invalido (' + String(product.price) + ')');
          results.skipped++;
          return;
        }

        // Validate any custom rules
        var hasError = false;
        for (var fi2 = 0; fi2 < rowFields.length; fi2++) {
          var f = rowFields[fi2];
          var def = COLUMN_DEFS[f];
          if (def.validate && product[f] !== undefined) {
            var msg = def.validate(product[f]);
            if (msg) {
              results.errors.push('Fila ' + excelRow + ': ' + msg);
              results.skipped++;
              hasError = true;
              break;
            }
          }
        }
        if (hasError) return;

        // Resolve category
        var categoryId = resolveCategory(product.category_id);

        // Find existing
        var existingId = findExisting(product.sku, product.barcode, product.name);

        if (existingId) {
          // UPDATE
          updateStmt.run(
            product.description || null,
            product.price,
            0, // cost
            product.stock || 0,
            product.sku || null,
            product.barcode || null,
            categoryId || null,
            product.image_url || null,
            product.brand || null,
            product.unit || 'un',
            product.tax_rate || 0,
            product.is_offer || 0,
            now,
            existingId
          );
          results.updated++;
        } else {
          // CREATE
          var id = generateId();
          insertStmt.run(
            id,
            product.name,
            product.description || null,
            product.price,
            0, // cost
            0, // compare_price
            product.stock || 0,
            0, // stock_min
            null, // stock_max
            product.sku || null,
            product.barcode || null,
            categoryId || null,
            product.image_url || null,
            product.brand || null,
            product.unit || 'un',
            product.tax_rate || 0,
            0, // is_weighed
            product.is_offer || 0,
            null, // offer_price
            null, // supplier_id
            now,
            now
          );
          results.created++;
        }
      } catch (err) {
        results.errors.push('Fila ' + excelRow + ': ' + err.message);
        results.skipped++;
      }
    }

    // Execute inside transaction
    db.transaction(function () {
      for (var i = 0; i < rows.length; i++) {
        processRow(rows[i], i);
      }
    })();

    res.json({
      message: 'Importacion completada: ' + results.created + ' creados, ' + results.updated + ' actualizados, ' + results.skipped + ' omitidos',
      results: results,
    });
  } catch (err) {
    console.error('[Import] Error:', err.message);
    if (err.message && err.message.indexOf('Excel') >= 0) {
      return res.status(400).json({ error: 'El archivo no es un Excel valido (.xlsx o .xls)' });
    }
    res.status(500).json({ error: 'Error procesando el archivo: ' + err.message });
  }
});

// ─── POST /api/products/preview-excel ─────────────────────────
router.post('/preview-excel', authMiddleware(['admin']), upload.single('file'), function (req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Se requiere un archivo Excel' });
  }

  try {
    var workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    var sheetName = workbook.SheetNames[0];
    var sheet = workbook.Sheets[sheetName];
    var data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!data.length) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    var headers = data[0].map(function (h) { return String(h).trim(); });
    var rows = data.slice(1).filter(function (r) {
      return r.some(function (cell) { return String(cell).trim() !== ''; });
    });

    var colMap = smartColumnMapping(headers);

    var mappingReport = {};
    var mappedFields = Object.keys(colMap);
    for (var i = 0; i < mappedFields.length; i++) {
      mappingReport[mappedFields[i]] = headers[colMap[mappedFields[i]]];
    }

    // First 5 rows as sample
    var sample = [];
    var limit = Math.min(rows.length, 5);
    for (var ri = 0; ri < limit; ri++) {
      var mapped = {};
      for (var fi = 0; fi < mappedFields.length; fi++) {
        var field = mappedFields[fi];
        var idx = colMap[field];
        mapped[field] = idx !== undefined ? String(rows[ri][idx] || '') : '';
      }
      sample.push(mapped);
    }

    res.json({
      sheet: sheetName,
      total_rows: rows.length,
      detected_headers: headers,
      mapping: mappingReport,
      sample: sample,
    });
  } catch (err) {
    console.error('[Preview] Error:', err.message);
    res.status(500).json({ error: 'Error procesando el archivo: ' + err.message });
  }
});

module.exports = router;
