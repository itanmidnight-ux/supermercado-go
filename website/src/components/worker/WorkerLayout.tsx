'use client';

import React, { useState } from 'react';
import { Package, MapPin, Clock, LogOut, Menu, X, Navigation, CheckCircle } from 'lucide-react';
import { useNavStore, type PageName } from '../../store/navigation-store';
import { useAuthStore } from '../../store/auth-store';

interface WorkerLayoutProps {
  children: React.ReactNode;
  currentPage: string;
}

export function WorkerLayout({ children, currentPage }: WorkerLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigateTo = useNavStore((s) => s.navigateTo);
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigateTo('home');
  };

  const menuItems = [
    { id: 'worker-orders', icon: Package, label: 'Pedidos Disponibles' },
    { id: 'worker-delivery', icon: Navigation, label: 'Mi Entrega' },
    { id: 'worker-history', icon: Clock, label: 'Historial' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0d12] flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 h-14 bg-[#111520]/95 backdrop-blur-xl border-b border-white/5 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#FF8C00] flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-bold">Supermercados Go</p>
            <p className="text-gray-500 text-[10px]">Panel de Delivery</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-white text-xs font-medium">{user?.name}</p>
            <p className="text-[#FF8C00] text-[10px]">Trabajador</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#FF8C00]/20 flex items-center justify-center">
            <span className="text-[#FF8C00] font-bold text-xs">{user?.name?.charAt(0)?.toUpperCase() || 'T'}</span>
          </div>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Cerrar sesión">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile menu */}
      <div className={`fixed top-0 left-0 h-full w-64 bg-[#111520] z-50 transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:hidden`}>
        <div className="p-4 border-b border-white/5">
          <p className="text-white font-bold">Menú Delivery</p>
        </div>
        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { navigateTo(item.id as PageName); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${isActive ? 'bg-[#FF8C00]/15 text-[#FF8C00]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm px-3 py-2 rounded-lg hover:bg-white/5">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Desktop nav */}
      <div className="hidden lg:flex h-12 bg-[#0d1017] border-b border-white/5 items-center px-6 gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id as PageName)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-[#FF8C00]/15 text-[#FF8C00]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main className="flex-1 p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}
