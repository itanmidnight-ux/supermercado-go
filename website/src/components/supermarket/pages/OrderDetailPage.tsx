'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Package,
  Truck,
  ShoppingCart,
  MapPin,
  CreditCard,
  Calendar,
  Receipt,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { mockOrders, formatCOP } from '@/store/data-store';
import { useNavStore } from '@/store/navigation-store';

// ─── Colors ──────────────────────────────────────────────────
const BRAND_GREEN = '#00B860';
const BRAND_ORANGE = '#FF8C00';
const BRAND_GOLD = '#FFD93D';
const BRAND_GREEN_DARK = '#009a50';

// ─── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  pending: { color: BRAND_GOLD, bg: '#fffbeb' },
  confirmed: { color: '#f59e0b', bg: '#fffbeb' },
  preparing: { color: BRAND_ORANGE, bg: '#fff7ed' },
  in_transit: { color: '#3b82f6', bg: '#eff6ff' },
  delivered: { color: BRAND_GREEN, bg: '#f0fdf4' },
  cancelled: { color: '#ef4444', bg: '#fef2f2' },
};

// ─── Timeline steps (all possible) ─────────────────────────
const ALL_STEPS: { status: string; label: string; icon: React.ReactNode }[] = [
  { status: 'ordered', label: 'Pedido realizado', icon: <ShoppingCart className="size-5" /> },
  { status: 'confirmed', label: 'Confirmado', icon: <CheckCircle2 className="size-5" /> },
  { status: 'preparing', label: 'Preparando', icon: <Package className="size-5" /> },
  { status: 'in_transit', label: 'En camino', icon: <Truck className="size-5" /> },
  { status: 'delivered', label: 'Entregado', icon: <CheckCircle2 className="size-5" /> },
];

