import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = typeof window !== 'undefined'
  ? (window as any).__API_BASE || `${window.location.protocol}//${window.location.hostname}:3777`
  : 'http://127.0.0.1:3777';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string | null;
  pinVerified: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<{ verified: boolean; error?: string; blocked?: boolean; remainingMinutes?: number }>;
  setPinVerified: (verified: boolean) => void;
  register: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      loading: false,
      error: null,
      pinVerified: false,

      login: async (email: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (res.ok && data.token) {
            set({
              user: { id: data.user.id, name: data.user.name, email: data.user.email, phone: data.user.phone, avatar: data.user.avatar, role: data.user.role },
              token: data.token,
              isLoggedIn: true,
              loading: false,
              pinVerified: false,
            });
            return true;
          }
          set({ error: data.error || 'Credenciales incorrectas', loading: false });
          return false;
        } catch {
          set({ error: 'Error de conexión con el servidor', loading: false });
          return false;
        }
      },

      register: async (name: string, email: string, phone: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password }),
          });
          const data = await res.json();
          if (res.ok && data.token) {
            set({
              user: { id: data.user.id, name: data.user.name, email: data.user.email, phone: data.user.phone, role: data.user.role },
              token: data.token,
              isLoggedIn: true,
              loading: false,
            });
            return true;
          }
          set({ error: data.error || 'Error al registrarse', loading: false });
          return false;
        } catch {
          set({ error: 'Error de conexión con el servidor', loading: false });
          return false;
        }
      },

      logout: () => set({ user: null, token: null, isLoggedIn: false, pinVerified: false, error: null }),

      verifyPin: async (pin: string) => {
        const { token } = get();
        if (!token) return { verified: false, error: 'No autenticado' };
        try {
          const res = await fetch(`${API_BASE}/api/auth/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ pin }),
          });
          const data = await res.json();
          if (res.ok && data.verified) {
            set({ pinVerified: true });
            return { verified: true };
          }
          return {
            verified: false,
            error: data.error || 'PIN incorrecto',
            blocked: data.blocked || false,
            remainingMinutes: data.remainingMinutes,
          };
        } catch {
          return { verified: false, error: 'Error de conexión' };
        }
      },

      setPinVerified: (verified: boolean) => set({ pinVerified: verified }),

      updateProfile: async (data) => {
        const { token } = get();
        if (!token) return false;
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data),
          });
          if (res.ok) {
            set((s) => ({ user: s.user ? { ...s.user, ...data } : null }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'sg-auth',
      partialize: (s) => ({ user: s.user, token: s.token, isLoggedIn: s.isLoggedIn, pinVerified: s.pinVerified }),
    }
  )
);

export { API_BASE };
