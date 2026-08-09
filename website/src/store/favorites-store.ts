import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
  ids: string[];
  toggle: (id: string) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (id) => {
        const { ids } = get();
        if (ids.includes(id)) {
          set({ ids: ids.filter((fid) => fid !== id) });
        } else {
          set({ ids: [...ids, id] });
        }
      },

      add: (id) => {
        const { ids } = get();
        if (!ids.includes(id)) set({ ids: [...ids, id] });
      },

      remove: (id) => {
        set({ ids: get().ids.filter((fid) => fid !== id) });
      },

      has: (id) => get().ids.includes(id),

      clear: () => set({ ids: [] }),
    }),
    {
      name: 'sg-favorites',
      partialize: (state) => ({ ids: state.ids }),
    }
  )
);
