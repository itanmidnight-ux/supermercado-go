'use strict';
const express = require('express');
const router  = express.Router();
const { adminAuth, clientAuth } = require('../middleware/auth');
const { getDB } = require('../db/database');
const { settingsCache } = require('../utils/memoryCache');

// GET /api/settings/public — nombre/logo/colores de marca, sin auth. Lo
// necesita la pantalla de login (todavía no hay sesión ahí) para mostrar
// la marca real configurada en vez de quedarse con el fallback fijo del
// código -- nada de esto es sensible (a diferencia de nequi_phone, emails,
// dominios, etc. que solo se devuelven autenticado).
router.get('/public', async (req, res, next) => {
  try {
    const settings = await settingsCache.wrap('public', 60_000, async () => {
      const keys = ['theme_name', 'theme_primary', 'theme_accent', 'theme_logo_url'];
      const { rows } = await getDB().query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
      const out = {};
      rows.forEach(r => { out[r.key] = r.value; });
      return out;
    });
    res.json({ settings });
  } catch (e) { next(e); }
});

// GET /api/settings — get all settings (admin) or public subset (client)
router.get('/', clientAuth, async (req, res, next) => {
  try {
    const db = getDB();
    if (req.user.role === 'admin') {
      const settings = await settingsCache.wrap('admin', 30_000, async () => {
        const { rows } = await db.query('SELECT key, value FROM settings');
        const out = {};
        rows.forEach(r => { out[r.key] = r.value; });
        return out;
      });
      return res.json({ settings });
    }
    // Clients only get nequi_phone + nequi_name + empresa_nombre + horario_atencion + contact_*
    const settings = await settingsCache.wrap('client', 60_000, async () => {
      const allowed = ['nequi_phone', 'nequi_name', 'empresa_nombre', 'horario_atencion', 'empresa_descripcion',
                       'contact_phone', 'contact_email', 'contact_address', 'contact_instagram', 'contact_facebook'];
      const { rows } = await db.query('SELECT key, value FROM settings WHERE key = ANY($1)', [allowed]);
      const out = {};
      rows.forEach(r => { out[r.key] = r.value; });
      return out;
    });
    res.json({ settings });
  } catch (e) { next(e); }
});

const ALLOWED_SETTINGS_KEYS = [
  'nequi_phone', 'nequi_name',
  'empresa_nombre', 'empresa_descripcion', 'horario_atencion',
  'theme_primary', 'theme_accent', 'theme_name',
  'server_domain', 'extra_domains',
  'contact_phone', 'contact_email', 'contact_address',
  'contact_instagram', 'contact_facebook',
];

// Dominio suelto (sin protocolo), opcionalmente con :puerto. Usado tanto para
// server_domain (uno) como cada entrada separada por coma de extra_domains.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(:[0-9]{1,5})?$/i;

function validateDomainSetting(key, strVal) {
  if (key !== 'server_domain' && key !== 'extra_domains') return null;
  if (!strVal) return null; // vacio = quitar/deshabilitar, valido
  const entries = strVal.split(',').map(d => d.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')).filter(Boolean);
  if (key === 'server_domain' && entries.length > 1) return 'server_domain acepta un solo dominio';
  for (const d of entries) {
    if (!DOMAIN_RE.test(d)) return `dominio inválido: "${d}" (formato esperado: midominio.com, sin protocolo ni rutas)`;
  }
  return null;
}

// PUT /api/settings — update setting (admin only)
router.put('/', adminAuth, async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key y value requeridos' });
    if (!ALLOWED_SETTINGS_KEYS.includes(key))
      return res.status(400).json({ error: `key inválido. Permitidos: ${ALLOWED_SETTINGS_KEYS.join(', ')}` });
    const strVal = String(value).trim();
    if (strVal.length > 500) return res.status(400).json({ error: 'value máximo 500 caracteres' });
    const domainErr = validateDomainSetting(key, strVal);
    if (domainErr) return res.status(400).json({ error: domainErr });
    await getDB().query(`
      INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `, [key, strVal]);
    settingsCache.flush();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const LOGO_DIR = path.join(process.env.APPDATA || process.env.HOME, 'pedidos-bot', 'branding');
if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

const logoUpload = multer({
  dest: LOGO_DIR,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

// POST /api/settings/logo — subir logo de marca (admin only)
router.post('/logo', adminAuth, logoUpload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const filename = `logo_${Date.now()}.${ext}`;
    fs.renameSync(req.file.path, path.join(LOGO_DIR, filename));
    await getDB().query(`INSERT INTO settings (key, value) VALUES ('theme_logo_url', $1)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [filename]);
    settingsCache.flush();
    res.json({ filename });
  } catch (e) { next(e); }
});

// GET /api/settings/logo/:filename — servir el logo (publico, no es dato sensible)
router.get('/logo/:filename', (req, res) => {
  const filepath = path.join(LOGO_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Logo no encontrado' });
  res.sendFile(filepath);
});

module.exports = router;
