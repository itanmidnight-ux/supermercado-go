// src/services/notification.service.js — Servicio de notificaciones push y en-app
const { generateId } = require('../utils/ids');
const { nowBogota } = require('../utils/dates');
const { db } = require('../db');

/**
 * Envía una notificación push (FCM). Por ahora es un placeholder.
 * @param {string} userId - ID del usuario destinatario
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo de la notificación
 * @param {Object} data - Datos adicionales
 */
async function sendPush(userId, title, body, data = {}) {
  // Obtener token FCM del usuario
  const user = db.prepare('SELECT fcm_token FROM users WHERE id = ?').get(userId);
  if (!user || !user.fcm_token) {
    return { success: false, reason: 'Sin token FCM registrado' };
  }

  // En producción se enviaría via FCM Admin SDK
  console.log(`[NOTIF] Push a ${userId}: ${title} — ${body}`);
  return { success: true };
}

/**
 * Envía notificación de cambio de estado de pedido.
 */
async function sendOrderStatusChange(orderId, newStatus) {
  const order = db.prepare(`
    SELECT o.*, u.name as client_name, w.name as worker_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN users w ON w.id = o.worker_id
    WHERE o.id = ?
  `).get(orderId);

  if (!order) return;

  const statusMessages = {
    confirmed: 'Tu pedido ha sido confirmado y está siendo preparado.',
    preparing: 'Tu pedido está siendo preparado.',
    ready: 'Tu pedido está listo.',
    assigned: 'Un domiciliario ha sido asignado a tu pedido.',
    in_transit: 'Tu pedido está en camino.',
    delivered: 'Tu pedido ha sido entregado. ¡Gracias por tu compra!',
    cancelled: 'Tu pedido ha sido cancelado.',
    picked_up: 'Tu pedido ha sido recogido exitosamente.',
  };

  const title = `Pedido #${orderId.substring(0, 8)}`;
  const body = statusMessages[newStatus] || `El estado de tu pedido cambió a: ${newStatus}`;

  // Notificar al cliente
  if (order.user_id) {
    await sendPush(order.user_id, title, body, { order_id: orderId, status: newStatus });
    createNotification(db, order.user_id, title, body, 'order_status', JSON.stringify({ order_id: orderId, status: newStatus }));
  }

  // Notificar al trabajador si aplica
  if (newStatus === 'assigned' && order.worker_id) {
    await sendPush(order.worker_id, 'Nuevo pedido asignado', `Pedido #${orderId.substring(0, 8)} asignado a ti.`, { order_id: orderId });
    createNotification(db, order.worker_id, 'Nuevo pedido asignado', `Se te asignó el pedido #${orderId.substring(0, 8)}`, 'order_assigned', JSON.stringify({ order_id: orderId }));
  }
}

/**
 * Crea un registro de notificación en la base de datos.
 */
function createNotification(dbConn, userId, title, body, type, dataJson) {
  const id = generateId();
  dbConn.prepare(`
    INSERT INTO notifications (id, user_id, title, body, type, data_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, body, type || null, dataJson || null, nowBogota());
  return { id, user_id: userId, title };
}

module.exports = {
  sendPush,
  sendOrderStatusChange,
  createNotification,
};