// ─── Format date ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Timeline Component ──────────────────────────────────────
function StatusTimeline({
  timeline,
  orderStatus,
}: {
  timeline: { status: string; label: string; time: string }[];
  orderStatus: string;
}) {
  const isCancelled = orderStatus === 'cancelled';

  // Map timeline entries to steps by status key
  const completedSet = new Set(
    timeline.map((t) => t.status)
  );
  // 'pending' from timeline counts as 'ordered'
  if (completedSet.has('pending')) {
    completedSet.add('ordered');
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <h3 className="font-bold text-base mb-5 flex items-center gap-2">
          <Receipt className="size-4" style={{ color: BRAND_GREEN }} />
          Seguimiento del pedido
        </h3>
        <div className="relative">
          {/* Horizontal line (desktop) */}
          <div className="hidden sm:block">
            <div className="absolute top-6 left-6 right-6 h-1 rounded-full bg-muted z-0" />
            <div
              className="absolute top-6 left-6 h-1 rounded-full z-0 transition-all duration-700"
              style={{
                backgroundColor: isCancelled ? '#ef4444' : BRAND_GREEN,
                width: `${Math.min((completedSet.size / ALL_STEPS.length) * 100, 100)}%`,
              }}
            />
          </div>

          {/* Steps */}
          <div className="flex justify-between relative z-10">
            {ALL_STEPS.map((step, idx) => {
              const isCompleted = completedSet.has(step.status);
              const isLast = idx === ALL_STEPS.length - 1;
              const isCurrentStep =
                !isLast && completedSet.has(ALL_STEPS[idx + 1]?.status) === false && isCompleted;

              // Get time from timeline if available
              const timelineEntry = timeline.find((t) => t.status === step.status);
              // also check 'pending' -> 'ordered' mapping
              const timeEntry =
                timelineEntry?.time ||
                (step.status === 'ordered' ? timeline.find((t) => t.status === 'pending')?.time : undefined);

              return (
                <div key={step.status} className="flex flex-col items-center flex-1">
                  {/* Circle */}
                  <motion.div
                    className={
                      'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-300'
                    }
                    style={{
                      backgroundColor: isCompleted
                        ? isCancelled
                          ? '#fef2f2'
                          : '#f0fdf4'
                        : 'white',
                      borderColor: isCompleted
                        ? isCancelled
                          ? '#ef4444'
                          : BRAND_GREEN
                        : '#d4d4d8',
                      color: isCompleted
                        ? isCancelled
                          ? '#ef4444'
                          : BRAND_GREEN
                        : '#a1a1aa',
                    }}
                    initial={false}
                    animate={isCurrentStep ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                    transition={isCurrentStep ? { duration: 1.5, repeat: Infinity } : undefined}
                  >
                    {step.icon}
                  </motion.div>
                  {/* Label */}
                  <p
                    className={
                      'text-[11px] sm:text-xs mt-2 font-semibold text-center leading-tight'
                    }
                    style={{
                      color: isCompleted
                        ? isCancelled
                          ? '#ef4444'
                          : BRAND_GREEN
                        : '#a1a1aa',
                    }}
                  >
                    {step.label}
                  </p>
                  {timeEntry && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                      {timeEntry}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Not Found State ─────────────────────────────────────────
function NotFoundState() {
  const goBack = useNavStore((s) => s.goBack);

  return (
    <motion.div
      className="min-h-screen bg-background flex items-center justify-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center px-4">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: '#fef2f2' }}
        >
          <AlertCircle className="size-12" style={{ color: '#ef4444' }} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Pedido no encontrado</h2>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Lo sentimos, no pudimos encontrar el pedido que buscas. Verifica el ID e intenta de nuevo.
        </p>
        <Button
          className="gap-2 text-white font-semibold cursor-pointer"
          style={{ backgroundColor: BRAND_GREEN }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN)}
          onClick={goBack}
        >
          <ArrowLeft className="size-4" />
          Volver
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function OrderDetailPage() {
  const orderDetailId = useNavStore((s) => s.orderDetailId);
  const goBack = useNavStore((s) => s.goBack);

  const order = useMemo(
    () => mockOrders.find((o) => o.id === orderDetailId) ?? null,
    [orderDetailId]
  );

  if (!order) {
    return <NotFoundState />;
  }

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);

  const stagger = {
    animate: { transition: { staggerChildren: 0.07 } },
  };

  const itemFade = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <motion.div
      className="min-h-screen bg-background"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back Button & Header */}
        <motion.div
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 cursor-pointer"
            onClick={goBack}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Detalle del pedido</h1>
            <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <Badge
            className="text-xs font-semibold gap-1.5 shrink-0 px-3 py-1"
            style={{
              backgroundColor: config.bg,
              color: config.color,
              border: `1px solid ${config.color}22`,
            }}
          >
            {order.status_label}
          </Badge>
        </motion.div>

        {/* Order ID Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35 }}
        >
          <Card className="mb-5 overflow-hidden">
            <div
              className="h-2"
              style={{
                background: `linear-gradient(90deg, ${BRAND_GREEN}, ${BRAND_ORANGE}, ${BRAND_GOLD})`,
              }}
            />
            <CardContent className="p-5 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Pedido
                  </p>
                  <p className="font-bold text-sm">{order.id}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Fecha
                  </p>
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground" />
                    <p className="font-medium text-sm">
                      {new Date(order.created_at).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Productos
                  </p>
                  <p className="font-medium text-sm">
                    {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Total
                  </p>
                  <p className="font-extrabold text-lg" style={{ color: BRAND_GREEN }}>
                    {formatCOP(order.total)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Timeline */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <StatusTimeline timeline={order.timeline} orderStatus={order.status} />
        </motion.div>

        {/* Items List & Summary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Items */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-5 sm:p-6">
                <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                  <ShoppingBag className="size-4" style={{ color: BRAND_ORANGE }} />
                  Productos del pedido
                </h3>
                <motion.div
                  className="space-y-0"
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                >
                  {order.items.map((item, idx) => {
                    const lineTotal = item.unit_price * item.qty;
                    return (
                      <motion.div key={idx} variants={itemFade}>
                        {idx > 0 && <Separator className="my-3" />}
                        <div className="flex items-center gap-4">
                          {/* Thumbnail */}
                          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-muted shrink-0">
                            <img
                              src={item.image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-tight line-clamp-2">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Cantidad: {item.qty} × {formatCOP(item.unit_price)}
                            </p>
                          </div>
                          {/* Line Total */}
                          <p className="text-sm font-bold whitespace-nowrap" style={{ color: BRAND_GREEN }}>
                            {formatCOP(lineTotal)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar: Summary + Info */}
          <div className="space-y-5">
            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
            >
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold text-sm mb-4">Resumen de compra</h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCOP(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Envío</span>
                      <span
                        className={`font-medium ${
                          order.delivery_fee === 0 ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {order.delivery_fee === 0
                          ? formatCOP(3500)
                          : formatCOP(order.delivery_fee)}
                      </span>
                    </div>
                    {order.delivery_fee === 0 && (
                      <p className="text-xs font-semibold" style={{ color: BRAND_GREEN }}>
                        ¡Envío gratis!
                      </p>
                    )}
                    {order.discount > 0 && (
                      <div className="flex justify-between">
                        <span className="font-medium" style={{ color: BRAND_GREEN }}>
                          Descuento
                        </span>
                        <span className="font-bold" style={{ color: BRAND_GREEN }}>
                          -{formatCOP(order.discount)}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-bold">Total</span>
                      <span className="text-xl font-extrabold" style={{ color: BRAND_GREEN }}>
                        {formatCOP(order.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Payment Method */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.35 }}
            >
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <CreditCard className="size-4 text-muted-foreground" />
                    Método de pago
                  </h3>
                  <Badge
                    className="text-sm font-semibold px-3 py-1.5"
                    style={{
                      backgroundColor: '#f0fdf4',
                      color: BRAND_GREEN,
                      border: `1px solid ${BRAND_GREEN}33`,
                    }}
                  >
                    {order.payment_method}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>

            {/* Delivery Address */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
            >
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <MapPin className="size-4" style={{ color: BRAND_ORANGE }} />
                    Dirección de entrega
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">
                    {order.address}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Back Button */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.35 }}
        >
          <Button
            variant="outline"
            className="w-full sm:w-auto font-semibold gap-2 cursor-pointer"
            onClick={goBack}
          >
            <ArrowLeft className="size-4" />
            Volver a mis pedidos
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
