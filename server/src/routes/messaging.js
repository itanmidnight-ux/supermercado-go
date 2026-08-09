// src/routes/messaging.js — Sistema de mensajería interna estilo WhatsApp
const express = require('express');
const { Router } = express;
const { db } = require('../db');
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

// ─── Migración inline: crear tablas si no existen ────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    archived_by_user1 INTEGER DEFAULT 0,
    archived_by_user2 INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_conv_user1 ON conversations(user1_id);
  CREATE INDEX IF NOT EXISTS idx_conv_user2 ON conversations(user2_id);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_msg_sender ON messages(sender_id);

  CREATE TABLE IF NOT EXISTS message_reads (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    read_at TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(message_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_read_msg ON message_reads(message_id);
`);

// ─── Helper: obtener o crear conversación entre dos usuarios ─
function getOrCreateConversation(userId1, userId2) {
  const [a, b] = [userId1, userId2].sort();
  const existing = db.prepare(
    'SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?'
  ).get(a, b);

  if (existing) return existing;

  const now = nowBogota();
  const id = generateId();
  db.prepare(
    'INSERT INTO conversations (id, user1_id, user2_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, a, b, now, now);

  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

// ─── Helper: obtener usuario opuesto en una conversación ─────
function getOtherUserId(conversation, currentUserId) {
  return conversation.user1_id === currentUserId
    ? conversation.user2_id
    : conversation.user1_id;
}

// ─── Helper: verificar acceso a conversación ─────────────────
function verifyConversationAccess(convId, userId) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
  if (!conv) return null;
  if (conv.user1_id !== userId && conv.user2_id !== userId) return null;
  return conv;
}

// ─── Helper: detectar si un usuario es admin ─────────────────
function isAdmin(userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  return user && user.role === 'admin';
}

/**
 * POST /api/messaging/conversations — Crear conversación o buscar existente
 * Body: { user_id } — el otro participante
 * Si admin, puede enviar a cualquier usuario sin conversación previa (se crea automáticamente)
 */
router.post('/conversations', authMiddleware(), (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'El campo "user_id" es obligatorio' });
  }

  const targetUser = db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(user_id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (user_id === req.user.id) {
    return res.status(400).json({ error: 'No puede crear una conversación consigo mismo' });
  }

  const conversation = getOrCreateConversation(req.user.id, user_id);

  res.json({ data: conversation });
});

/**
 * GET /api/messaging/conversations — Listar conversaciones del usuario autenticado
 * Devuelve cada conversación con el último mensaje y contador de no leídos
 */
router.get('/conversations', authMiddleware(), (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  let whereExtra = '';
  const params = [userId, userId];

  // Admin ve todas las conversaciones, client/worker solo las suyas
  if (role !== 'admin') {
    whereExtra = 'WHERE c.user1_id = ? OR c.user2_id = ?';
  }

  const conversations = db.prepare(`
    SELECT
      c.*,
      u1.name AS user1_name, u1.phone AS user1_phone, u1.role AS user1_role,
      u2.name AS user2_name, u2.phone AS user2_phone, u2.role AS user2_role
    FROM conversations c
    LEFT JOIN users u1 ON u1.id = c.user1_id
    LEFT JOIN users u2 ON u2.id = c.user2_id
    ${whereExtra}
    ORDER BY c.updated_at DESC
  `).all(...params);

  const result = conversations.map((conv) => {
    const otherUserId = getOtherUserId(conv, userId);
    const isArchived = (conv.user1_id === userId && conv.archived_by_user1) ||
                       (conv.user2_id === userId && conv.archived_by_user2);

    const lastMsg = db.prepare(`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ? AND m.deleted = 0
      ORDER BY m.created_at DESC
      LIMIT 1
    `).get(conv.id);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM messages m
      WHERE m.conversation_id = ?
        AND m.sender_id != ?
        AND m.deleted = 0
        AND NOT EXISTS (
          SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?
        )
    `).get(conv.id, userId, userId);

    return {
      id: conv.id,
      other_user: {
        id: otherUserId,
        name: conv.user1_id === userId ? conv.user2_name : conv.user1_name,
        phone: conv.user1_id === userId ? conv.user2_phone : conv.user1_phone,
        role: conv.user1_id === userId ? conv.user2_role : conv.user1_role,
      },
      last_message: lastMsg || null,
      unread_count: unreadCount.count,
      is_archived: !!isArchived,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
    };
  });

  res.json({ data: result });
});

/**
 * GET /api/messaging/conversations/:id — Detalle de conversación
 */
router.get('/conversations/:id', authMiddleware(), (req, res) => {
  const conv = verifyConversationAccess(req.params.id, req.user.id);
  if (!conv && !isAdmin(req.user.id)) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  if (!conv) {
    const convAny = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!convAny) return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  const convData = conv || db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  const otherUserId = getOtherUserId(convData, req.user.id);
  const otherUser = db.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(otherUserId);

  res.json({ data: { ...convData, other_user: otherUser } });
});

