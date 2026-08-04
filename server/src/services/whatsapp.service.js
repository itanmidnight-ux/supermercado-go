// src/services/whatsapp.service.js — Integración con WhatsApp Cloud API
// Todas las funciones son no-op cuando WA_ENABLED=false
const config = require('../config');

const WA_BASE = 'https://graph.facebook.com/v18.0';

/**
 * Envía un mensaje de plantilla por WhatsApp.
 * @param {string} to - Número de destino (formato: 573XXXXXXXXX)
 * @param {string} templateName - Nombre de la plantilla
 * @param {string[]} params - Parámetros de la plantilla
 */
async function sendMessage(to, templateName, params = []) {
  if (!config.whatsapp.enabled) {
    console.log(`[WA] Deshabilitado. Mensaje NO enviado a ${to}: ${templateName}`);
    return { success: false, reason: 'WhatsApp deshabilitado' };
  }

  if (!config.whatsapp.accessToken || !config.whatsapp.phoneId) {
    console.log('[WA] Faltan credenciales de WhatsApp Cloud API.');
    return { success: false, reason: 'Credenciales no configuradas' };
  }

  try {
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es' },
        components: params.length > 0 ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }] : [],
      },
    };

    const response = await fetch(`${WA_BASE}/${config.whatsapp.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('[WA] Error enviando mensaje:', JSON.stringify(result));
      return { success: false, error: result };
    }
    return { success: true, data: result };
  } catch (err) {
    console.error('[WA] Error de conexión:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Maneja un mensaje entrante de WhatsApp.
 */
async function handleIncomingMessage(from, message) {
  if (!config.whatsapp.enabled) return;

  console.log(`[WA] Mensaje recibido de ${from}: ${JSON.stringify(message)}`);
  // Aquí se podría implementar lógica de respuestas automáticas
}

/**
 * Envía confirmación de pedido creado.
 */
async function sendOrderConfirmation(orderId) {
  if (!config.whatsapp.enabled) return;
  // Buscar datos del pedido y cliente para personalizar el mensaje
  return sendMessage(null, 'confirmacion_pedido', [orderId]);
}

/**
 * Envía notificación de pedido en camino.
 */
async function sendOrderOnTheWay(orderId, workerName) {
  if (!config.whatsapp.enabled) return;
  return sendMessage(null, 'pedido_en_camino', [orderId, workerName]);
}

/**
 * Envía notificación de pedido listo para recoger.
 */
async function sendOrderReadyForPickup(orderId, pickupCode) {
  if (!config.whatsapp.enabled) return;
  return sendMessage(null, 'pedido_listo_recoger', [orderId, pickupCode]);
}

/**
 * Envía notificación de pedido entregado.
 */
async function sendOrderDelivered(orderId) {
  if (!config.whatsapp.enabled) return;
  return sendMessage(null, 'pedido_entregado', [orderId]);
}

module.exports = {
  sendMessage,
  handleIncomingMessage,
  sendOrderConfirmation,
  sendOrderOnTheWay,
  sendOrderReadyForPickup,
  sendOrderDelivered,
};
