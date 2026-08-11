'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Settings,
  ChevronLeft, ChevronRight, LogOut, Store, Menu, X, TrendingUp, FileText
} from 'lucide-react';
import { useNavStore, type PageName } from '../../store/navigation-store';
import { useAuthStore } from '../../store/auth-store';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
}

const menuItems = [
  { id: 'admin-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'admin-products', icon: Package, label: 'Productos' },
  { id: 'admin-categories', icon: FolderTree, label: 'Categorías' },
  { id: 'admin-orders', icon: ShoppingCart, label: 'Pedidos' },
  { id: 'admin-workers', icon: Users, label: 'Trabajadores' },
  { id: 'admin-clients', icon: Users, label: 'Clientes' },
  { id: 'admin-analytics', icon: TrendingUp, label: 'Analíticas' },
  { id: 'admin-records', icon: FileText, label: 'Registros' },
  { id: 'admin-settings', icon: Settings, label: 'Configuración' },
];

export function AdminLayout({ children, currentPage }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigateTo = useNavStore((s) => s.navigateTo);
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigateTo('home');
  };

  return (
    <div className="flex min-h-screen bg-[#0a0d12]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-all duration-300 ease-in-out
        bg-[#111520] border-r border-white/5
        flex flex-col
      `}>
        {/* Logo */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} border-b border-white/5`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#00B860] flex items-center justify-center flex-shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="text-white font-bold text-sm truncate">SupermercadosGo</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  navigateTo(item.id as PageName);
                  setMobileOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 rounded-lg transition-all duration-200
                  ${collapsed ? 'justify-center p-3' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-[#00B860]/15 text-[#00B860] shadow-[0_0_12px_rgba(0,184,96,0.1)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[#00B860]' : ''}`} />
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
                {!collapsed && isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00B860] animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className={`p-3 border-t border-white/5 ${collapsed ? 'items-center' : ''}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-3`}>
            <div className="w-8 h-8 rounded-full bg-[#00B860]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#00B860] font-bold text-xs">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-gray-500 text-[10px] truncate">{user?.email || 'admin@supermercado.go'}</p>
              </div>
            )}
          </div>

          <div className="flex gap-1">
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 text-gray-400 hover:text-red-400 rounded-lg transition-colors text-xs ${collapsed ? 'justify-center p-2 w-full' : 'px-3 py-2'}`}
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Cerrar sesión</span>}
            </button>
            <button
              onClick={() => navigateTo('home')}
              className={`flex items-center gap-2 text-gray-400 hover:text-[#00B860] rounded-lg transition-colors text-xs ${collapsed ? 'justify-center p-2 w-full' : 'px-3 py-2'}`}
              title="Ver tienda"
            >
              <Store className="w-4 h-4" />
              {!collapsed && <span>Ver tienda</span>}
            </button>
          </div>
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#1a1f2e] border border-white/10 items-center justify-center text-gray-400 hover:text-white hover:bg-[#00B860]/20 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-[#0a0d12]/80 backdrop-blur-xl border-b border-white/5 flex items-center px-4 lg:px-6 gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider">Panel Admin</p>
              <p className="text-white text-xs font-medium">{menuItems.find(m => m.id === currentPage)?.label}</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#00B860]/10 flex items-center justify-center">
              <span className="text-[#00B860] text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
