'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  ShoppingBasket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toaster';
import { useDataStore, formatCOP } from '@/store/data-store';
import { useCartStore, type CartItem } from '@/store/cart-store';
import { useNavStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';

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

const itemVariants = {
  initial: { opacity: 0, x: -20, height: 0 },
  animate: { opacity: 1, x: 0, height: 'auto', transition: { duration: 0.35 } },
  exit: { opacity: 0, x: 40, height: 0, transition: { duration: 0.25 } },
};

// ─── Random products helper ─────────────────────────────────
function getRandomProducts(count: number) {
  const allProducts = useDataStore.getState().products;
  const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Component ──────────────────────────────────────────────
export function CartPage() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavStore((s) => s.navigate);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const products = useDataStore((s) => s.products);
  const { toast } = useToast();

  const [suggestedProducts] = useState(() => getRandomProducts(4));

  const DELIVERY_FEE = 3500;

  // Calculations
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items]);
  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const total = subtotal + DELIVERY_FEE;

  // Handlers
  const handleGoToCheckout = useCallback(() => {
    if (!isLoggedIn) {
      toast({ title: 'Inicia sesión para continuar', description: 'Necesitas una cuenta para hacer tu pedido.' });
      navigate('login');
      return;
    }
    navigate('checkout');
  }, [isLoggedIn, navigate, toast]);

  const handleAddSuggested = useCallback((product: typeof products[number]) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.compare_price,
      image: product.image,
      quantity: '1',
      unit: product.unit,
      categoryName: product.category_name,
    });
    toast({ title: '¡Agregado al carrito!', description: product.name });
  }, [addItem, toast]);

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
        {/* ─── Page Title ────────────────────────────────── */}
        <motion.div className="flex items-center gap-3 mb-6" {...fadeUp}>
          <h1 className="text-2xl sm:text-3xl font-bold">Mi Carrito</h1>
          {items.length > 0 && (
            <Badge
              className="text-sm font-bold px-2.5 py-0.5"
              style={{ backgroundColor: '#00B860', color: 'white' }}
            >
              {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
            </Badge>
          )}
        </motion.div>

        {items.length === 0 ? (
          /* ─── Empty Cart ───────────────────────────────── */
          <motion.div
            className="flex flex-col items-center justify-center py-16 sm:py-24"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: '#f0fdf4' }}
            >
              <ShoppingBag className="size-14" style={{ color: '#00B860' }} />
            </div>
            <h2 className="text-xl font-bold mb-2">Tu carrito está vacío</h2>
            <p className="text-muted-foreground mb-6 text-center max-w-sm">
              Agrega productos a tu carrito y disfruta de la mejor experiencia de compra en Cúcuta.
            </p>
            <Button
              className="font-semibold text-white gap-2 cursor-pointer"
              style={{ backgroundColor: '#00B860' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
              onClick={() => navigate('catalog')}
            >
              <ShoppingBasket className="size-4" />
              Explorar productos
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ─── Cart Items ─────────────────────────────── */}
            <div className="lg:col-span-2 space-y-0">
              <AnimatePresence mode="popLayout">
                {items.map((item: CartItem) => (
                  <motion.div
                    key={item.id}
                    variants={itemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    layout
                    className="mb-3"
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-4 flex gap-4">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground truncate">{item.categoryName}</p>
                              <h3 className="text-sm sm:text-base font-semibold leading-tight line-clamp-2">
                                {item.name}
                              </h3>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <p className="text-xs text-muted-foreground line-through mt-0.5">
                                  {formatCOP(item.originalPrice)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                              aria-label="Eliminar producto"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            {/* Quantity Controls */}
                            <div className="flex items-center border rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQty(item.id, item.qty - 1)}
                                className="flex items-center justify-center w-9 h-9 hover:bg-muted transition-colors cursor-pointer"
                                aria-label="Reducir cantidad"
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <span className="flex items-center justify-center w-10 h-9 text-sm font-semibold border-x">
                                {item.qty}
                              </span>
                              <button
                                onClick={() => updateQty(item.id, item.qty + 1)}
                                className="flex items-center justify-center w-9 h-9 hover:bg-muted transition-colors cursor-pointer"
                                aria-label="Aumentar cantidad"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>

                            {/* Line Total */}
                            <span className="text-base sm:text-lg font-bold" style={{ color: '#00B860' }}>
                              {formatCOP(item.price * item.qty)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* ─── Suggested Products ──────────────────── */}
              {suggestedProducts.length > 0 && (
                <motion.section
                  className="mt-8"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <ShoppingBasket className="size-5" style={{ color: '#FF8C00' }} />
                    Productos que te pueden gustar
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {suggestedProducts.map((sp) => (
                      <motion.div
                        key={sp.id}
                        whileHover={{ y: -3 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="group overflow-hidden rounded-xl border py-0 gap-0 transition-shadow hover:shadow-md">
                          <div className="aspect-square bg-gray-50 overflow-hidden">
                            <img
                              src={sp.image}
                              alt={sp.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                          <CardContent className="p-3 flex flex-col gap-1">
                            <p className="text-[11px] text-muted-foreground truncate">{sp.brand}</p>
                            <h4 className="text-sm font-medium leading-tight line-clamp-2">{sp.name}</h4>
                            <div className="flex flex-col gap-0.5 mt-auto pt-1">
                              {sp.is_offer && sp.compare_price && (
                                <span className="text-[11px] text-muted-foreground line-through">
                                  {formatCOP(sp.compare_price)}
                                </span>
                              )}
                              <span className="text-sm font-bold" style={{ color: '#00B860' }}>
                                {formatCOP(sp.price)}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              className="mt-1 w-full text-xs font-semibold text-white gap-1 cursor-pointer"
                              style={{ backgroundColor: '#00B860' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                              onClick={() => handleAddSuggested(sp)}
                            >
                              <Plus className="size-3" />
                              Agregar
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </div>

            {/* ─── Order Summary ─────────────────────────── */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardContent className="p-5 flex flex-col gap-4">
                  <h2 className="text-lg font-bold">Resumen del pedido</h2>

                  <Separator />

                  {/* Price Lines */}
                  <div className="flex flex-col gap-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Subtotal ({totalItems} {totalItems === 1 ? 'prod' : 'prods'})
                      </span>
                      <span className="font-medium">{formatCOP(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Envío</span>
                      <span className="font-medium">{formatCOP(DELIVERY_FEE)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-xl font-extrabold" style={{ color: '#00B860' }}>
                      {formatCOP(total)}
                    </span>
                  </div>

                  {/* CTAs */}
                  <div className="flex flex-col gap-2.5 mt-1">
                    <Button
                      variant="outline"
                      className="w-full font-semibold gap-2 cursor-pointer"
                      onClick={() => navigate('catalog')}
                    >
                      <ShoppingBasket className="size-4" />
                      Seguir comprando
                    </Button>
                    <Button
                      className="w-full text-base font-bold text-white gap-2 cursor-pointer"
                      style={{ backgroundColor: '#00B860' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                      onClick={handleGoToCheckout}
                    >
                      Ir a pagar
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>

                  {/* Delivery info */}
                  <p className="text-[11px] text-center text-muted-foreground">
                    Entrega en 30-60 min en Cúcuta y zona metropolitana
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
