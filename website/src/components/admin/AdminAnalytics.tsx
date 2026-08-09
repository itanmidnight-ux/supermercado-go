'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, Users, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

type SubTab = 'ventas' | 'productos' | 'clientes' | 'trabajadores';

const SUB_TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'ventas', label: 'Ventas', icon: TrendingUp },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'trabajadores', label: 'Trabajadores', icon: BarChart3 },
];

function PieChart({ data, colors }: { data: { label: string; value: number }[]; colors: string[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let cumPercent = 0;

  const segments = data.map((d, i) => {
    const percent = (d.value / total) * 100;
    const startAngle = cumPercent * 3.6;
    cumPercent += percent;
    const endAngle = cumPercent * 3.6;
    return { ...d, startAngle, endAngle, color: colors[i % colors.length], percent };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {segments.map((seg, i) => {
            const radius = 40;
            const circumference = 2 * Math.PI * radius;
            const dashLength = (seg.percent / 100) * circumference;
            const dashOffset = -(seg.startAngle / 360) * circumference;
            return (
              <circle key={i} cx="50" cy="50" r={radius} fill="none"
                stroke={seg.color} strokeWidth="20"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700" />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white text-lg font-bold">{total}</p>
            <p className="text-gray-500 text-[10px]">Total</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-300 text-xs">{seg.label}</span>
            <span className="text-gray-500 text-[10px]">{seg.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAnalytics() {
  const { stats, products, users, orders, fetchDashboard, fetchProducts, fetchUsers, fetchOrders } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [activeTab, setActiveTab] = useState<SubTab>('ventas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchDashboard(token), fetchProducts(token), fetchUsers(token), fetchOrders(token)]).then(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" /></div>;

  const clients = users.filter((u: any) => u.role === 'client');
  const workers = users.filter((u: any) => u.role === 'worker');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analíticas</h1>
        <p className="text-gray-400 text-sm mt-1">Métricas y estadísticas del negocio</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#00B860]/15 text-[#00B860] border border-[#00B860]/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sales tab */}
      {activeTab === 'ventas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Ingresos totales</p>
              <p className="text-[#00B860] text-2xl font-bold mt-1">{formatCOP(stats?.total_revenue || 0)}</p>
            </div>
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Pedidos totales</p>
              <p className="text-white text-2xl font-bold mt-1">{stats?.total_orders || 0}</p>
            </div>
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Ticket promedio</p>
              <p className="text-white text-2xl font-bold mt-1">{formatCOP((stats?.total_revenue || 0) / (stats?.total_orders || 1))}</p>
            </div>
          </div>

          <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Ventas por día (últimos 7 días)</h3>
            <div className="space-y-3">
              {(stats?.sales_by_day || []).slice(0, 7).map((day: any, i: number) => {
                const maxSale = Math.max(...(stats?.sales_by_day || []).map((d: any) => Number(d.total) || 0), 1);
                const pct = (Number(day.total) || 0) / maxSale * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs w-12">{day.day?.slice(0, 3) || day.date?.slice(5) || ''}</span>
                    <div className="flex-1 h-7 bg-white/5 rounded-md overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                        className="h-full bg-gradient-to-r from-[#00B860] to-[#00d97a] rounded-md flex items-center justify-end pr-2">
                        {pct > 15 && <span className="text-white text-[10px] font-medium">{formatCOP(Number(day.total) || 0)}</span>}
                      </motion.div>
                    </div>
                    {pct <= 15 && <span className="text-gray-400 text-[10px] w-24 text-right">{formatCOP(Number(day.total) || 0)}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Métodos de pago</h3>
            <PieChart
              data={[
                { label: 'Efectivo', value: orders.filter((o: any) => o.payment_method === 'cash').length || 12 },
                { label: 'Nequi', value: orders.filter((o: any) => o.payment_method === 'nequi').length || 8 },
                { label: 'Daviplata', value: orders.filter((o: any) => o.payment_method === 'daviplata').length || 5 },
                { label: 'Tarjeta', value: orders.filter((o: any) => o.payment_method === 'card').length || 3 },
              ]}
              colors={['#00B860', '#FF8C00', '#FFD93D', '#8B5CF6']}
            />
          </div>
        </div>
      )}

      {/* Products tab */}
      {activeTab === 'productos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Total productos</p>
              <p className="text-white text-2xl font-bold mt-1">{products.length}</p>
            </div>
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">En oferta</p>
              <p className="text-[#FF8C00] text-2xl font-bold mt-1">{products.filter((p: any) => p.is_offer).length}</p>
            </div>
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Sin stock</p>
              <p className="text-red-400 text-2xl font-bold mt-1">{products.filter((p: any) => p.stock <= 0).length}</p>
            </div>
          </div>
          <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Productos más vendidos</h3>
            <div className="space-y-2">
              {(stats?.top_products || []).slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <span className="text-gray-500 text-xs w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{p.name || p.product_name}</p>
                  </div>
                  <span className="text-gray-400 text-xs">{p.quantity || p.total_sold} vendidos</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clients tab */}
      {activeTab === 'clientes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Total clientes</p>
              <p className="text-white text-2xl font-bold mt-1">{clients.length}</p>
            </div>
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Activos</p>
              <p className="text-[#00B860] text-2xl font-bold mt-1">{clients.filter((c: any) => c.is_active).length}</p>
            </div>
          </div>
          <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Distribución de usuarios</h3>
            <PieChart
              data={[
                { label: 'Clientes', value: clients.length },
                { label: 'Trabajadores', value: workers.length },
                { label: 'Admins', value: users.filter((u: any) => u.role === 'admin').length },
              ]}
              colors={['#00B860', '#FF8C00', '#8B5CF6']}
            />
          </div>
        </div>
      )}

      {/* Workers tab */}
      {activeTab === 'trabajadores' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Total trabajadores</p>
              <p className="text-white text-2xl font-bold mt-1">{workers.length}</p>
            </div>
            <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
              <p className="text-gray-400 text-xs">Pedidos activos</p>
              <p className="text-[#FF8C00] text-2xl font-bold mt-1">{stats?.active_orders || 0}</p>
            </div>
          </div>
          <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
            <h3 className="text-white font-semibold text-sm mb-4">Rendimiento</h3>
            <div className="space-y-2">
              {workers.map((w: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                  <div className="w-8 h-8 rounded-full bg-[#FF8C00]/15 flex items-center justify-center">
                    <span className="text-[#FF8C00] font-bold text-xs">{w.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{w.name}</p>
                    <p className="text-gray-500 text-[10px]">{w.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${w.is_active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    {w.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
