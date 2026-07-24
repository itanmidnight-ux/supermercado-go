'use strict';
const { getDB } = require('../db/database');
const logger = require('./logger');

// Reusa la misma cola que ya usa /api/messages/send y securityAlert.js
// (tabla messages, direction='outbound', sent=0) -- waBot.js pollOutbound
// ya la drena solo, cero codigo nuevo en el bot.
const STATUS_TEXT = {
  en_camino: order => `🛵 Tu pedido #${order.id} va en camino.`,
  entregado: order => `✅ Tu pedido #${order.id} fue entregado. ¡Gracias por tu compra!`,
  cancelled: order => `❌ Tu pedido #${order.id} fue cancelado.${order.cancel_reason ? ` Motivo: ${order.cancel_reason}` : ''}`,
};

// orders.js espera esta promesa antes de responder -- un solo INSERT es
// despreciable en latencia y así se garantiza que la notificación ya está
// encolada cuando el cliente recibe la respuesta (sin esto, un GET
// /messages inmediatamente después podía no ver todavía el mensaje nuevo).
// Aun así atrapa sus propios errores: un fallo al encolar la notificación
// no debe tumbar la respuesta del cambio de estado del pedido, que ya se
// aplicó correctamente en la base de datos.
async function notifyOrderStatus(order) {
  const build = STATUS_TEXT[order.status];
  if (!build || !order.phone) return;
  try {
    const db = getDB();
    await db.query(`
      INSERT INTO messages (phone, content, direction, sent, type)
      VALUES ($1, $2, 'outbound', 0, 'order_status')
    `, [order.phone, build(order)]);
    logger.info({ orderId: order.id, status: order.status }, '[orderNotify] notificacion encolada');
  } catch (e) {
    logger.error({ err: e.message, orderId: order.id }, '[orderNotify] fallo al encolar notificacion');
  }
}

module.exports = { notifyOrderStatus };
