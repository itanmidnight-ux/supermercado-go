'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Truck,
  ShieldCheck,
  Leaf,
  RotateCcw,
  Flame,
  Star,
  Plus,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  UserPlus,
  ShoppingCart,
  Home,
  ArrowRight,
  Zap,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useDataStore,
  formatCOP,
  getOffers,
  getFeatured,
  type Product,
  type Testimonial,
  type Category,
  type Banner,
} from '@/store/data-store';
import { useCartStore } from '@/store/cart-store';
import { useNavStore } from '@/store/navigation-store';
import { useToast } from '@/components/ui/toaster';

// ─── Animation variants ────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

// ─── Trust badge data ──────────────────────────────────────
const trustBadges = [
  { icon: Truck, label: 'Entrega 30-60 min', desc: 'Rápido y puntual' },
  { icon: ShieldCheck, label: 'Pago seguro', desc: 'Protegido al 100%' },
  { icon: Leaf, label: '100% Fresco', desc: 'Calidad garantizada' },
  { icon: RotateCcw, label: 'Devolución fácil', desc: 'Sin complicaciones' },
];

// ─── Steps data ────────────────────────────────────────────
const steps = [
  {
    icon: UserPlus,
    title: 'Regístrate',
    desc: 'Crea tu cuenta en segundos y obtén beneficios exclusivos.',
  },
  {
    icon: ShoppingCart,
    title: 'Agrega al carrito',
    desc: 'Explora productos frescos y añade lo que necesites.',
  },
  {
    icon: Home,
    title: 'Recibe en casa',
    desc: 'Tu pedido llega en 30-60 minutos directo a tu puerta.',
  },
];

// ─── Star Rating Component ─────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-4 ${
            i < rating ? 'fill-[#FFD93D] text-[#FFD93D]' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Offer Product Card ────────────────────────────────────
function OfferProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavStore((s) => s.navigate);
  const { toast } = useToast();
  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.compare_price,
      image: product.image,
      quantity: product.unit,
      unit: product.unit,
      categoryName: product.category_name,
    });
    toast({ title: `${product.name} agregado al carrito` });
  };

  return (
    <Card
      className="min-w-[200px] max-w-[200px] flex-shrink-0 cursor-pointer overflow-hidden border-none shadow-md transition-shadow hover:shadow-lg"
      onClick={() => navigate('catalog')}
    >
      <div className="relative">
        <img
          src={product.image}
          alt={product.name}
          className="h-[140px] w-full rounded-t-xl object-cover bg-gray-50"
          loading="lazy"
        />
        {discount > 0 && (
          <Badge className="absolute left-2 top-2 bg-[#FF8C00] text-white border-none text-xs font-bold px-2 py-0.5">
            -{discount}%
          </Badge>
        )}
      </div>
      <CardContent className="p-3 gap-2">
        <p className="text-xs text-gray-500 truncate">{product.brand}</p>
        <p className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </p>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-base font-bold text-[#00B860]">
            {formatCOP(product.price)}
          </span>
          {product.compare_price && (
            <span className="text-xs text-gray-400 line-through">
              {formatCOP(product.compare_price)}
            </span>
          )}
        </div>
        <Button
          size="sm"
          className="w-full mt-1 bg-[#00B860] hover:bg-[#009B50] text-white text-xs"
          onClick={handleAdd}
        >
          <Plus className="size-3.5" />
          Agregar
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Featured Product Card ─────────────────────────────────
function FeaturedProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavStore((s) => s.navigate);
  const { toast } = useToast();

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.compare_price,
      image: product.image,
      quantity: product.unit,
      unit: product.unit,
      categoryName: product.category_name,
    });
    toast({ title: `${product.name} agregado al carrito` });
  };

  return (
    <Card
      className="group overflow-hidden border-none shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
      onClick={() => navigate('catalog')}
    >
      <div className="relative overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-[180px] w-full object-cover bg-gray-50 transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {product.is_offer && product.compare_price && (
          <Badge className="absolute left-3 top-3 bg-[#FF8C00] text-white border-none font-bold">
            -
            {Math.round(
              ((product.compare_price - product.price) / product.compare_price) * 100
            )}
            %
          </Badge>
        )}
        {product.is_featured && !product.is_offer && (
          <Badge className="absolute left-3 top-3 bg-[#FFD93D] text-gray-800 border-none font-bold">
            <Sparkles className="size-3" />
            Destacado
          </Badge>
        )}
      </div>
      <CardContent className="p-4 gap-1">
        <p className="text-xs text-gray-500 truncate">{product.brand}</p>
        <p className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{product.category_name}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-[#00B860]">
              {formatCOP(product.price)}
            </span>
            {product.compare_price && (
              <span className="text-xs text-gray-400 line-through">
                {formatCOP(product.compare_price)}
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="bg-[#00B860] hover:bg-[#009B50] text-white"
            onClick={handleAdd}
          >
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Testimonial Card ──────────────────────────────────────
function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <Card className="min-w-[300px] max-w-[340px] flex-shrink-0 border-none shadow-md">
      <CardContent className="p-6 gap-4">
        <StarRating rating={t.rating} />
        <p className="text-sm text-gray-600 leading-relaxed italic">
          &ldquo;{t.comment}&rdquo;
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center justify-center size-10 rounded-full bg-[#00B860] text-white font-bold text-sm">
            {t.avatar}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{t.name}</p>
            <p className="text-xs text-gray-400">{t.role}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── HOMEPAGE COMPONENT ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export function HomePage() {
  const navigate = useNavStore((s) => s.navigate);
  const { toast } = useToast();
  const categories = useDataStore((s) => s.categories);
  const banners = useDataStore((s) => s.banners);
  const testimonials = useDataStore((s) => s.testimonials);
  const offers = getOffers();
  const featured = getFeatured();

  // Banner carousel state
  const [bannerIdx, setBannerIdx] = useState(0);
  const bannerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Testimonial carousel state
  const [testIdx, setTestIdx] = useState(0);
  const testInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // ── Banner auto-slide ─────────────────────────────────────
  const startBannerSlide = useCallback(() => {
    if (bannerInterval.current) clearInterval(bannerInterval.current);
    bannerInterval.current = setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % banners.length);
    }, 4000);
  }, []);

  useEffect(() => {
    startBannerSlide();
    return () => {
      if (bannerInterval.current) clearInterval(bannerInterval.current);
    };
  }, [startBannerSlide]);

  // ── Testimonial auto-slide ────────────────────────────────
  useEffect(() => {
    testInterval.current = setInterval(() => {
      setTestIdx((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => {
      if (testInterval.current) clearInterval(testInterval.current);
    };
  }, []);

  // ── Search handler ────────────────────────────────────────
  const handleSearch = () => {
    if (searchQuery.trim()) {
      // Pass search query to catalog via URL params
      window.dispatchEvent(new CustomEvent('catalog-search', { detail: searchQuery.trim() }));
      navigate('catalog');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* ─── 1. HERO SECTION ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#00B860]">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/hero-supermarket.jpg)' }}
        />
        {/* Dark overlay with green tint for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#005A2E]/85 via-[#00B860]/75 to-[#009B50]/80" />

        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24 md:py-28">
          <motion.div
            className="text-center max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <Badge className="mb-4 bg-[#FFD93D] text-gray-800 border-none font-semibold text-sm px-3 py-1">
              <Zap className="size-3.5" />
              Delivery en Cúcuta
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
              Tu supermercado en
              <br />
              línea,{' '}
              <span className="text-[#FFD93D]">donde vayas</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-white/85 max-w-xl mx-auto">
              Compra tus productos frescos y de la despensa con entrega en 30-60 minutos
              directo a tu puerta en Cúcuta y zona metropolitana.
            </p>

            {/* Search bar */}
            <div className="mt-8 flex items-center gap-2 max-w-lg mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="¿Qué estás buscando hoy?"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-12 rounded-xl bg-white/95 backdrop-blur-sm border-none text-sm shadow-lg"
                />
              </div>
              <Button
                onClick={handleSearch}
                className="h-12 px-6 bg-[#FF8C00] hover:bg-[#e07800] text-white rounded-xl font-semibold shadow-lg"
              >
                Comprar ahora
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-white/70 text-sm">
              <span className="flex items-center gap-1">
                <Truck className="size-4" /> Envío desde $3,500
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <Leaf className="size-4" /> Productos frescos
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-4" /> Pago seguro
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── 2. TRUST BAR ───────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <motion.div
          className="max-w-6xl mx-auto px-4 py-4"
          {...fadeUp}
          transition={{ duration: 0.4 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustBadges.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center justify-center size-10 rounded-full bg-[#00B860]/10 flex-shrink-0">
                  <item.icon className="size-5 text-[#00B860]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 hidden sm:block">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── 3. CATEGORIES SECTION ──────────────────────────── */}
      <section className="py-12 sm:py-16">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Categorías
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Explora por tipo de producto
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-start md:justify-center">
            {categories.map((cat: Category) => (
              <button
                key={cat.id}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('catalog-category', { detail: cat.slug || cat.name }));
                  navigate('catalog');
                }}
                className="flex flex-col items-center gap-3 min-w-[120px] sm:min-w-[140px] group flex-shrink-0"
              >
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-gray-100 group-hover:border-[#00B860] group-hover:shadow-lg transition-all duration-300 shadow-md">
                  <img
                    src={cat.image || `https://placehold.co/200x200/00B860/white?text=${encodeURIComponent(cat.name?.charAt(0) || '?')}`}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://placehold.co/200x200/00B860/white?text=${encodeURIComponent(cat.name?.charAt(0) || '?')}`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-700 text-center leading-tight group-hover:text-[#00B860] transition-colors max-w-[120px]">
                  {cat.name}
                </span>
              </button>
            ))}
            {categories.length === 0 && (
              <div className="flex gap-4 justify-center w-full">
                {['Frutas y Verduras', 'Carnes y Pollo', 'Lácteos', 'Bebidas', 'Abarrotes', 'Panadería'].map((name, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 min-w-[120px] sm:min-w-[140px]">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gray-100 animate-pulse" />
                    <div className="w-16 h-3 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─── 4. BANNER CAROUSEL ─────────────────────────────── */}
      <section className="py-6 sm:py-10">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div
            ref={bannerRef}
            className="relative rounded-2xl overflow-hidden shadow-lg"
          >
            {/* Slides */}
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${bannerIdx * 100}%)` }}
            >
              {banners.map((banner: Banner) => (
                <div
                  key={banner.id}
                  className="w-full flex-shrink-0 relative"
                  style={{ backgroundColor: banner.bg_color }}
                >
                  <div className="flex flex-col sm:flex-row items-center justify-center min-h-[220px] sm:min-h-[260px] md:min-h-[300px] px-6 sm:px-12 py-8 gap-6">
                    <div className="text-center sm:text-left flex-1 max-w-md">
                      <h3
                        className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight"
                        style={{ color: banner.text_color }}
                      >
                        {banner.title}
                      </h3>
                      <p
                        className="mt-2 text-sm sm:text-base opacity-90"
                        style={{ color: banner.text_color }}
                      >
                        {banner.subtitle}
                      </p>
                      <Button
                        className="mt-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 font-semibold"
                        style={{ color: banner.text_color }}
                        onClick={() => navigate('catalog')}
                      >
                        Explorar
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                    <div className="flex-shrink-0 hidden sm:block">
                      <img
                        src={banner.image}
                        alt={banner.title}
                        className="h-[180px] md:h-[220px] w-auto rounded-xl shadow-md"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation arrows */}
            <button
              onClick={() => {
                setBannerIdx((prev) =>
                  prev === 0 ? banners.length - 1 : prev - 1
                );
                startBannerSlide();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="size-5 text-gray-700" />
            </button>
            <button
              onClick={() => {
                setBannerIdx((prev) => (prev + 1) % banners.length);
                startBannerSlide();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="size-5 text-gray-700" />
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setBannerIdx(i);
                    startBannerSlide();
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === bannerIdx
                      ? 'w-6 bg-white'
                      : 'w-2 bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Banner ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── 5. OFFERS SECTION ──────────────────────────────── */}
      <section className="py-10 sm:py-14 bg-gradient-to-b from-orange-50/50 to-white">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-full bg-[#FF8C00]/10">
                <Flame className="size-6 text-[#FF8C00]" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Ofertas de la semana
                </h2>
                <p className="text-sm text-gray-500">Aprovecha los mejores descuentos</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="text-[#FF8C00] hover:text-[#e07800] hover:bg-orange-50"
              onClick={() => navigate('catalog')}
            >
              Ver todas
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {offers.map((product) => (
              <OfferProductCard key={product.id} product={product} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── 6. FEATURED PRODUCTS ───────────────────────────── */}
      <section className="py-10 sm:py-14">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Productos destacados
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Los favoritos de nuestros clientes
              </p>
            </div>
            <Button
              variant="ghost"
              className="text-[#00B860] hover:text-[#009B50] hover:bg-green-50"
              onClick={() => navigate('catalog')}
            >
              Ver todos
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((product) => (
              <FeaturedProductCard key={product.id} product={product} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── 7. TESTIMONIALS ────────────────────────────────── */}
      <section className="py-10 sm:py-14 bg-gray-50">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Miles de familias en Cúcuta confían en nosotros
            </p>
          </div>

          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide justify-start md:justify-center">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(-${testIdx * (100 / testimonials.length + 2)}%)`,
                }}
              >
                {testimonials.map((t: Testimonial) => (
                  <TestimonialCard key={t.id} t={t} />
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() =>
                  setTestIdx((prev) =>
                    prev === 0 ? testimonials.length - 1 : prev - 1
                  )
                }
                className="size-9 rounded-full border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-colors hover:bg-gray-100"
                aria-label="Testimonio anterior"
              >
                <ChevronLeft className="size-4 text-gray-600" />
              </button>
              <div className="flex gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTestIdx(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === testIdx
                        ? 'w-6 bg-[#00B860]'
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Testimonio ${i + 1}`}
                  />
                ))}
              </div>
              <button
                onClick={() =>
                  setTestIdx((prev) => (prev + 1) % testimonials.length)
                }
                className="size-9 rounded-full border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-colors hover:bg-gray-100"
                aria-label="Siguiente testimonio"
              >
                <ChevronRight className="size-4 text-gray-600" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── 9. APP DOWNLOAD CTA ────────────────────────────── */}
      <section className="py-10 sm:py-14">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF8C00] via-[#FF9F33] to-[#FFB966] p-8 sm:p-12">
            {/* Decorative elements */}
            <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute top-1/2 left-1/3 w-20 h-20 rounded-full bg-white/5" />

            <div className="relative flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 text-center md:text-left">
                <Badge className="mb-4 bg-white/20 text-white border-none font-medium">
                  <Smartphone className="size-3" />
                  App Móvil
                </Badge>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight">
                  Lleva Supermercados Go
                  <br />
                  en tu bolsillo
                </h3>
                <p className="mt-3 text-sm sm:text-base text-white/85 max-w-md">
                  Descarga nuestra app y realiza tus compras más rápido. Recibe
                  notificaciones de ofertas exclusivas y seguimiento en tiempo real
                  de tu pedido.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-6">
                  <Button className="h-12 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-semibold shadow-lg">
                    <svg viewBox="0 0 24 24" className="size-5 mr-1" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    App Store
                  </Button>
                  <Button className="h-12 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-semibold shadow-lg">
                    <svg viewBox="0 0 24 24" className="size-5 mr-1" fill="currentColor">
                      <path d="M3.18 23.88c-.44-.24-.18-.36-.18-.36V.72s-.14-.18.18-.24l9.68 11.7L3.18 23.88zm16.26-9.72L15.98 12l3.46-2.16 3.86 2.16-3.86 2.16zM4.56.6L14.16 12 4.56 23.4V.6z" />
                    </svg>
                    Google Play
                  </Button>
                </div>
              </div>
              <div className="flex-shrink-0 hidden md:flex items-center justify-center">
                <div className="relative">
                  <div className="w-48 h-80 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-2xl">
                    <div className="text-center">
                      <div className="size-16 mx-auto rounded-2xl bg-white/30 flex items-center justify-center mb-3">
                        <ShoppingCart className="size-8 text-white" />
                      </div>
                      <p className="text-white font-bold text-sm">Supermercados Go</p>
                      <p className="text-white/70 text-xs mt-1">Tu super en línea</p>
                    </div>
                  </div>
                  {/* Phone shadow effect */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/10 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── 10. HOW IT WORKS ───────────────────────────────── */}
      <section className="py-10 sm:py-14 bg-gray-50">
        <motion.div className="max-w-6xl mx-auto px-4" {...fadeUp}>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              ¿Cómo funciona?
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Comprar en Supermercados Go es muy fácil
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                className="relative text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-[#00B860]/30 to-[#FFD93D]/30" />
                )}
                <div className="relative z-10">
                  <div className="mx-auto size-20 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-4 border border-gray-100">
                    <step.icon className="size-9 text-[#00B860]" />
                  </div>
                  <span className="inline-flex items-center justify-center size-7 rounded-full bg-[#FFD93D] text-gray-800 font-bold text-sm mb-3">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-[250px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
