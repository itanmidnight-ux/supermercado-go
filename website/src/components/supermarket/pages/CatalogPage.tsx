'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Flame,
  Home,
  X,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  formatCOP,
  searchProducts,
  getProductsByCategory,
  type Product,
} from '@/store/data-store';
import { useCartStore } from '@/store/cart-store';
import { useNavStore } from '@/store/navigation-store';

// ─── Props ──────────────────────────────────────────────────
interface CatalogPageProps {
  initialCategorySlug?: string;
}

// ─── Sort options ───────────────────────────────────────────
type SortOption = 'relevancia' | 'precio-asc' | 'precio-desc' | 'nombre-az';

const ITEMS_PER_PAGE = 12;

// ─── Animation variants ─────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 },
  },
};

// ─── Component ──────────────────────────────────────────────
export function CatalogPage({ initialCategorySlug }: CatalogPageProps) {
  const addItem = useCartStore((s) => s.addItem);
  const nav = useNavStore();
  const products = useDataStore((s) => s.products);
  const categories = useDataStore((s) => s.categories);

  // State
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialCategorySlug ?? null
  );
  const [sort, setSort] = useState<SortOption>('relevancia');
  const [page, setPage] = useState(1);

  // Listen for search events from HomePage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setQuery(detail);
    };
    window.addEventListener('catalog-search', handler);
    return () => window.removeEventListener('catalog-search', handler);
  }, []);

  // Listen for category events from HomePage
  useEffect(() => {
    const handler = (e: Event) => {
      const slug = (e as CustomEvent).detail;
      if (slug) setSelectedSlug(slug);
    };
    window.addEventListener('catalog-category', handler);
    return () => window.removeEventListener('catalog-category', handler);
  }, []);

  // Resolve category from slug
  const selectedCategory = useMemo(
    () => categories.find((c) => c.slug === selectedSlug) ?? null,
    [selectedSlug]
  );

  // Base product list: if category selected, filter by category; otherwise all
  const baseProducts = useMemo(() => {
    if (selectedCategory) {
      return getProductsByCategory(selectedCategory.id);
    }
    return products;
  }, [selectedCategory]);

  // Filter by search query
  const filteredProducts = useMemo(() => {
    if (!query.trim()) return baseProducts;
    return searchProducts(query).filter((p) =>
      baseProducts.some((bp) => bp.id === p.id)
    );
  }, [baseProducts, query]);

  // Sort products
  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    switch (sort) {
      case 'precio-asc':
        return arr.sort((a, b) => a.price - b.price);
      case 'precio-desc':
        return arr.sort((a, b) => b.price - a.price);
      case 'nombre-az':
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return arr;
    }
  }, [filteredProducts, sort]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = sortedProducts.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Offer products for promo banner
  const offerProducts = useMemo(() => products.filter((p) => p.is_offer), []);

  // Reset page when filters change
  const handleCategorySelect = useCallback((slug: string | null) => {
    setSelectedSlug(slug);
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  const handleSort = useCallback((value: string) => {
    setSort(value as SortOption);
    setPage(1);
  }, []);

  // Add to cart handler
  const handleAddToCart = useCallback(
    (product: Product) => {
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
    },
    [addItem]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        {/* ─── Breadcrumb ──────────────────────────────────── */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => nav.navigate('home')}
              >
                <Home className="inline size-3.5 mr-1" />
                Inicio
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                className="cursor-pointer"
                onClick={() => handleCategorySelect(null)}
              >
                Categorías
              </BreadcrumbLink>
            </BreadcrumbItem>
            {selectedCategory && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{selectedCategory.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* ─── Promo Banner ────────────────────────────────── */}
        {offerProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-5 rounded-xl overflow-hidden"
          >
            <div
              className="relative px-5 py-4 flex items-center gap-4"
              style={{
                background:
                  'linear-gradient(135deg, #FF8C00 0%, #FFD93D 100%)',
              }}
            >
              <Flame className="size-8 text-white shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-white text-base sm:text-lg">
                  ¡Ofertas de la semana!
                </p>
                <p className="text-white/90 text-sm">
                  {offerProducts.length} productos con descuento especial para ti
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto shrink-0 bg-white/90 text-[#FF8C00] hover:bg-white font-semibold"
                onClick={() => handleCategorySelect(null)}
              >
                Ver ofertas
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── Search & Sort Bar ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos, marcas..."
              className="pl-9 h-10"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => handleSearch('')}
                aria-label="Limpiar búsqueda"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select value={sort} onValueChange={handleSort}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SlidersHorizontal className="size-4 mr-1" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevancia">Relevancia</SelectItem>
              <SelectItem value="precio-asc">
                Precio: menor a mayor
              </SelectItem>
              <SelectItem value="precio-desc">
                Precio: mayor a menor
              </SelectItem>
              <SelectItem value="nombre-az">Nombre A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── Category Pills ──────────────────────────────── */}
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                !selectedSlug
                  ? 'text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
              style={
                !selectedSlug
                  ? { backgroundColor: '#00B860' }
                  : undefined
              }
              onClick={() => handleCategorySelect(null)}
            >
              Todos
            </motion.button>
            {categories.map((cat) => (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  selectedSlug === cat.slug
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={
                  selectedSlug === cat.slug
                    ? { backgroundColor: '#00B860' }
                    : undefined
                }
                onClick={() => handleCategorySelect(cat.slug)}
              >
                {cat.name}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ─── Product Count ───────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {sortedProducts.length}
            </span>{' '}
            productos encontrados
          </p>
        </div>

        {/* ─── Product Grid ────────────────────────────────── */}
        {sortedProducts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: '#f0fdf4' }}
            >
              <Search className="size-8" style={{ color: '#00B860' }} />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              No se encontraron productos
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Intenta con otra búsqueda o selecciona una categoría diferente
            </p>
            <Button
              variant="outline"
              onClick={() => {
                handleSearch('');
                handleCategorySelect(null);
              }}
            >
              Limpiar filtros
            </Button>
          </motion.div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              key={`${selectedSlug}-${sort}-${query}`}
            >
              <AnimatePresence mode="popLayout">
                {paginatedProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={itemVariants}
                    layout
                    exit="exit"
                  >
                    <Card className="group relative overflow-hidden rounded-xl border py-0 gap-0 transition-shadow hover:shadow-md">
                      {/* Discount badge */}
                      {product.is_offer && product.compare_price && (
                        <Badge
                          className="absolute top-2 left-2 z-10 text-xs font-bold px-2 py-0.5"
                          style={{
                            backgroundColor: '#FF8C00',
                            color: 'white',
                          }}
                        >
                          -{Math.round(((product.compare_price - product.price) / product.compare_price) * 100)}%
                        </Badge>
                      )}

                      {/* Product image */}
                      <div
                        className="relative aspect-square bg-gray-50 overflow-hidden cursor-pointer"
                        onClick={() => nav.openProduct(product.id)}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs gap-1 bg-white/90 hover:bg-white shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              nav.openProduct(product.id);
                            }}
                          >
                            <Eye className="size-3.5" />
                            Ver detalle
                          </Button>
                        </div>
                      </div>

                      <CardContent className="p-3 flex flex-col gap-1.5">
                        {/* Brand */}
                        <p className="text-xs text-muted-foreground truncate">
                          {product.brand}
                        </p>

                        {/* Name */}
                        <h3
                          className="text-sm font-medium leading-tight line-clamp-2 cursor-pointer hover:underline"
                          onClick={() => nav.openProduct(product.id)}
                        >
                          {product.name}
                        </h3>

                        {/* Unit */}
                        <p className="text-xs text-muted-foreground">
                          {product.unit === 'un'
                            ? 'Unidad'
                            : product.unit}
                        </p>

                        {/* Price */}
                        <div className="flex flex-col gap-0.5 mt-auto pt-1">
                          {product.is_offer && product.compare_price && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCOP(product.compare_price)}
                            </span>
                          )}
                          <span
                            className="text-base font-bold"
                            style={{ color: '#00B860' }}
                          >
                            {formatCOP(product.price)}
                          </span>
                        </div>

                        {/* Add to cart button */}
                        <Button
                          size="sm"
                          className="mt-1 w-full text-xs font-semibold text-white gap-1.5 cursor-pointer"
                          style={{ backgroundColor: '#00B860' }}
                          onMouseEnter={
                            (e) =>
                              (e.currentTarget.style.backgroundColor =
                                '#00a050')
                          }
                          onMouseLeave={
                            (e) =>
                              (e.currentTarget.style.backgroundColor =
                                '#00B860')
                          }
                          onClick={() => handleAddToCart(product)}
                        >
                          <Plus className="size-3.5" />
                          Agregar
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* ─── Pagination ───────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8 mb-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      // Show first, last, current, and adjacent pages
                      const isCurrent = pageNum === page;
                      const isNearCurrent =
                        Math.abs(pageNum - page) <= 1;
                      const isFirst = pageNum === 1;
                      const isLast = pageNum === totalPages;
                      const showPage =
                        isCurrent || isNearCurrent || isFirst || isLast;

                      if (!showPage) {
                        // Show ellipsis
                        const prevPageNum =
                          Array.from(
                            { length: totalPages },
                            (_, i) => i + 1
                          )
                            .filter(
                              (n) =>
                                n === 1 ||
                                n === totalPages ||
                                Math.abs(n - page) <= 1
                            )
                            .pop();
                        if (pageNum !== prevPageNum) {
                          return (
                            <span
                              key={`ellipsis-${pageNum}`}
                              className="px-1 text-muted-foreground"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={isCurrent ? 'default' : 'outline'}
                          size="icon"
                          className="size-9"
                          style={
                            isCurrent
                              ? {
                                  backgroundColor: '#00B860',
                                  color: 'white',
                                  borderColor: '#00B860',
                                }
                              : undefined
                          }
                          onClick={() => setPage(pageNum)}
                          aria-label={`Página ${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    }
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="size-9"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
