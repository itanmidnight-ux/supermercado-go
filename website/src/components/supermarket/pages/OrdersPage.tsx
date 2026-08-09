'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Calendar,
  Box,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { mockOrders, formatCOP, type Order } from '@/store/data-store';
import { useNavStore } from '@/store/navigation-store';

// ─── Colors ──────────────────────────────────────────────────
const BRAND_GREEN = '#00B860';
const BRAND_ORANGE = '#FF8C00';
const BRAND_GOLD = '#FFD93D';

// ─── Filter tabs ─────────────────────────────────────────────
type FilterKey = 'todos' | 'pending' | 'in_transit' | 'delivered' | 'cancelled';

const FILTERS: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
  { key: 'todos', label: 'Todos', icon: <ShoppingBag className="size-3.5" /> },
  { key: 'pending', label: 'Pendientes', icon: <Clock className="size-3.5" /> },
  { key: 'in_transit', label: 'En camino', icon: <Truck className="size-3.5" /> },
  { key: 'delivered', label: 'Entregados', icon: <CheckCircle2 className="size-3.5" /> },
  { key: 'cancelled', label: 'Cancelados', icon: <XCircle className="size-3.5" /> },
];

// ─── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  pending: { color: BRAND_GOLD, bg: '#fffbeb', icon: <Clock className="size-3" /> },
  confirmed: { color: '#f59e0b', bg: '#fffbeb', icon: <Clock className="size-3" /> },
  preparing: { color: BRAND_ORANGE, bg: '#fff7ed', icon: <Package className="size-3" /> },
  in_transit: { color: '#3b82f6', bg: '#eff6ff', icon: <Truck className="size-3" /> },
  delivered: { color: BRAND_GREEN, bg: '#f0fdf4', icon: <CheckCircle2 className="size-3" /> },
  cancelled: { color: '#ef4444', bg: '#fef2f2', icon: <XCircle className="size-3" /> },
};

// ─── Format date ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Order Card ──────────────────────────────────────────────
function OrderCard({ order, index }: { order: Order; index: number }) {
  const openOrder = useNavStore((s) => s.openOrder);
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      whileHover={{ y: -2 }}
    >
      <Card
        className="overflow-hidden cursor-pointer transition-shadow duration-200 hover:shadow-md"
        onClick={() => openOrder(order.id)}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-base">{order.id}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Calendar className="size-3" />
                {formatDate(order.created_at)}
              </div>
            </div>
            <Badge
              className="text-xs font-semibold gap-1 shrink-0 px-2.5 py-1"
              style={{
                backgroundColor: config.bg,
                color: config.color,
                border: `1px solid ${config.color}22`,
              }}
            >
              {config.icon}
              {order.status_label}
            </Badge>
          </div>

          {/* Item thumbnails preview */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-2">
              {order.items.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-lg border-2 border-background overflow-hidden bg-muted"
                >
                  <img
                    src={item.image}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {order.items.length > 3 && (
                <div
                  className="w-9 h-9 rounded-lg border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-muted"
                >
                  +{order.items.length - 3}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
            </span>
          </div>

          <Separator className="mb-3" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Box className="size-3" />
              {order.payment_method}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold" style={{ color: BRAND_GREEN }}>
                {formatCOP(order.total)}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, { title: string; desc: string }> = {
    todos: {
      title: 'Sin pedidos aún',
      desc: 'Cuando hagas tu primer pedido, aparecerá aquí.',
    },
    pending: {
      title: 'Sin pedidos pendientes',
      desc: 'No tienes pedidos esperando confirmación.',
    },
    in_transit: {
      title: 'Sin pedidos en camino',
      desc: 'No hay pedidos en tránsito en este momento.',
    },
    delivered: {
      title: 'Sin entregas completadas',
      desc: 'Tus pedidos entregados aparecerán aquí.',
    },
    cancelled: {
      title: 'Sin pedidos cancelados',
      desc: 'No tienes pedidos cancelados.',
    },
  };

  const msg = messages[filter];

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-14 sm:py-20 text-center"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{ backgroundColor: '#f4f4f5' }}
      >
        <Package className="size-10" style={{ color: '#a1a1aa' }} />
      </div>
      <h3 className="text-lg font-bold mb-1.5">{msg.title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{msg.desc}</p>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function OrdersPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('todos');
  const [search, setSearch] = useState('');

  const filteredOrders = useMemo(() => {
    let result = mockOrders;
    if (activeFilter !== 'todos') {
      result = result.filter((o) => o.status === activeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeFilter, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">Mis Pedidos</h2>
        <p className="text-sm text-muted-foreground">Revisa el estado de tus pedidos</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por ID o producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Manual Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const count =
            f.key === 'todos'
              ? mockOrders.length
              : mockOrders.filter((o) => o.status === f.key).length;
          return (
            <motion.button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0'
              }
              style={
                isActive
                  ? {
                      backgroundColor: BRAND_GREEN,
                      color: 'white',
                      boxShadow: '0 2px 8px rgba(0,184,96,0.3)',
                    }
                  : {
                      backgroundColor: '#f4f4f5',
                      color: '#52525b',
                    }
              }
              whileTap={{ scale: 0.96 }}
            >
              {f.icon}
              <span>{f.label}</span>
              <span
                className={
                  'text-[11px] font-bold ml-0.5 px-1.5 py-0.5 rounded-full'
                }
                style={
                  isActive
                    ? { backgroundColor: 'rgba(255,255,255,0.25)', color: 'white' }
                    : { backgroundColor: '#e4e4e7', color: '#71717a' }
                }
              >
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Orders List */}
      <AnimatePresence mode="wait">
        {filteredOrders.length === 0 ? (
          <EmptyState key="empty" filter={activeFilter} />
        ) : (
          <motion.div
            key={activeFilter + search}
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {filteredOrders.map((order, idx) => (
              <OrderCard key={order.id} order={order} index={idx} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
