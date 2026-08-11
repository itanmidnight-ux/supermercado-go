import { create } from 'zustand';
import { useAuthStore } from './auth-store';

const API_BASE = typeof window !== 'undefined'
  ? (window as any).__API_BASE || `${window.location.protocol}//${window.location.hostname}:3777`
  : 'http://127.0.0.1:3777';

interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  total_users: number;
  active_orders: number;
  recent_orders: any[];
  sales_by_day: any[];
  top_products: any[];
}

interface AdminState {
  stats: DashboardStats | null;
  products: any[];
  categories: any[];
  orders: any[];
  users: any[];
  settings: Record<string, string>;
  loading: boolean;
  error: string | null;
  // Dashboard
  fetchDashboard: (token: string) => Promise<void>;
  // Products
  fetchProducts: (token: string) => Promise<void>;
  createProduct: (token: string, data: any) => Promise<any>;
  updateProduct: (token: string, id: string, data: any) => Promise<any>;
  deleteProduct: (token: string, id: string) => Promise<any>;
  // Categories
  fetchCategories: (token: string) => Promise<void>;
  createCategory: (token: string, data: any) => Promise<any>;
  updateCategory: (token: string, id: string, data: any) => Promise<any>;
  deleteCategory: (token: string, id: string) => Promise<any>;
  // Orders
  fetchOrders: (token: string) => Promise<void>;
  updateOrderStatus: (token: string, id: string, status: string) => Promise<any>;
  // Users
  fetchUsers: (token: string) => Promise<void>;
  // Settings
  fetchSettings: (token: string) => Promise<void>;
  updateSettings: (token: string, data: Record<string, string>) => Promise<any>;
}

async function api(token: string, method: string, path: string, body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();

  // 401: token inválido/expirado → cerrar sesión automáticamente y volver a login
  if (res.status === 401) {
    try {
      useAuthStore.getState().logout();
      // Navegación SPA suave (no recarga completa)
      const { useNavStore } = await import('./navigation-store');
      useNavStore.getState().navigate('login');
    } catch {
      if (typeof window !== 'undefined') window.location.href = '/';
    }
    throw new Error(data.error || 'La sesión ha expirado. Inicia sesión nuevamente.');
  }

  if (!res.ok) throw new Error(data.error || 'Error en la petición');
  return data;
}

export const useAdminStore = create<AdminState>()((set, get) => ({
  stats: null,
  products: [],
  categories: [],
  orders: [],
  users: [],
  settings: {},
  loading: false,
  error: null,

  fetchDashboard: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/analytics/dashboard');
      set({ stats: data.data || data });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchProducts: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/products?limit=200');
      set({ products: data.data || data.products || data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  createProduct: async (token, productData) => {
    const data = await api(token, 'POST', '/api/products', productData);
    await get().fetchProducts(token);
    return data;
  },

  updateProduct: async (token, id, productData) => {
    const data = await api(token, 'PUT', `/api/products/${id}`, productData);
    await get().fetchProducts(token);
    return data;
  },

  deleteProduct: async (token, id) => {
    const data = await api(token, 'DELETE', `/api/products/${id}`);
    await get().fetchProducts(token);
    return data;
  },

  fetchCategories: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/categories');
      set({ categories: data.data || data.categories || data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  createCategory: async (token, catData) => {
    const data = await api(token, 'POST', '/api/categories', catData);
    await get().fetchCategories(token);
    return data;
  },

  updateCategory: async (token, id, catData) => {
    const data = await api(token, 'PUT', `/api/categories/${id}`, catData);
    await get().fetchCategories(token);
    return data;
  },

  deleteCategory: async (token, id) => {
    const data = await api(token, 'DELETE', `/api/categories/${id}`);
    await get().fetchCategories(token);
    return data;
  },

  fetchOrders: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/orders?limit=100');
      set({ orders: data.data || data.orders || data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  updateOrderStatus: async (token, id, status) => {
    const data = await api(token, 'PUT', `/api/orders/${id}/status`, { status });
    await get().fetchOrders(token);
    return data;
  },

  fetchUsers: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/users');
      set({ users: data.data || data.users || data || [] });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchSettings: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/settings');
      set({ settings: data.data || {} });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  updateSettings: async (token, settingsData) => {
    const results = [];
    for (const [key, value] of Object.entries(settingsData)) {
      try {
        await api(token, 'PUT', '/api/settings', { key, value });
        results.push({ key, ok: true });
      } catch (e: any) {
        results.push({ key, ok: false, error: e.message });
      }
    }
    await get().fetchSettings(token);
    return results;
  },
}));

export { API_BASE };
