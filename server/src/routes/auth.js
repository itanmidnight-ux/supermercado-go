const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const { getDB } = require('../db/database');
const { getIP } = require('../utils/ip');
const { raiseAlert } = require('../utils/securityAlert');
const logger = require('../utils/logger');

// ── Brute-force protection ────────────────────────────────────
// key = username (independiente de la IP -- un atacante que rota de IP no
// debe poder seguir probando contraseñas contra la misma cuenta) → { count, lockedUntil }
const attempts = new Map();
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 min
const CLEANUP_EVERY = 10 * 60 * 1000; // purge stale entries

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of attempts) {
    if (val.lockedUntil && val.lockedUntil < now) attempts.delete(key);
  }
}, CLEANUP_EVERY).unref();

function checkLock(key) {
  const a = attempts.get(key);
  if (!a) return null;
  if (a.lockedUntil && Date.now() < a.lockedUntil) {
    const secsLeft = Math.ceil((a.lockedUntil - Date.now()) / 1000);
    return secsLeft;
  }
  return null;
}

function recordFail(key) {
  const a   = attempts.get(key) || { count: 0 };
  a.count  += 1;
  if (a.count >= MAX_ATTEMPTS && !a.lockedUntil) {
    a.lockedUntil = Date.now() + LOCKOUT_MS;
    raiseAlert('brute_force', `Cuenta "${key}" bloqueada 15 minutos por fuerza bruta`);
  }
  attempts.set(key, a);
}

function clearAttempts(key) {
  attempts.delete(key);
}

// ── Helpers ────────────────────────────────────────────────────
function signToken(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, jti },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  return {
    token,
    username:     user.username,
    display_name: user.display_name || user.username,
    role:         user.role,
  };
}

