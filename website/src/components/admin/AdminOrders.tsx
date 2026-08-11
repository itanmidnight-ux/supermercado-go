'use client';

import React, { useEffect, useState } from 'react';
import { Search, Eye, Truck, CheckCircle, XCircle, Clock, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  { value: 'confirmed', label: 'Confirmado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: CheckCircle },
  { value: 'preparing', label: 'Preparando', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Package },
  { value: 'ready', label: 'Listo', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Truck },
  { value: 'delivering', label: 'En camino', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', icon: Truck },
  { value: 'delivered', label: 'Entregado', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${s.color}`}>
      <s.icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

export function AdminOrders() {
  const { orders, fetchOrders, updateOrderStatus } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [detailOrder, setDetailOrder] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    fetchOrders(token).then(() => setLoading(false));
  }, [token]);

  const filtered = orders.filter((o: any) => {
    const matchSearch = !search ||
      String(o.id).includes(search) ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.phone?.includes(search);
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try { await updateOrderStatus(token, orderId, newStatus); } catch (e: any) { alert('Error: ' + e.message); }
  };

  const statusCounts = orders.reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pedidos</h1>
        <p className="text-gray-400 text-sm mt-1">{orders.length} pedidos totales</p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'all' ? 'bg-[#00B860]/15 text-[#00B860] border border-[#00B860]/30' : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'}`}
        >
          Todos ({orders.length})
        </button>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s.value ? s.color + ' border' : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'}`}
          >
            {s.label} ({statusCounts[s.value] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por ID, nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#111520] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#00B860]/50"
        />
      </div>

      {/* Orders table */}
      <div className="bg-[#111520] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">#</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Cliente</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Items</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Total</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Estado</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Fecha</th>
                <th className="text-right text-gray-400 font-medium py-3 px-4 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o: any) => (
                <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <span className="text-gray-300 font-mono text-xs">#{String(o.id).slice(-6)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-white text-xs">{o.customer_name || o.user_name || '—'}</p>
                      <p className="text-gray-500 text-[10px]">{o.phone || o.user_email || ''}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-300 text-xs">{o.item_count || o.items?.length || 0}</td>
                  <td className="py-3 px-4 text-[#00B860] font-medium text-xs">{formatCOP(o.total || 0)}</td>
                  <td className="py-3 px-4"><StatusBadge status={o.status} /></td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(String(o.id), e.target.value)}
                        className="bg-white/5 border border-white/10 text-white text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-[#00B860]/50"
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setDetailOrder(o)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-blue-400 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-gray-500 text-center text-sm">No se encontraron pedidos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order detail modal */}
      {detailOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailOrder(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[#111520] rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">Pedido #{String(detailOrder.id).slice(-6)}</h3>
              <button onClick={() => setDetailOrder(null)} className="text-gray-400 hover:text-white text-xs">Cerrar</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Cliente</span><span className="text-white">{detailOrder.customer_name || detailOrder.user_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Teléfono</span><span className="text-white">{detailOrder.phone || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Dirección</span><span className="text-white text-right max-w-[200px]">{detailOrder.address || detailOrder.delivery_address || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Método de pago</span><span className="text-white">{detailOrder.payment_method || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Notas</span><span className="text-white text-right max-w-[200px]">{detailOrder.notes || '—'}</span></div>
            </div>
            {detailOrder.items && detailOrder.items.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-2">Items:</p>
                <div className="space-y-1">
                  {detailOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                      <span className="text-gray-300">{item.name || item.product_name} x{item.quantity}</span>
                      <span className="text-[#00B860]">{formatCOP(item.subtotal || item.price * item.quantity || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-white/5">
              <span className="text-gray-400 text-sm">Total</span>
              <span className="text-[#00B860] font-bold">{formatCOP(detailOrder.total || 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
