'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Home,
  Truck,
  Building,
  QrCode,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { formatCOP, mockAddresses, type Address } from '@/store/data-store';
import { useCartStore, type CartItem } from '@/store/cart-store';
import { useNavStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

const API_BASE = '/api';

// ─── Animation ──────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Payment Methods ────────────────────────────────────────
const paymentMethods = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote, desc: 'Paga al recibir' },
  { id: 'nequi', label: 'Nequi', icon: Smartphone, desc: 'Transferencia Nequi' },
  { id: 'daviplata', label: 'Daviplata', icon: Smartphone, desc: 'Transferencia Daviplata' },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard, desc: 'Visa, Mastercard' },
  { id: 'pse', label: 'PSE', icon: Landmark, desc: 'Débito bancario' },
];

// ─── Confetti Dot ───────────────────────────────────────────
function ConfettiDot({ delay, left, size }: { delay: number; left: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        backgroundColor: '#00B860',
        width: size,
        height: size,
        left,
        bottom: -20,
      }}
      initial={{ opacity: 1, y: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, -300, -400],
        x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 150],
      }}
      transition={{
        duration: 2.5 + Math.random(),
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

// ─── Step Indicator ─────────────────────────────────────────
function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  isDone
                    ? 'text-white'
                    : isActive
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-400'
                }`}
                style={
                  isDone || isActive
                    ? { backgroundColor: '#00B860' }
                    : undefined
                }
              >
                {isDone ? <CheckCircle2 className="size-5" /> : stepNum}
              </div>
              <span
                className={`text-xs font-medium text-center hidden sm:block ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div
                className="flex-1 h-0.5 mx-2 sm:mx-4 rounded-full transition-colors"
                style={{
                  backgroundColor: stepNum < current ? '#00B860' : '#e5e7eb',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────
export function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const navigate = useNavStore((s) => s.navigate);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<string>('addr1');
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ address: '', detail: '', neighborhood: '' });
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const DELIVERY_FEE = 3500;
  const stepLabels = ['Dirección', 'Pago', 'Confirmar'];

  // Get selected address info
  const selectedAddrInfo = useMemo((): Address | null => {
    if (useNewAddress) return null;
    return mockAddresses.find((a) => a.id === selectedAddress) ?? null;
  }, [selectedAddress, useNewAddress]);

  const paymentInfo = useMemo(() => {
    return paymentMethods.find((m) => m.id === paymentMethod) ?? null;
  }, [paymentMethod]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      toast({ title: 'Inicia sesión para continuar', description: 'Necesitas una cuenta para hacer tu pedido.' });
      navigate('login');
    }
  }, [isLoggedIn, navigate, toast]);

  // Calculations (match cart page logic)
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items]);
  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const total = subtotal + DELIVERY_FEE;

  // Generate order number and send to API
  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      const addressText = useNewAddress
        ? `${newAddr.address}, ${newAddr.neighborhood}${newAddr.detail ? ` - ${newAddr.detail}` : ''}`
        : selectedAddrInfo
          ? `${selectedAddrInfo.address}, ${selectedAddrInfo.neighborhood}${selectedAddrInfo.detail ? ` - ${selectedAddrInfo.detail}` : ''}`
          : '';

      const apiItems = items.map((item: CartItem) => ({
        product_id: item.id,
        qty: item.qty,
      }));

      const token = localStorage.getItem('sg_token');
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: apiItems,
          delivery_address: addressText,
          fulfillment_type: 'delivery',
          payment_method: paymentMethod,
          notes: '',
        }),
      });

      const data = await res.json();

      if (res.ok && data.order) {
        setOrderNumber(`ORD-${String(data.order.id).slice(0, 8).toUpperCase()}`);
        setIsConfirmed(true);
        clearCart();
        toast({ title: '¡Pedido confirmado!', description: `Tu pedido ha sido creado exitosamente.` });
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo crear el pedido.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor.', variant: 'destructive' });
    }
    setIsLoading(false);
  }, [items, useNewAddress, newAddr, selectedAddrInfo, paymentMethod, clearCart, toast]);

  // Redirect if no items (and not confirmed)
  useEffect(() => {
    if (!isConfirmed && items.length === 0 && isLoggedIn) {
      navigate('cart');
    }
  }, [items.length, isConfirmed, isLoggedIn, navigate]);

  // Confetti dots
  const confettiDots = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        delay: Math.random() * 1.5,
        left: `${Math.random() * 100}%`,
        size: 6 + Math.random() * 8,
      })),
    []
  );

  // ─── Success Screen ───────────────────────────────────
  if (isConfirmed) {
    return (
      <motion.div
        className="min-h-screen bg-background flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Confetti */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {confettiDots.map((dot) => (
            <ConfettiDot key={dot.id} delay={dot.delay} left={dot.left} size={dot.size} />
          ))}
        </div>

        <motion.div
          className="text-center max-w-md relative z-10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        >
          <motion.div
            className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: '#f0fdf4' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.5 }}
          >
            <CheckCircle2 className="size-14" style={{ color: '#00B860' }} />
          </motion.div>

          <motion.h1
            className="text-2xl sm:text-3xl font-bold mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            ¡Pedido confirmado!
          </motion.h1>

          <motion.p
            className="text-muted-foreground mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            Tu pedido ha sido creado exitosamente.
          </motion.p>

          <motion.div
            className="inline-block mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Badge
              className="text-lg font-bold px-5 py-2"
              style={{ backgroundColor: '#FFD93D', color: '#333333' }}
            >
              {orderNumber}
            </Badge>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            <Button
              className="font-semibold text-white gap-2 cursor-pointer"
              style={{ backgroundColor: '#00B860' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
              onClick={() => navigate('home')}
            >
              <Home className="size-4" />
              Volver al inicio
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <motion.div
      className="min-h-screen bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Back button */}
        {step > 1 && (
          <Button
            variant="ghost"
            className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
        )}

        <motion.h1 className="text-2xl sm:text-3xl font-bold mb-2" {...fadeUp}>
          Finalizar compra
        </motion.h1>
        <p className="text-sm text-muted-foreground mb-6" {...fadeUp}>
          Completa los pasos para confirmar tu pedido
        </p>

        {/* Step Indicator */}
        <StepIndicator current={step} total={3} labels={stepLabels} />

        <AnimatePresence mode="wait">
          {/* ─── STEP 1: Address ─────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <MapPin className="size-5" style={{ color: '#00B860' }} />
                    Dirección de entrega
                  </h2>

                  <RadioGroup
                    value={useNewAddress ? '__new__' : selectedAddress}
                    onValueChange={(val) => {
                      if (val === '__new__') {
                        setUseNewAddress(true);
                      } else {
                        setUseNewAddress(false);
                        setSelectedAddress(val);
                      }
                    }}
                    className="gap-3"
                  >
                    {mockAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          !useNewAddress && selectedAddress === addr.id
                            ? 'border-[#00B860] bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <RadioGroupItem value={addr.id} />
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: '#f0fdf4' }}
                          >
                            {addr.label === 'Casa' ? (
                              <Home className="size-5" style={{ color: '#00B860' }} />
                            ) : addr.label === 'Oficina' ? (
                              <Building className="size-5" style={{ color: '#00B860' }} />
                            ) : (
                              <Truck className="size-5" style={{ color: '#00B860' }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{addr.label}</span>
                              {addr.is_default && (
                                <Badge
                                  className="text-[10px] px-1.5 py-0"
                                  style={{ backgroundColor: '#FFD93D', color: '#333333' }}
                                >
                                  Principal
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {addr.address}, {addr.neighborhood}
                            </p>
                            {addr.detail && (
                              <p className="text-xs text-muted-foreground truncate">{addr.detail}</p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}

                    {/* New address option */}
                    <label
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        useNewAddress
                          ? 'border-[#00B860] bg-green-50'
                          : 'border-dashed border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <RadioGroupItem value="__new__" />
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: '#f0fdf4' }}
                        >
                          <Plus className="size-5" style={{ color: '#00B860' }} />
                        </div>
                        <span className="font-semibold text-sm">Nueva dirección</span>
                      </div>
                    </label>
                  </RadioGroup>

                  {/* New address form */}
                  <AnimatePresence>
                    {useNewAddress && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
                          <div>
                            <Label className="text-sm font-medium mb-1 block">Dirección *</Label>
                            <Input
                              placeholder="Ej: Calle 5 #12-34"
                              value={newAddr.address}
                              onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-1 block">Detalle (torre, apto)</Label>
                            <Input
                              placeholder="Ej: Torre B, Apto 302"
                              value={newAddr.detail}
                              onChange={(e) => setNewAddr({ ...newAddr, detail: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-1 block">Barrio *</Label>
                            <Input
                              placeholder="Ej: La Playa"
                              value={newAddr.neighborhood}
                              onChange={(e) => setNewAddr({ ...newAddr, neighborhood: e.target.value })}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Map placeholder */}
                  <div className="mt-5 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-[2/1] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="size-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Vista previa del mapa</p>
                      <p className="text-xs">Cúcuta, Norte de Santander</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex justify-end">
                <Button
                  className="font-semibold text-white gap-2 cursor-pointer"
                  style={{ backgroundColor: '#00B860' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                  onClick={() => {
                    if (useNewAddress && (!newAddr.address || !newAddr.neighborhood)) {
                      toast({ title: 'Datos incompletos', description: 'Ingresa la dirección y el barrio.', variant: 'destructive' });
                      return;
                    }
                    setStep(2);
                  }}
                >
                  Continuar
                  <ArrowLeft className="size-4 rotate-180" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 2: Payment ─────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <CreditCard className="size-5" style={{ color: '#00B860' }} />
                    Método de pago
                  </h2>

                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    className="gap-3"
                  >
                    {paymentMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          paymentMethod === method.id
                            ? 'border-[#00B860] bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <RadioGroupItem value={method.id} />
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: '#f0fdf4' }}
                          >
                            <method.icon className="size-5" style={{ color: '#00B860' }} />
                          </div>
                          <div>
                            <span className="font-semibold text-sm block">{method.label}</span>
                            <span className="text-xs text-muted-foreground">{method.desc}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>

                  {/* Security Badge */}
                  <div
                    className="mt-5 flex items-center justify-center gap-2 p-3 rounded-xl"
                    style={{ backgroundColor: '#f0fdf4' }}
                  >
                    <ShieldCheck className="size-5" style={{ color: '#00B860' }} />
                    <p className="text-sm font-medium" style={{ color: '#00B860' }}>
                      Tus datos están protegidos de forma segura
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  className="font-semibold gap-2 cursor-pointer"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="size-4" />
                  Atrás
                </Button>
                <Button
                  className="font-semibold text-white gap-2 cursor-pointer"
                  style={{ backgroundColor: '#00B860' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                  onClick={() => setStep(3)}
                >
                  Continuar
                  <ArrowLeft className="size-4 rotate-180" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 3: Summary ────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Items */}
                <div className="lg:col-span-3">
                  <Card>
                    <CardContent className="p-5 sm:p-6">
                      <h2 className="text-lg font-bold mb-4">Resumen de tu pedido</h2>
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {items.map((item: CartItem) => (
                          <div key={item.id} className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.qty} x {formatCOP(item.price)}</p>
                            </div>
                            <span className="text-sm font-semibold shrink-0">{formatCOP(item.price * item.qty)}</span>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-4" />

                      {/* Price breakdown */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                          <span className="font-medium">{formatCOP(subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Envío</span>
                          <span className="font-medium">{formatCOP(DELIVERY_FEE)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-base font-bold">Total a pagar</span>
                          <span className="text-xl font-extrabold" style={{ color: '#00B860' }}>
                            {formatCOP(total)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Address & Payment */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Delivery Address Card */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                        <MapPin className="size-4" style={{ color: '#00B860' }} />
                        Dirección de entrega
                      </h3>
                      {useNewAddress ? (
                        <p className="text-sm text-muted-foreground">
                          {newAddr.address}, {newAddr.neighborhood}
                          {newAddr.detail && ` - ${newAddr.detail}`}
                        </p>
                      ) : selectedAddrInfo ? (
                        <div>
                          <Badge
                            className="text-[10px] px-1.5 py-0 mb-1.5"
                            style={{ backgroundColor: '#FFD93D', color: '#333333' }}
                          >
                            {selectedAddrInfo.label}
                          </Badge>
                          <p className="text-sm">
                            {selectedAddrInfo.address}, {selectedAddrInfo.neighborhood}
                          </p>
                          {selectedAddrInfo.detail && (
                            <p className="text-xs text-muted-foreground">{selectedAddrInfo.detail}</p>
                          )}
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* Payment Method Card */}
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                        <CreditCard className="size-4" style={{ color: '#00B860' }} />
                        Método de pago
                      </h3>
                      {paymentInfo && (
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: '#f0fdf4' }}
                          >
                            <paymentInfo.icon className="size-5" style={{ color: '#00B860' }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{paymentInfo.label}</p>
                            <p className="text-xs text-muted-foreground">{paymentInfo.desc}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Confirm Button */}
                  <Button
                    className="w-full text-base font-bold text-white gap-2 cursor-pointer"
                    style={{ backgroundColor: '#00B860' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                    onClick={handleConfirm}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="size-5" />
                        Confirmar pedido
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full text-sm text-muted-foreground gap-1.5 cursor-pointer"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft className="size-3.5" />
                    Cambiar método de pago
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
