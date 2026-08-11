import { create } from 'zustand';

const API_BASE = typeof window !== 'undefined'
  ? (window as any).__API_BASE || `${window.location.protocol}//${window.location.hostname}:3777`
  : 'http://127.0.0.1:3777';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  compare_price: number | null;
  unit: string;
  stock: number;
  image: string;
  category_id: string;
  category_name: string;
  is_offer: boolean;
  is_featured: boolean;
  is_active: boolean;
  brand: string;
  sku: string;
  nutrition_facts?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image: string;
  product_count: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  bg_color: string;
  text_color: string;
  link_type: string;
  link_value: string;
  sort_order: number;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  comment: string;
  rating: number;
  avatar: string;
}

export interface Order {
  id: string;
  status: string;
  status_label: string;
  items: { product_name: string; qty: number; unit_price: number; image: string }[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  payment_method: string;
  address: string;
  created_at: string;
  timeline: { status: string; label: string; time: string }[];
}

export interface Address {
  id: string;
  label: string;
  address: string;
  detail: string;
  neighborhood: string;
  city: string;
  is_default: boolean;
}

export interface FAQ {
  question: string;
  answer: string;
}

interface DataState {
  products: Product[];
  categories: Category[];
  banners: Banner[];
  testimonials: Testimonial[];
  faqs: FAQ[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  fetchProducts: (params?: Record<string, string>) => Promise<Product[]>;
  fetchCategories: () => Promise<Category[]>;
}

function mapProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: p.price || 0,
    compare_price: p.compare_price || null,
    unit: p.unit || 'un',
    stock: p.stock || 0,
    image: p.image || `https://placehold.co/400x400/f0fdf4/00B860?text=${encodeURIComponent(p.name?.substring(0, 10) || 'Producto')}&font=raleway`,
    category_id: p.category_id || '',
    category_name: p.category_name || p.category || '',
    is_offer: !!p.is_offer,
    is_featured: !!p.is_featured,
    is_active: p.is_active !== 0,
    brand: p.brand || '',
    sku: p.sku || '',
  };
}

function mapCategory(c: any): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || '',
    icon: c.icon || 'Package',
    image: c.image || `https://placehold.co/400x400/f0fdf4/00B860?text=${encodeURIComponent(c.name?.substring(0, 8) || 'Cat')}&font=raleway`,
    product_count: c.product_count || 0,
  };
}

