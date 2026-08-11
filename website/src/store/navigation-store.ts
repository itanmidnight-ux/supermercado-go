import { create } from 'zustand';

export type PageName =
  | 'home'
  | 'catalog'
  | 'product-detail'
  | 'cart'
  | 'checkout'
  | 'login'
  | 'register'
  | 'account'
  | 'orders'
  | 'order-detail'
  | 'favorites'
  | 'contact'
  | 'about'
  | 'faq'
  | 'terms'
  | 'privacy'
  | 'admin-dashboard'
  | 'admin-products'
  | 'admin-categories'
  | 'admin-orders'
  | 'admin-users'
  | 'admin-settings'
  | 'admin-workers'
  | 'admin-clients'
  | 'admin-analytics'
  | 'admin-records'
  | 'worker-orders'
  | 'worker-delivery'
  | 'worker-history';

interface NavState {
  currentPage: PageName;
  previousPage: PageName | null;
  productDetailId: string | null;
  orderDetailId: string | null;
  navigate: (page: PageName) => void;
  navigateTo: (page: PageName) => void;
  goBack: () => void;
  openProduct: (id: string) => void;
  openOrder: (id: string) => void;
}

export const useNavStore = create<NavState>((set, get) => ({
  currentPage: 'home',
  previousPage: null,
  productDetailId: null,
  orderDetailId: null,
  navigate: (page) => set({ currentPage: page, previousPage: get().currentPage }),
  navigateTo: (page) => set({ currentPage: page, previousPage: get().currentPage }),
  goBack: () => {
    const prev = get().previousPage;
    if (prev) set({ currentPage: prev, previousPage: 'home' });
    else set({ currentPage: 'home' });
  },
  openProduct: (id) => set({ currentPage: 'product-detail', productDetailId: id, previousPage: get().currentPage }),
  openOrder: (id) => set({ currentPage: 'order-detail', orderDetailId: id, previousPage: get().currentPage }),
}));
