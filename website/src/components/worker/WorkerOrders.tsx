'use client';

import React, { useEffect, useState } from 'react';
import { Package, MapPin, Clock, DollarSign, User, Phone, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkerStore } from '../../store/worker-store';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function WorkerOrders() {
  const { availableOrders, fetchAvailableOrders, claimOrder, loading } = useWorkerStore();
  const token = useAuthStore((s) => s.token)!;
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchAvailableOrders(token);
  }, [token]);

  const handleClaim = async (orderId: string) => {
    setClaiming(orderId);
    await claimOrder(token, orderId);
    setClaiming(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pedidos Disponibles</h1>
          <p className="text-gray-400 text-sm mt-1">{availableOrders.length} pedidos para entregar</p>
        </div>
        <button
          onClick={() => fetchAvailableOrders(token)}
          className="flex items-center gap-2 bg-[#FF8C00]/10 hover:bg-[#FF8C00]/20 text-[#FF8C00] px-3 py-2 rounded-xl text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading && availableOrders.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-[#FF8C00] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : availableOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium">No hay pedidos disponibles</p>
          <p className="text-gray-500 text-sm mt-1">Los nuevos pedidos aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableOrders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#111520] rounded-xl border border-white/5 p-4 hover:border-[#FF8C00]/30 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-bold text-sm">Pedido #{String(order.id).slice(-6)}</p>
                  <p className="text-gray-500 text-[10px]">{new Date(order.created_at).toLocaleString('es-CO')}</p>
                </div>
                <span className="text-[#00B860] font-bold text-sm">{formatCOP(order.total)}</span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-300 text-xs">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  {order.customer_name || 'Cliente'}
                </div>
                <div className="flex items-center gap-2 text-gray-300 text-xs">
                  <Phone className="w-3.5 h-3.5 text-gray-500" />
                  {order.customer_phone || order.phone || 'Sin teléfono'}
                </div>
                <div className="flex items-center gap-2 text-gray-300 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <span className="truncate">{order.address || order.delivery_address || 'Sin dirección'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300 text-xs">
                  <Package className="w-3.5 h-3.5 text-gray-500" />
                  {order.items?.length || 0} productos
                </div>
              </div>

              {order.delivery_lat && order.delivery_lng && (
                <div className="mb-3 p-2 bg-[#00B860]/10 rounded-lg">
                  <p className="text-[#00B860] text-[10px] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Ubicación del cliente disponible
                  </p>
                </div>
              )}

              <button
                onClick={() => handleClaim(String(order.id))}
                disabled={claiming === String(order.id)}
                className="w-full py-2.5 bg-[#FF8C00] hover:bg-[#e67700] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {claiming === String(order.id) ? 'Tomando pedido...' : 'Tomar Pedido'}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