/**
 * POST /api/messaging/conversations/:id/messages — Enviar mensaje
 * Body: { type, content, file_url?, file_name?, file_size? }
 * type: 'text' | 'image' | 'file'
 */
router.post('/conversations/:id/messages', authMiddleware(), (req, res) => {
  const conv = verifyConversationAccess(req.params.id, req.user.id);
  if (!conv && !isAdmin(req.user.id)) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  const convData = conv || db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  if (!convData) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  const { type = 'text', content, file_url, file_name, file_size } = req.body;

  if (!content && !file_url) {
    return res.status(400).json({ error: 'El contenido del mensaje es obligatorio' });
  }

  const validTypes = ['text', 'image', 'file'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo de mensaje no válido. Tipos permitidos: ${validTypes.join(', ')}` });
  }

  if (type === 'image' && !file_url) {
    return res.status(400).json({ error: 'Las imágenes requieren un campo "file_url"' });
  }

  const now = nowBogota();
  const msgId = generateId();

  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, type, content, file_url, file_name, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, convData.id, req.user.id, type, content || '', file_url || null, file_name || null, file_size || null, now);

  // Actualizar updated_at de la conversación
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, convData.id);

  const message = db.prepare(`
    SELECT m.*, u.name AS sender_name
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(msgId);

  res.status(201).json({ data: message });
});

/**
 * GET /api/messaging/conversations/:id/messages — Historial de mensajes
 * Query: ?limit=50&before=<message_id> (paginación por cursor)
 */
router.get('/conversations/:id/messages', authMiddleware(), (req, res) => {
  const conv = verifyConversationAccess(req.params.id, req.user.id);
  if (!conv && !isAdmin(req.user.id)) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  const { limit = 50, before } = req.query;
  const lim = Math.min(Number(limit) || 50, 100);

  let where = 'WHERE m.conversation_id = ? AND m.deleted = 0';
  const params = [req.params.id];

  if (before) {
    const cursorMsg = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(before);
    if (cursorMsg) {
      where += ' AND m.created_at < ?';
      params.push(cursorMsg.created_at);
    }
  }

  const messages = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(...params, lim);

  // Marcar como leídos los mensajes recibidos
  const now = nowBogota();
  const markRead = db.prepare(`
    INSERT OR IGNORE INTO message_reads (id, message_id, user_id, read_at) VALUES (?, ?, ?, ?)
  `);

  const unreadMessages = messages.filter(
    (m) => m.sender_id !== req.user.id
  );

  for (const m of unreadMessages) {
    markRead.run(generateId(), m.id, req.user.id, now);
  }

  res.json({ data: messages.reverse() });
});

/**
 * POST /api/messaging/messages/:id/read — Marcar mensaje como leído
 */
router.post('/messages/:id/read', authMiddleware(), (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });

  const conv = verifyConversationAccess(msg.conversation_id, req.user.id);
  if (!conv && !isAdmin(req.user.id)) {
    return res.status(403).json({ error: 'No tiene acceso a esta conversación' });
  }

  const now = nowBogota();
  db.prepare(`
    INSERT OR IGNORE INTO message_reads (id, message_id, user_id, read_at) VALUES (?, ?, ?, ?)
  `).run(generateId(), msg.id, req.user.id, now);

  res.json({ message: 'Mensaje marcado como leído' });
});

/**
 * POST /api/messaging/conversations/:id/read-all — Marcar todos como leídos
 */
router.post('/conversations/:id/read-all', authMiddleware(), (req, res) => {
  const conv = verifyConversationAccess(req.params.id, req.user.id);
  if (!conv && !isAdmin(req.user.id)) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  const now = nowBogota();
  const unreadMessages = db.prepare(`
    SELECT m.id FROM messages m
    WHERE m.conversation_id = ? AND m.sender_id != ? AND m.deleted = 0
      AND NOT EXISTS (
        SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?
      )
  `).all(req.params.id, req.user.id, req.user.id);

  const markRead = db.prepare(`
    INSERT OR IGNORE INTO message_reads (id, message_id, user_id, read_at) VALUES (?, ?, ?, ?)
  `);

  for (const m of unreadMessages) {
    markRead.run(generateId(), m.id, req.user.id, now);
  }

  res.json({ message: 'Todos los mensajes marcados como leídos', count: unreadMessages.length });
});

/**
 * PUT /api/messaging/conversations/:id/archive — Archivar/desarchivar conversación
 */
