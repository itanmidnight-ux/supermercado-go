'use client';

import React, { useEffect, useState } from 'react';
import {
  DollarSign, ShoppingCart, Users, TrendingUp, Package,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle, Truck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

const fadeIn = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  preparing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ready: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  delivering: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function AdminDashboard() {
  const { stats, fetchDashboard } = useAdminStore();
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchDashboard(token).then(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: 'Ingresos totales', value: formatCOP(stats?.total_revenue || 0), icon: DollarSign, color: 'text-[#00B860]', bg: 'bg-[#00B860]/10' },
    { label: 'Pedidos totales', value: (stats?.total_orders || 0).toString(), icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Usuarios', value: (stats?.total_users || 0).toString(), icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { label: 'Pedidos activos', value: (stats?.active_orders || 0).toString(), icon: Truck, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Vista general del negocio</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-[#111520] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                {i === 0 && <TrendingUp className="w-4 h-4 text-green-400" />}
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-gray-400 text-xs mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales chart placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111520] rounded-xl border border-white/5 p-5"
        >
          <h3 className="text-white font-semibold text-sm mb-4">Ventas (últimos 7 días)</h3>
          <div className="space-y-3">
            {(stats?.sales_by_day || []).slice(0, 7).map((day: any, i: number) => {
              const maxSale = Math.max(...(stats?.sales_by_day || []).map((d: any) => Number(d.total) || 0), 1);
              const pct = (Number(day.total) || 0) / maxSale * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs w-8">{day.day?.slice(0, 3) || day.date?.slice(5) || ''}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                      className="h-full bg-gradient-to-r from-[#00B860] to-[#00d97a] rounded-md"
                    />
                  </div>
                  <span className="text-white text-xs font-medium w-24 text-right">{formatCOP(Number(day.total) || 0)}</span>
                </div>
              );
            })}
            {(!stats?.sales_by_day || stats.sales_by_day.length === 0) && (
              <p className="text-gray-500 text-sm text-center py-8">Sin datos de ventas aún</p>
            )}
          </div>
        </motion.div>

        {/* Top products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#111520] rounded-xl border border-white/5 p-5"
        >
          <h3 className="text-white font-semibold text-sm mb-4">Productos más vendidos</h3>
          <div className="space-y-3">
            {(stats?.top_products || []).slice(0, 5).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#00B860]/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-[#00B860]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{p.name || p.product_name}</p>
                  <p className="text-gray-400 text-[10px]">{p.quantity || p.total_sold} vendidos</p>
                </div>
                <span className="text-[#00B860] text-xs font-medium">{formatCOP(Number(p.revenue) || 0)}</span>
              </div>
            ))}
            {(!stats?.top_products || stats.top_products.length === 0) && (
              <p className="text-gray-500 text-sm text-center py-8">Sin datos de productos aún</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent orders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-[#111520] rounded-xl border border-white/5 p-5"
      >
        <h3 className="text-white font-semibold text-sm mb-4">Pedidos recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium py-3 px-3 text-xs">#</th>
                <th className="text-left text-gray-400 font-medium py-3 px-3 text-xs">Cliente</th>
                <th className="text-left text-gray-400 font-medium py-3 px-3 text-xs">Total</th>
                <th className="text-left text-gray-400 font-medium py-3 px-3 text-xs">Estado</th>
                <th className="text-left text-gray-400 font-medium py-3 px-3 text-xs">Hora</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent_orders || []).map((order: any, i: number) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 text-gray-300 font-mono text-xs">#{String(order.id).slice(-6)}</td>
                  <td className="py-3 px-3 text-white text-xs">{order.customer_name || order.user_name || '—'}</td>
                  <td className="py-3 px-3 text-[#00B860] font-medium text-xs">{formatCOP(order.total || 0)}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[order.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-400 text-xs">{order.created_at ? new Date(order.created_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                </tr>
              ))}
              {(!stats?.recent_orders || stats.recent_orders.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-8 text-gray-500 text-center text-sm">Sin pedidos recientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
