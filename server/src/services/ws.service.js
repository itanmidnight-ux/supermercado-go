// src/services/ws.service.js — Servicio de WebSocket para tiempo real
// Gestiona conexiones de clientes y trabajdores, envío de ubicación GPS, etc.
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');

/**
 * Clase que gestiona todas las conexiones WebSocket activas.
 */
class WsService {
  constructor() {
    /** Mapa de clientes conectados: userId -> { ws, role } */
    this.clients = new Map();
    /** Mapa inverso para buscar userId desde una conexión */
    this.wsToUser = new Map();
    /** Intervalo de ping/pong */
    this.pingInterval = null;
  }

  /**
   * Inicializa el servidor WebSocket con el servidor HTTP de Express.
   * @param {http.Server} server - Servidor HTTP
   */
  init(server) {
    const WebSocket = require('ws');
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      // Obtener token de la query string: ?token=xxx
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(4001, 'Token de autenticación requerido');
        return;
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        const userId = decoded.id;
        const role = decoded.role;

        // Registrar conexión
        this.clients.set(userId, { ws, role });
        this.wsToUser.set(ws, userId);

        // Enviar mensaje de bienvenida
        ws.send(JSON.stringify({ event: 'connected', data: { message: 'Conectado exitosamente', user_id: userId } }));

        // Manejar mensajes entrantes
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw);
            this._handleMessage(userId, role, ws, msg);
          } catch (e) {
            ws.send(JSON.stringify({ event: 'error', data: { message: 'Formato de mensaje inválido' } }));
          }
        });

        // Limpiar al desconectar
        ws.on('close', () => {
          this.clients.delete(userId);
          this.wsToUser.delete(ws);
        });

        ws.on('error', () => {
          this.clients.delete(userId);
          this.wsToUser.delete(ws);
        });
      } catch (err) {
        ws.close(4002, 'Token inválido o expirado');
      }
    });

    // Ping/pong cada 30 segundos para detectar conexiones muertas
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === 1) { // OPEN
          ws.ping();
        }
      });
      // Limpiar conexiones muertas
      for (const [userId, client] of this.clients) {
        if (client.ws.readyState !== 1) {
          this.clients.delete(userId);
          this.wsToUser.delete(client.ws);
        }
      }
    }, 30000);

    console.log('[WS] Servicio WebSocket inicializado en /ws');
  }

  /**
   * Maneja mensajes entrantes de un cliente WebSocket.
   */
  _handleMessage(userId, role, ws, msg) {
    const { event, data } = msg;

    switch (event) {
      case 'worker_location':
        // Solo trabajadores pueden enviar ubicación
        if (role === 'worker' && data) {
          this.broadcastWorkerLocation(userId, data.lat, data.lng, data.order_id);
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ event: 'pong', data: { ts: Date.now() } }));
        break;

      default:
        ws.send(JSON.stringify({ event: 'error', data: { message: `Evento no reconocido: ${event}` } }));
    }
  }

  /**
   * Difunde la ubicación de un trabajador.
   * La ubicación GPS SOLO se envía al admin Y al cliente dueño del pedido activo.
   * @param {string} workerId - ID del trabajador
   * @param {number} lat - Latitud
   * @param {number} lng - Longitud
   * @param {string} orderId - ID del pedido en curso
   */
  broadcastWorkerLocation(workerId, lat, lng, orderId) {
    const payload = {
      event: 'worker_location',
      data: { worker_id: workerId, lat, lng, order_id: orderId },
    };

    // Enviar a todos los admins
    this.sendToAdmins('worker_location', { worker_id: workerId, lat, lng, order_id: orderId });

    // Enviar al cliente dueño del pedido
    if (orderId) {
      try {
        const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(orderId);
        if (order && order.user_id) {
          this.sendToUser(order.user_id, 'worker_location', { worker_id: workerId, lat, lng, order_id: orderId });
        }
      } catch (e) {
        // Silencioso — puede fallar si la tabla aún no existe
      }
    }
  }

  /**
   * Envía un mensaje a un usuario específico.
   */
  sendToUser(userId, event, data) {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({ event, data }));
      return true;
    }
    return false;
  }

  /**
   * Envía un mensaje a todos los administradores conectados.
   */
  sendToAdmins(event, data) {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all();
    let sent = 0;
    for (const admin of admins) {
      if (this.sendToUser(admin.id, event, data)) sent++;
    }
    return sent;
  }

  /**
   * Cierra el servicio WebSocket.
   */
  close() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.wss) {
      this.wss.clients.forEach((ws) => ws.terminate());
      this.wss.close();
    }
    this.clients.clear();
    this.wsToUser.clear();
  }
}

// Instancia singleton
const wsService = new WsService();

module.exports = wsService;