// ── POST /api/auth/token — Login ───────────────────────────────
// El identificador acepta username (admin/worker, sin cambios) O correo
// (clientes que se auto-registran -- ver /register). Un solo campo en la
// app, el backend resuelve cual es sin necesitar que el usuario elija.
router.post('/token', async (req, res, next) => {
  try {
    const { username, password, pin, device_info } = req.body;
    if (!username || typeof username !== 'string' || !username.trim())
      return res.status(400).json({ error: 'Usuario o correo requerido' });

    const credential = password !== undefined
      ? String(password)
      : pin !== undefined ? String(pin) : '';
    if (!credential.length)
      return res.status(400).json({ error: 'Contraseña requerida' });

    const identifier = username.trim().toLowerCase();
    // Bloqueo por CUENTA, no por IP -- ver comentario en la declaracion de `attempts`.
    const lockKey = identifier;

    const secs = checkLock(lockKey);
    if (secs !== null) {
      return res.status(429).json({
        error:     `Cuenta temporalmente bloqueada. Intenta en ${secs} segundos.`,
        retry_in:  secs,
      });
    }

    // El username de un cliente es su celular normalizado (57 + 10 digitos,
    // ver /register) -- si escribe el celular tal cual lo registro (sin el
    // 57 antepuesto) hay que igual encontrar la cuenta.
    const phoneVariant = normalizeAndValidatePhone(identifier) || identifier;

    const db   = getDB();
    const { rows } = await db.query(
      'SELECT * FROM users WHERE (username = $1 OR username = $2 OR email = $3) AND active = 1',
      [identifier, phoneVariant, identifier]
    );
    const user = rows[0];

    if (!user) {
      recordFail(lockKey);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const match = await bcrypt.compare(credential, user.pin || user.password_hash);
    if (!match) {
      recordFail(lockKey);
      const a = attempts.get(lockKey);
      const remaining = Math.max(0, MAX_ATTEMPTS - (a?.count || 0));
      return res.status(401).json({
        error:     'Credenciales incorrectas',
        attempts_left: remaining,
      });
    }
    clearAttempts(lockKey);
    // Hora de entrada -- solo staff (admin/worker); clientes no marcan turno
    if (['admin', 'worker'].includes(user.role)) {
      await db.query(`INSERT INTO login_events (user_id, logged_in_at, device_info) VALUES ($1, now_iso(), $2)`,
        [user.id, device_info ? sanitizeText(device_info, 200) : null]);
    }
    res.json(signToken(user));
  } catch (e) { next(e); }
});

// ── POST /api/auth/logout — Marca la hora de salida ───────────
// JWT es sin estado -- "logout" real solo existe si el cliente lo marca.
// Se actualiza la fila de login_events mas reciente sin salida registrada
// para saber cuando un trabajador se desconecto (control de asistencia).
router.post('/logout', require('../middleware/auth').clientAuth, async (req, res, next) => {
  try {
    const db = getDB();
    // jti viene del token decodificado por el middleware (ver jwtAuth) --
    // si el token es viejo (pre-deploy, sin jti), no hay nada que revocar
    // individualmente; expira solo en su ciclo normal de 30 dias.
    if (req.user.jti) {
      await db.query('INSERT INTO revoked_tokens (jti, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.jti, req.user.id]);
      require('../middleware/auth').mirrorRevocation(req.user.jti);
    }
    // Postgres tampoco soporta ORDER BY/LIMIT en UPDATE -- se resuelve con
    // subquery para agarrar solo la fila abierta mas reciente de ese usuario.
    await db.query(`
      UPDATE login_events SET logged_out_at = now_iso()
      WHERE id = (
        SELECT id FROM login_events
        WHERE user_id = $1 AND logged_out_at IS NULL
        ORDER BY id DESC LIMIT 1
      )
    `, [req.user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/auth/refresh — Renovar token ────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const old  = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!old) return res.status(401).json({ error: 'Token requerido' });

    let payload;
    try {
      // Allow expired tokens (up to 7 extra days) so refresh still works
      payload = jwt.verify(old, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Reject if expired more than 7 days ago
    if (payload.exp && (Date.now() / 1000 - payload.exp) > 7 * 86400) {
      return res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
    }

    const db   = getDB();
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1 AND active = 1', [payload.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    res.json(signToken(user));
  } catch (e) { next(e); }
});

const { sanitizeText } = require('../utils/sanitize');

// Mismo criterio de normalizacion de celular usado en todo el proyecto
// (waBot.js, order_card.dart, message.dart): 10 digitos que empiezan en
// 3 -> se antepone 57. Cualquier otra cosa se rechaza -- no es celular
// colombiano valido.
const { normalizeAndValidatePhone } = require('../utils/phone');

// ── POST /api/auth/register — Self-registration for clients ───
router.post('/register', async (req, res) => {
  const { password, email, display_name, address, phone } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))
    return res.status(400).json({ error: 'Correo electrónico inválido' });
  if (!password || String(password).length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
  if (!display_name || String(display_name).trim().length < 2)
    return res.status(400).json({ error: 'Nombre completo requerido' });
  if (!address || String(address).trim().length < 5)
    return res.status(400).json({ error: 'Dirección de entrega requerida' });

  const normalizedPhone = normalizeAndValidatePhone(phone);
  if (!normalizedPhone)
    return res.status(400).json({ error: 'Número de celular inválido (debe ser un celular colombiano de 10 dígitos, ej: 3138207044)' });

  const db = getDB();
  // El username ya no lo elige el cliente -- se deriva del celular
  // (unico, sin caracteres raros, y sirve de paso para que cart.js
  // pueda usar el mismo valor como telefono real al armar el pedido).
  const name = normalizedPhone;

  const { rows: byUsername } = await db.query('SELECT id FROM users WHERE username = $1', [name]);
  if (byUsername[0]) return res.status(409).json({ error: 'Ese número de celular ya está registrado' });
  const { rows: byEmail } = await db.query('SELECT id FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
  if (byEmail[0]) return res.status(409).json({ error: 'El correo electrónico ya está registrado' });

  const ip      = getIP(req);
  const lockKey = `register:${ip}`;
  const secs    = checkLock(lockKey);
  if (secs !== null)
    return res.status(429).json({ error: `Demasiados intentos. Espera ${secs} segundos.`, retry_in: secs });

  try {
    const hash = await bcrypt.hash(String(password), 10);
    // active=1: la cuenta queda activa de inmediato -- pedir aprobacion
    // manual de un admin por cada registro no era practico. El correo
    // unico (indice UNIQUE en la base) es la validacion real: evita que
    // se repitan cuentas para la misma persona.
    await db.query(
      `INSERT INTO users (username, password_hash, pin, display_name, role, active, email, address, phone)
       VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8)`,
      [
        name, hash, hash,
        sanitizeText(display_name, 100),
        'client',
        String(email).trim().toLowerCase().slice(0, 200),
        sanitizeText(address, 300),
        normalizedPhone,
      ]
    );
    clearAttempts(lockKey);
    res.status(201).json({
      pending: false,
      message: 'Cuenta creada. Ya puedes iniciar sesión con tu correo y contraseña.',
    });
  } catch (e) {
    recordFail(lockKey);
    // UNIQUE (username, email o phone) -- puede pasar por carrera entre
    // el chequeo de arriba y el insert real, aunque sea poco probable.
    // codigo 23505 = unique_violation (estandar SQLSTATE de Postgres).
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ese celular o correo ya está registrado' });
    }
    res.status(500).json({ error: 'Error al crear cuenta' });
  }
});

// ── Recuperación de contraseña por correo (OTP 6 dígitos) ──────
// Un solo código activo por usuario, vence a los 5 minutos, se guarda
// hasheado (nunca en claro), máximo 5 intentos de verificación por código.
const RESET_CODE_TTL_MS         = 5 * 60 * 1000;
const RESET_MAX_VERIFY_ATTEMPTS = 5;

function generateResetCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function hashResetCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// POST /api/auth/forgot-password — { email } → envía código si la cuenta existe
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  // Respuesta genérica siempre igual -- no revela si el correo está o no
  // registrado (evita enumeración de cuentas).
  const generic = { message: 'Si el correo está registrado, recibirás un código de verificación.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Correo inválido' });

  const ip      = getIP(req);
  const lockKey = `reset-req:${ip}`;
  const secs    = checkLock(lockKey);
  if (secs !== null)
    return res.status(429).json({ error: `Demasiados intentos. Espera ${secs} segundos.`, retry_in: secs });

  try {
    const db = getDB();
    const { rows } = await db.query(
      `SELECT id, display_name FROM users WHERE email = $1 AND role = 'client' AND active = 1`, [email]
    );
    const user = rows[0];
    if (user) {
      const code = generateResetCode();
      await db.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
      const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
      await db.query(
        'INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, hashResetCode(code), expiresAt]
      );
      const { sendMail } = require('../services/emailService');
      sendMail({
        to: email,
        subject: 'Código de recuperación — Supermercado GO',
        html: `<div style="font-family:sans-serif">
          <p>Hola${user.display_name ? ' ' + user.display_name : ''},</p>
          <p>Tu código de recuperación de contraseña es:</p>
          <h2 style="letter-spacing:6px">${code}</h2>
          <p>Vence en 5 minutos. Si no solicitaste esto, ignora este correo.</p>
        </div>`,
      }).catch(e => logger.error({ err: e.message }, '[auth] no se pudo enviar código de recuperación'));
    }
    recordFail(lockKey); // limita peticiones por IP igual exista o no el correo
    res.json(generic);
  } catch (e) {
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// POST /api/auth/reset-password — { email, code, new_password }
router.post('/reset-password', async (req, res) => {
  const email       = String(req.body?.email || '').trim().toLowerCase();
  const code        = String(req.body?.code || '').trim();
  const newPassword = req.body?.new_password;

  if (!email || !/^\d{6}$/.test(code))
    return res.status(400).json({ error: 'Datos inválidos' });
  if (!newPassword || String(newPassword).length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });

  const ip      = getIP(req);
  const lockKey = `reset-verify:${ip}`;
  const secs    = checkLock(lockKey);
  if (secs !== null)
    return res.status(429).json({ error: `Demasiados intentos. Espera ${secs} segundos.`, retry_in: secs });

  try {
    const db = getDB();
    const { rows } = await db.query(
      `SELECT id FROM users WHERE email = $1 AND role = 'client' AND active = 1`, [email]
    );
    const user = rows[0];
    if (!user) { recordFail(lockKey); return res.status(400).json({ error: 'Código inválido o vencido' }); }

    const { rows: resetRows } = await db.query(
      `SELECT * FROM password_resets WHERE user_id = $1 AND used = 0 ORDER BY id DESC LIMIT 1`, [user.id]
    );
    const reset = resetRows[0];
    if (!reset || new Date(reset.expires_at).getTime() < Date.now()) {
      recordFail(lockKey);
      return res.status(400).json({ error: 'Código inválido o vencido' });
    }
    if (reset.attempts >= RESET_MAX_VERIFY_ATTEMPTS)
      return res.status(429).json({ error: 'Demasiados intentos con este código. Solicita uno nuevo.' });

    if (hashResetCode(code) !== reset.code_hash) {
      await db.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [reset.id]);
      recordFail(lockKey);
      return res.status(400).json({ error: 'Código inválido o vencido' });
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    await db.query('UPDATE users SET password_hash = $1, pin = $1 WHERE id = $2', [hash, user.id]);
    await db.query('UPDATE password_resets SET used = 1 WHERE id = $1', [reset.id]);
    clearAttempts(lockKey);
    res.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (e) {
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

module.exports = router;