export const useDataStore = create<DataState>()((set, get) => ({
  products: [],
  categories: [],
  banners: [],
  testimonials: [
    { id: 't1', name: 'María Fernanda López', role: 'Cliente desde 2023', comment: 'Supermercados Go cambió mi vida. Ya no pierdo horas en el supermercado, todo llega fresco y a tiempo.', rating: 5, avatar: 'ML' },
    { id: 't2', name: 'Andrés Ricardo Pérez', role: 'Cliente desde 2024', comment: 'Los precios son competitivos y la atención al cliente es excelente.', rating: 5, avatar: 'AP' },
    { id: 't3', name: 'Laura Valentina Martínez', role: 'Cliente desde 2023', comment: 'Me encanta la variedad de productos. Puedo encontrar todo en un solo lugar.', rating: 4, avatar: 'LM' },
    { id: 't4', name: 'Jorge Enrique Ramírez', role: 'Cliente desde 2024', comment: 'La app es muy fácil de usar y los repartidores son muy amables.', rating: 5, avatar: 'JR' },
  ],
  faqs: [
    { question: '¿Cuáles son las zonas de entrega?', answer: 'Realizamos entregas en Cúcuta, Los Patios, Villa del Rosario, Pamplonita y El Zulia. Tiempo estimado: 30-60 minutos.' },
    { question: '¿Cuáles son los métodos de pago?', answer: 'Aceptamos efectivo, Nequi, Daviplata, tarjeta de crédito/débito y PSE.' },
    { question: '¿Cuál es el pedido mínimo?', answer: 'No tenemos pedido mínimo. Puedes ordenar desde un solo producto.' },
    { question: '¿Cómo puedo rastrear mi pedido?', answer: 'Desde la sección "Mis Pedidos" puedes ver el estado en tiempo real.' },
    { question: '¿Puedo programar un pedido?', answer: 'Sí, puedes elegir fecha y hora de entrega dentro de nuestro horario (6am - 9pm).' },
    { question: '¿Qué hago si un producto llega dañado?', answer: 'Reportalo dentro de 2 horas y te ofrecemos reemplazo o reembolso.' },
    { question: '¿Ofrecen recolección en tienda?', answer: 'Sí, selecciona "Recoger en tienda" al hacer tu pedido.' },
    { question: '¿Cómo funcionan los códigos promocionales?', answer: 'Ingresa tu código en el carrito. Los descuentos se aplican automáticamente.' },
  ],
  loading: false,
  loaded: false,
  error: null,

  fetchAll: async () => {
    if (get().loaded) return;
    set({ loading: true });
    try {
      const [prodRes, catRes, setRes] = await Promise.all([
        fetch(`${API_BASE}/api/products?limit=100`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`${API_BASE}/api/categories`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
        fetch(`${API_BASE}/api/settings`).then(r => r.ok ? r.json() : { data: {} }).catch(() => ({ data: {} })),
      ]);

      const rawProducts = prodRes.data || prodRes.products || prodRes || [];
      const rawCategories = catRes.data || catRes.categories || catRes || [];

      const products = Array.isArray(rawProducts) ? rawProducts.map(mapProduct) : [];
      const categories = Array.isArray(rawCategories) ? rawCategories.map(mapCategory) : [];

      set({ products, categories, banners: [], loading: false, loaded: true });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchProducts: async (params) => {
    try {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await fetch(`${API_BASE}/api/products${qs}`);
      const data = await res.json();
      const raw = data.data || data.products || data || [];
      return Array.isArray(raw) ? raw.map(mapProduct) : [];
    } catch {
      return [];
    }
  },

  fetchCategories: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`);
      const data = await res.json();
      const raw = data.data || data.categories || data || [];
      const categories = Array.isArray(raw) ? raw.map(mapCategory) : [];
      set({ categories });
      return categories;
    } catch {
      return [];
    }
  },
}));

export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export const getProductsByCategory = (catId: string) => useDataStore.getState().products.filter((p) => p.category_id === catId);
export const getOffers = () => useDataStore.getState().products.filter((p) => p.is_offer);
export const getFeatured = () => useDataStore.getState().products.filter((p) => p.is_active).slice(0, 8);
export const searchProducts = (q: string) => {
  const lower = q.toLowerCase();
  return useDataStore.getState().products.filter(
    (p) => p.name.toLowerCase().includes(lower) || p.brand.toLowerCase().includes(lower) || p.category_name.toLowerCase().includes(lower)
  );
};
export const getProductById = (id: string) => useDataStore.getState().products.find((p) => p.id === id);
export const getRelatedProducts = (productId: string, limit = 4) => {
  const product = getProductById(productId);
  if (!product) return [];
  return useDataStore.getState().products.filter((p) => p.category_id === product.category_id && p.id !== productId).slice(0, limit);
};

// Exported as getter for components that import directly
export const categories = useDataStore.getState().categories;

// ─── Mock addresses (for checkout) ─────────────────────────
export const mockAddresses: Address[] = [
  { id: 'addr1', label: 'Casa', address: 'Calle 5 #12-34', detail: 'Apto 302, Torre B', neighborhood: 'La Playa', city: 'Cúcuta', is_default: true },
  { id: 'addr2', label: 'Oficina', address: 'Av. 7 #22-18', detail: 'Oficina 501', neighborhood: 'Centro', city: 'Cúcuta', is_default: false },
];

// ─── Mock promo codes ──────────────────────────────────────
export const promoCodes: Record<string, { discount: number; type: 'porcentaje' | 'monto_fijo'; min_order: number; description: string }> = {
  'BIENVENIDO10': { discount: 10, type: 'porcentaje', min_order: 20000, description: '10% de descuento para nuevos clientes' },
  'SUPER5000': { discount: 5000, type: 'monto_fijo', min_order: 30000, description: '$5.000 de descuento en pedidos +$30.000' },
  'ENVIOGRATIS': { discount: 3500, type: 'monto_fijo', min_order: 15000, description: 'Envío gratis en pedidos +$15.000' },
};

// ─── Mock orders (for demo) ────────────────────────────────
export const mockOrders: Order[] = [];
