'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  ShoppingCart,
  Lock,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDataStore, formatCOP, type Product } from '@/store/data-store';
import { useCartStore } from '@/store/cart-store';
import { useNavStore } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { useFavoritesStore } from '@/store/favorites-store';

// ─── Animation variants ─────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.25 },
  },
};

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Component ──────────────────────────────────────────────
export function FavoritesPage() {
  const { isLoggedIn } = useAuthStore();
  const { navigate, openProduct } = useNavStore();
  const addItem = useCartStore((s) => s.addItem);
  const products = useDataStore((s) => s.products);
  const favoriteIds = useFavoritesStore((s) => s.ids);
  const removeFavorite = useFavoritesStore((s) => s.remove);

  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));

  // ── Locked state ──
  if (!isLoggedIn) {
    return (
      <motion.section
        className="min-h-[60vh] flex items-center justify-center px-4"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        <Card className="max-w-md w-full text-center p-8 shadow-lg border-0">
          <CardContent className="flex flex-col items-center gap-5 pt-0">
            <div className="w-20 h-20 rounded-full bg-[#FFF3E0] flex items-center justify-center">
              <Lock className="w-10 h-10 text-[#FF8C00]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Inicia sesión para ver tus favoritos
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Guarda los productos que más te gusten y accede a ellos
                fácilmente desde cualquier dispositivo.
              </p>
            </div>
            <Button
              onClick={() => navigate('login')}
              className="bg-[#00B860] hover:bg-[#009E52] text-white font-semibold px-8 py-3 rounded-xl text-base cursor-pointer"
            >
              Iniciar sesión
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  // ── Empty state ──
  if (favoriteProducts.length === 0) {
    return (
      <motion.section
        className="min-h-[60vh] flex items-center justify-center px-4"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        <Card className="max-w-md w-full text-center p-8 shadow-lg border-0">
          <CardContent className="flex flex-col items-center gap-5 pt-0">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
              <Heart className="w-10 h-10 text-red-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Aún no tienes favoritos
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Explora nuestro catálogo y guarda los productos que más te gusten
                haciendo clic en el corazón.
              </p>
            </div>
            <Button
              onClick={() => navigate('catalog')}
              className="bg-[#00B860] hover:bg-[#009E52] text-white font-semibold px-8 py-3 rounded-xl text-base cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ir al catálogo
            </Button>
          </CardContent>
        </Card>
      </motion.section>
    );
  }

  // ── Grid of favorites ──
  return (
    <motion.section
      className="max-w-7xl mx-auto px-4 py-6"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <Heart className="w-5 h-5 text-red-500" fill="currentColor" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Favoritos</h1>
          <p className="text-sm text-gray-500">
            {favoriteProducts.length} producto{favoriteProducts.length !== 1 ? 's' : ''} guardado{favoriteProducts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Product grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence mode="popLayout">
          {favoriteProducts.map((product) => (
            <ProductFavCard
              key={product.id}
              product={product}
              onRemove={removeFavorite}
              onAddToCart={addItem}
              onOpenProduct={(id) => openProduct(id)}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
}

// ─── Favorite Card ──────────────────────────────────────────
interface ProductFavCardProps {
  product: Product;
  onRemove: (id: string) => void;
  onAddToCart: (item: Omit<import('@/store/cart-store').CartItem, 'qty'>) => void;
  onOpenProduct: (id: string) => void;
}

function ProductFavCard({ product, onRemove, onAddToCart, onOpenProduct }: ProductFavCardProps) {
  const discount =
    product.compare_price && product.compare_price > product.price
      ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
      : 0;

  return (
    <motion.div variants={cardVariants} layout exit="exit">
      <Card className="group relative overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow duration-300">
        {/* Image */}
        <div
          className="relative aspect-square overflow-hidden bg-gray-50 cursor-pointer"
          onClick={() => onOpenProduct(product.id)}
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          {/* Offer badge */}
          {product.is_offer && discount > 0 && (
            <Badge className="absolute top-2 left-2 bg-[#FF8C00] text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border-0">
              -{discount}%
            </Badge>
          )}

          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(product.id);
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-red-50 transition-colors cursor-pointer"
            aria-label={`Eliminar ${product.name} de favoritos`}
          >
            <Heart className="w-4 h-4 text-red-500" fill="currentColor" />
          </button>
        </div>

        {/* Info */}
        <CardContent className="p-3">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">
            {product.brand}
          </p>
          <h3
            className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug mb-2 cursor-pointer hover:text-[#00B860] transition-colors"
            onClick={() => onOpenProduct(product.id)}
          >
            {product.name}
          </h3>

          {/* Price */}
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-base font-bold text-gray-900">
              {formatCOP(product.price)}
            </span>
            {product.compare_price && product.compare_price > product.price && (
              <span className="text-xs text-gray-400 line-through">
                {formatCOP(product.compare_price)}
              </span>
            )}
          </div>

          {/* Add to cart */}
          <Button
            size="sm"
            className="w-full bg-[#00B860] hover:bg-[#009E52] text-white text-xs font-semibold rounded-lg py-2 cursor-pointer"
            onClick={() =>
              onAddToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.compare_price,
                image: product.image,
                quantity: '1',
                unit: product.unit,
                categoryName: product.category_name,
              })
            }
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
            Agregar al carrito
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
