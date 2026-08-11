'use client';

import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, Package, MapPin } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function WorkerHistory() {
  const token = useAuthStore((s) => s.token)!;
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const API_BASE = `${window.location.protocol}//${window.location.hostname}:3777`;
        const res = await fetch(`${API_BASE}/api/orders?status=delivered&limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        setHistory(data.data || data.orders || data || []);
      } catch {}
      setLoading(false);
    };
    if (token) fetchHistory();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-[#FF8C00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Historial de Entregas</h1>
        <p className="text-gray-400 text-sm mt-1">{history.length} entregas completadas</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg font-medium">Sin entregas aún</p>
          <p className="text-gray-500 text-sm mt-1">Tus entregas completadas aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((order, i) => (
            <div key={i} className="bg-[#111520] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#00B860]" />
                    <p className="text-white font-medium text-sm">Pedido #{String(order.id).slice(-6)}</p>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{new Date(order.created_at).toLocaleString('es-CO')}</p>
                </div>
                <span className="text-[#00B860] font-medium text-sm">{formatCOP(order.total)}</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-gray-400 text-xs">
                <span className="flex items-center gap-1"><Package className="w-3 h-3" />{order.items?.length || 0} productos</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{order.address?.slice(0, 30) || '—'}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
