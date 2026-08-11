'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Minus,
  Heart,
  Share2,
  Truck,
  ShieldCheck,
  RotateCcw,
  Home,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  useDataStore,
  getProductById,
  getRelatedProducts,
  formatCOP,
  type Product,
} from '@/store/data-store';
import { useCartStore } from '@/store/cart-store';
import { useNavStore } from '@/store/navigation-store';
import { useFavoritesStore } from '@/store/favorites-store';
import { useToast } from '@/components/ui/toaster';

// ─── Animation ──────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.07 },
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Trust Badges ───────────────────────────────────────────
const trustBadges = [
  { icon: Truck, label: 'Entrega 30-60 min', desc: 'Rápido y puntual' },
  { icon: ShieldCheck, label: 'Pago seguro', desc: 'Protegido al 100%' },
  { icon: RotateCcw, label: 'Devolución fácil', desc: 'Sin complicaciones' },
];

// ─── Component ──────────────────────────────────────────────
export function ProductDetailPage() {
  const productDetailId = useNavStore((s) => s.productDetailId);
  const goBack = useNavStore((s) => s.goBack);
  const openProduct = useNavStore((s) => s.openProduct);
  const navigate = useNavStore((s) => s.navigate);
  const addItem = useCartStore((s) => s.addItem);
  const { toast } = useToast();

  const [qty, setQty] = useState(1);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const isFavorite = useFavoritesStore((s) => productDetailId ? s.ids.includes(productDetailId) : false);

  // Get product
  const product: Product | undefined = useMemo(
    () => (productDetailId ? getProductById(productDetailId) : undefined),
    [productDetailId]
  );

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [productDetailId]);

  // Related products
  const relatedProducts: Product[] = useMemo(
    () => (productDetailId ? getRelatedProducts(productDetailId, 4) : []),
    [productDetailId]
  );

  // Discount percentage
  const discountPct = useMemo(() => {
    if (!product?.is_offer || !product.compare_price) return 0;
    return Math.round(
      ((product.compare_price - product.price) / product.compare_price) * 100
    );
  }, [product]);

  // Handlers
  const handleAddToCart = useCallback(() => {
    if (!product) return;
    for (let i = 0; i < qty; i++) {
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
    }
    toast({
      title: '¡Agregado al carrito!',
      description: `${qty}x ${product.name}`,
      duration: 2500,
    });
    setQty(1);
  }, [product, qty, addItem, toast]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: `Mira este producto en Supermercados Go: ${product?.name} - ${product ? formatCOP(product.price) : ''}`,
      }).catch(() => {});
    } else {
      toast({
        title: 'Enlace copiado',
        description: 'El enlace del producto fue copiado al portapapeles',
        duration: 2000,
      });
    }
  }, [product, toast]);

  // ─── Not Found ──────────────────────────────────────────
  if (!product) {
    return (
      <motion.div
        className="min-h-screen bg-background flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center px-4">
          <div
            className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: '#fef2f2' }}
          >
            <Eye className="size-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Producto no encontrado</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Lo sentimos, el producto que buscas no existe o fue removido.
          </p>
          <Button
            className="font-semibold text-white gap-2 cursor-pointer"
            style={{ backgroundColor: '#00B860' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
            onClick={goBack}
          >
            <ArrowLeft className="size-4" />
            Volver atrás
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        {/* ─── Breadcrumb ────────────────────────────────── */}
        <Breadcrumb className="mb-5">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => navigate('home')}
              >
                <Home className="inline size-3.5 mr-1" />
                Inicio
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => navigate('catalog')}
              >
                Categorías
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => navigate('catalog')}
              >
                {product.category_name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1 max-w-[200px]">
                {product.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* ─── Back Button ────────────────────────────────── */}
        <Button
          variant="ghost"
          className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={goBack}
        >
          <ArrowLeft className="size-4" />
          Volver
        </Button>

        {/* ─── Main Product Section ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 mb-10">
          {/* Left: Image */}
          <motion.div {...fadeUp}>
            <div className="relative rounded-2xl overflow-hidden bg-gray-50 aspect-square">
              {product.is_offer && discountPct > 0 && (
                <Badge
                  className="absolute top-4 left-4 z-10 text-sm font-bold px-3 py-1 shadow-md"
                  style={{ backgroundColor: '#FF8C00', color: 'white' }}
                >
                  -{discountPct}%
                </Badge>
              )}
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>

          {/* Right: Details */}
          <motion.div
            className="flex flex-col gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Brand Badge */}
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="text-xs font-medium">
                {product.brand}
              </Badge>
            </motion.div>

            {/* Product Name */}
            <motion.h1
              className="text-2xl sm:text-3xl font-bold leading-tight"
              variants={fadeUp}
            >
              {product.name}
            </motion.h1>

            {/* Category Badge */}
            <motion.div variants={fadeUp}>
              <Badge
                className="text-xs font-medium"
                style={{ backgroundColor: '#FFD93D', color: '#333333' }}
              >
                {product.category_name}
              </Badge>
            </motion.div>

            {/* Unit */}
            <motion.p
              className="text-sm text-muted-foreground"
              variants={fadeUp}
            >
              Unidad:{' '}
              <span className="font-medium text-foreground">
                {product.unit === 'un' ? 'Unidad' : product.unit}
              </span>
            </motion.p>

            {/* Price Block */}
            <motion.div className="flex flex-col gap-1" variants={fadeUp}>
              {product.is_offer && product.compare_price && (
                <div className="flex items-center gap-2">
                  <span className="text-lg text-muted-foreground line-through">
                    {formatCOP(product.compare_price)}
                  </span>
                  <Badge
                    className="text-xs font-bold"
                    style={{
                      backgroundColor: '#FFF0E0',
                      color: '#FF8C00',
                      border: '1px solid #FF8C00',
                    }}
                  >
                    Ahorras {formatCOP(product.compare_price - product.price)}
                  </Badge>
                </div>
              )}
              <span
                className="text-3xl sm:text-4xl font-extrabold"
                style={{ color: '#00B860' }}
              >
                {formatCOP(product.price)}
              </span>
              {product.is_offer && discountPct > 0 && (
                <p className="text-sm font-medium" style={{ color: '#FF8C00' }}>
                  {discountPct}% de descuento
                </p>
              )}
            </motion.div>

            {/* Quantity Selector + Add to Cart */}
            <motion.div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2" variants={fadeUp}>
              {/* Quantity selector */}
              <div className="flex items-center border rounded-lg overflow-hidden h-12">
                <button
                  className="flex items-center justify-center w-12 h-full hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Reducir cantidad"
                >
                  <Minus className="size-4" />
                </button>
                <span className="flex items-center justify-center w-12 h-full text-base font-semibold border-x">
                  {qty}
                </span>
                <button
                  className="flex items-center justify-center w-12 h-full hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  disabled={qty >= product.stock}
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {/* Add to cart button */}
              <Button
                size="lg"
                className="flex-1 h-12 text-base font-bold text-white gap-2 cursor-pointer"
                style={{ backgroundColor: '#00B860' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                onClick={handleAddToCart}
              >
                <Plus className="size-5" />
                Agregar al carrito
              </Button>
            </motion.div>

            {/* Action buttons: Favorite + Share */}
            <motion.div
              className="flex items-center gap-3 mt-1"
              variants={fadeUp}
            >
              <Button
                variant="outline"
                size="sm"
                className="gap-2 cursor-pointer"
                onClick={() => product && toggleFavorite(product.id)}
              >
                <Heart
                  className="size-4"
                  fill={isFavorite ? '#FF8C00' : 'none'}
                  stroke={isFavorite ? '#FF8C00' : 'currentColor'}
                />
                {isFavorite ? 'En favoritos' : 'Agregar a favoritos'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 cursor-pointer"
                onClick={handleShare}
              >
                <Share2 className="size-4" />
                Compartir
              </Button>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4"
              variants={fadeUp}
            >
              {trustBadges.map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center gap-2.5 rounded-lg border p-3"
                >
                  <div
                    className="flex items-center justify-center size-9 rounded-full shrink-0"
                    style={{ backgroundColor: '#f0fdf4' }}
                  >
                    <badge.icon className="size-4" style={{ color: '#00B860' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-tight">
                      {badge.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {badge.desc}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* ─── Description Section ────────────────────────── */}
        <motion.section
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-xl font-bold mb-3">Descripción del producto</h2>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">SKU:</span>{' '}
                  {product.sku}
                </span>
                <span>
                  <span className="font-medium text-foreground">Marca:</span>{' '}
                  {product.brand}
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    Disponibilidad:
                  </span>{' '}
                  <span style={{ color: '#00B860' }} className="font-medium">
                    {product.stock > 0
                      ? `En stock (${product.stock} disponibles)`
                      : 'Agotado'}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* ─── Related Products ───────────────────────────── */}
        {relatedProducts.length > 0 && (
          <motion.section
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-xl font-bold mb-4">Productos relacionados</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map((rp) => (
                <motion.div
                  key={rp.id}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="group relative overflow-hidden rounded-xl border py-0 gap-0 transition-shadow hover:shadow-md">
                    {rp.is_offer && rp.compare_price && (
                      <Badge
                        className="absolute top-2 left-2 z-10 text-[10px] font-bold px-1.5 py-0.5"
                        style={{ backgroundColor: '#FF8C00', color: 'white' }}
                      >
                        -{Math.round(((rp.compare_price - rp.price) / rp.compare_price) * 100)}%
                      </Badge>
                    )}
                    <div
                      className="relative aspect-square bg-gray-50 overflow-hidden cursor-pointer"
                      onClick={() => openProduct(rp.id)}
                    >
                      <img
                        src={rp.image}
                        alt={rp.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-3 flex flex-col gap-1">
                      <p className="text-[11px] text-muted-foreground truncate">
                        {rp.brand}
                      </p>
                      <h4
                        className="text-sm font-medium leading-tight line-clamp-2 cursor-pointer hover:underline"
                        onClick={() => openProduct(rp.id)}
                      >
                        {rp.name}
                      </h4>
                      <div className="flex flex-col gap-0.5 mt-auto pt-1">
                        {rp.is_offer && rp.compare_price && (
                          <span className="text-[11px] text-muted-foreground line-through">
                            {formatCOP(rp.compare_price)}
                          </span>
                        )}
                        <span
                          className="text-sm font-bold"
                          style={{ color: '#00B860' }}
                        >
                          {formatCOP(rp.price)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="mt-1 w-full text-xs font-semibold text-white gap-1 cursor-pointer"
                        style={{ backgroundColor: '#00B860' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                        onClick={() => {
                          addItem({
                            id: rp.id,
                            name: rp.name,
                            price: rp.price,
                            originalPrice: rp.compare_price,
                            image: rp.image,
                            quantity: '1',
                            unit: rp.unit,
                            categoryName: rp.category_name,
                          });
                        }}
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
    </motion.div>
  );
}