router.put('/conversations/:id/archive', authMiddleware(), (req, res) => {
  const conv = verifyConversationAccess(req.params.id, req.user.id);
  if (!conv) {
    return res.status(404).json({ error: 'Conversación no encontrada' });
  }

  const field = conv.user1_id === req.user.id ? 'archived_by_user1' : 'archived_by_user2';
  const current = conv[field];
  const newVal = current ? 0 : 1;

  db.prepare(`UPDATE conversations SET ${field} = ?, updated_at = ? WHERE id = ?`)
    .run(newVal, nowBogota(), conv.id);

  res.json({
    message: newVal ? 'Conversación archivada' : 'Conversación desarchivada',
    is_archived: !!newVal,
  });
});

/**
 * DELETE /api/messaging/messages/:id — Soft-delete de mensaje
 * Solo el remitente puede eliminar su propio mensaje
 */
router.delete('/messages/:id', authMiddleware(), (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Mensaje no encontrado' });

  if (msg.sender_id !== req.user.id && !isAdmin(req.user.id)) {
    return res.status(403).json({ error: 'Solo puede eliminar sus propios mensajes' });
  }

  db.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(msg.id);

  res.json({ message: 'Mensaje eliminado' });
});

/**
 * GET /api/messaging/search — Buscar mensajes
 * Query: ?q=texto&conversation_id=opcional
 */
router.get('/search', authMiddleware(), (req, res) => {
  const { q, conversation_id } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'La búsqueda debe tener al menos 2 caracteres' });
  }

  const userId = req.user.id;
  const role = req.user.role;

  let where = `WHERE m.deleted = 0 AND m.content LIKE ?`;
  const params = [`%${q}%`];

  if (conversation_id) {
    // Verificar acceso a esa conversación específica
    if (role !== 'admin') {
      const conv = verifyConversationAccess(conversation_id, userId);
      if (!conv) return res.status(403).json({ error: 'No tiene acceso a esta conversación' });
    }
    where += ' AND m.conversation_id = ?';
    params.push(conversation_id);
  } else if (role !== 'admin') {
    // Solo buscar en conversaciones del usuario
    where += ` AND m.conversation_id IN (
      SELECT id FROM conversations WHERE user1_id = ? OR user2_id = ?
    )`;
    params.push(userId, userId);
  }

  const messages = db.prepare(`
    SELECT m.*, u.name AS sender_name, c.user1_id, c.user2_id
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    LEFT JOIN conversations c ON c.id = m.conversation_id
    ${where}
    ORDER BY m.created_at DESC
    LIMIT 50
  `).all(...params);

  res.json({ data: messages });
});

/**
 * POST /api/messaging/admin/send — Enviar mensaje desde admin a cualquier usuario
 * Body: { user_id, content, type?, file_url?, file_name?, file_size? }
 */
router.post('/admin/send', authMiddleware(['admin']), (req, res) => {
  const { user_id, content, type = 'text', file_url, file_name, file_size } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'El campo "user_id" es obligatorio' });
  }

  const targetUser = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(user_id);
  if (!targetUser) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (!content && !file_url) {
    return res.status(400).json({ error: 'El contenido del mensaje es obligatorio' });
  }

  const conv = getOrCreateConversation(req.user.id, user_id);
  const now = nowBogota();
  const msgId = generateId();

  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, type, content, file_url, file_name, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, conv.id, req.user.id, type, content || '', file_url || null, file_name || null, file_size || null, now);

  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conv.id);

  const message = db.prepare(`
    SELECT m.*, u.name AS sender_name
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(msgId);

  res.status(201).json({ data: message });
});

/**
 * POST /api/messaging/new-chat — Nuevo chat a cualquier número sin conversación previa
 * Body: { phone, content, type?, file_url?, file_name?, file_size? }
 */
router.post('/new-chat', authMiddleware(), (req, res) => {
  const { phone, content, type = 'text', file_url, file_name, file_size } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'El campo "phone" es obligatorio' });
  }

  if (!content && !file_url) {
    return res.status(400).json({ error: 'El contenido del mensaje es obligatorio' });
  }

  // Buscar usuario por teléfono
  const targetUser = db.prepare('SELECT id, name, phone FROM users WHERE phone = ?').get(phone);
  if (!targetUser) {
    return res.status(404).json({ error: 'No se encontró un usuario con ese número de teléfono' });
  }

  if (targetUser.id === req.user.id) {
    return res.status(400).json({ error: 'No puede enviarse un mensaje a sí mismo' });
  }

  const conv = getOrCreateConversation(req.user.id, targetUser.id);
  const now = nowBogota();
  const msgId = generateId();

  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, type, content, file_url, file_name, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, conv.id, req.user.id, type, content || '', file_url || null, file_name || null, file_size || null, now);

  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conv.id);

  const message = db.prepare(`
    SELECT m.*, u.name AS sender_name
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(msgId);

  res.status(201).json({ data: message, conversation_id: conv.id });
});

module.exports = router;
