import { create } from 'zustand';
import { useAuthStore } from './auth-store';

const API_BASE = typeof window !== 'undefined'
  ? (window as any).__API_BASE || `${window.location.protocol}//${window.location.hostname}:3777`
  : 'http://127.0.0.1:3777';

export interface WorkerOrder {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  phone: string;
  address: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  total: number;
  status: string;
  payment_method: string;
  notes: string;
  items: any[];
  created_at: string;
  assigned_to: string | null;
  verification_code: string | null;
  worker_lat: number | null;
  worker_lng: number | null;
}

interface WorkerState {
  availableOrders: WorkerOrder[];
  myActiveOrder: WorkerOrder | null;
  deliveryCode: string | null;
  isTracking: boolean;
  loading: boolean;
  error: string | null;
  // Actions
  fetchAvailableOrders: (token: string) => Promise<void>;
  claimOrder: (token: string, orderId: string) => Promise<boolean>;
  startDelivery: (token: string, orderId: string) => Promise<boolean>;
  completeDelivery: (token: string, orderId: string, code: string) => Promise<boolean>;
  cancelDelivery: (token: string, orderId: string) => Promise<boolean>;
  updateLocation: (token: string, orderId: string, lat: number, lng: number) => Promise<void>;
  fetchMyActiveOrder: (token: string) => Promise<void>;
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

export const useWorkerStore = create<WorkerState>()((set, get) => ({
  availableOrders: [],
  myActiveOrder: null,
  deliveryCode: null,
  isTracking: false,
  loading: false,
  error: null,

  fetchAvailableOrders: async (token) => {
    try {
      set({ loading: true });
      const data = await api(token, 'GET', '/api/orders?status=confirmed&limit=50');
      const orders = data.data || data.orders || data || [];
      // Filter orders not assigned to anyone
      const available = orders.filter((o: WorkerOrder) => !o.assigned_to || o.assigned_to === '');
      set({ availableOrders: available, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  claimOrder: async (token, orderId) => {
    try {
      // Update order status to 'preparing' and assign to worker
      await api(token, 'PUT', `/api/orders/${orderId}/status`, { status: 'preparing' });
      // Try to assign via a custom field
      try {
        await fetch(`${API_BASE}/api/orders/${orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ assigned_to: 'me' }),
        });
      } catch {}
      await get().fetchAvailableOrders(token);
      await get().fetchMyActiveOrder(token);
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  startDelivery: async (token, orderId) => {
    try {
      await api(token, 'PUT', `/api/orders/${orderId}/status`, { status: 'delivering' });
      // Generate verification code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      set({ deliveryCode: code, isTracking: true });
      await get().fetchMyActiveOrder(token);
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  completeDelivery: async (token, orderId, code) => {
    try {
      if (get().deliveryCode && code !== get().deliveryCode) {
        set({ error: 'Código de verificación incorrecto' });
        return false;
      }
      await api(token, 'PUT', `/api/orders/${orderId}/status`, { status: 'delivered' });
      set({ myActiveOrder: null, deliveryCode: null, isTracking: false });
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  cancelDelivery: async (token, orderId) => {
    try {
      await api(token, 'PUT', `/api/orders/${orderId}/status`, { status: 'confirmed' });
      set({ myActiveOrder: null, deliveryCode: null, isTracking: false });
      await get().fetchAvailableOrders(token);
      return true;
    } catch (e: any) {
      set({ error: e.message });
      return false;
    }
  },

  updateLocation: async (token, orderId, lat, lng) => {
    try {
      set({ isTracking: true });
      // Try to update location on server
      try {
        await fetch(`${API_BASE}/api/orders/${orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ worker_lat: lat, worker_lng: lng }),
        });
      } catch {}
    } catch {}
  },

  fetchMyActiveOrder: async (token) => {
    try {
      const data = await api(token, 'GET', '/api/orders?status=preparing&limit=10');
      const orders = data.data || data.orders || data || [];
      const myOrder = orders.find((o: WorkerOrder) =>
        o.assigned_to === 'me' || o.status === 'preparing' || o.status === 'delivering'
      );
      set({ myActiveOrder: myOrder || null });
      if (myOrder?.status === 'delivering') {
        set({ isTracking: true });
      }
    } catch {}
  },
}));

export { API_BASE };
