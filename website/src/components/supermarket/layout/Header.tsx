'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, User, Menu, Heart, Package, ChevronDown, MapPin, Phone, LogOut, Home as HomeIcon, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useCartStore } from '@/store/cart-store';
import { useNavStore, type PageName } from '@/store/navigation-store';
import { useAuthStore } from '@/store/auth-store';
import { useDataStore } from '@/store/data-store';

const navLinks: { label: string; page: PageName; auth?: boolean }[] = [
  { label: 'Inicio', page: 'home' },
  { label: 'Productos', page: 'catalog' },
  { label: 'Ofertas', page: 'catalog' },
  { label: 'Contacto', page: 'contact' },
  { label: 'Nosotros', page: 'about' },
];

const accountLinks: { label: string; page: PageName; icon: React.ElementType }[] = [
  { label: 'Mi Perfil', page: 'account', icon: User },
  { label: 'Mis Pedidos', page: 'orders', icon: Package },
  { label: 'Favoritos', page: 'favorites', icon: Heart },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const { navigate } = useNavStore();
  const { totalItems, totalPrice } = useCartStore();
  const { user, isLoggedIn, logout } = useAuthStore();
  const categories = useDataStore((s) => s.categories);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      {/* Top bar */}
      <div className="bg-[#1a7a3a] text-white text-xs py-1.5 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +57 304 401 6277</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Cúcuta, Norte de Santander</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('faq')} className="hover:text-[#FFD93D] transition-colors">Preguntas frecuentes</button>
            <span className="opacity-30">|</span>
            <button onClick={() => navigate('contact')} className="hover:text-[#FFD93D] transition-colors">Contáctanos</button>
          </div>
        </div>
      </div>

      {/* Main header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-white shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <button onClick={() => navigate('home')} className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00B860] to-[#008040] flex items-center justify-center">
                <span className="text-white font-black text-sm">SG</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-extrabold leading-tight text-[#1a1a1a]">
                  Supermercados<span className="text-[#00B860]"> Go</span>
                </h1>
                <p className="text-[10px] text-gray-400 -mt-0.5 leading-tight">Tu supermercado, donde vayas</p>
              </div>
            </button>

            {/* Right actions */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Mobile menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <div className="p-4 border-b bg-gradient-to-r from-[#00B860] to-[#008040]">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <span className="text-white font-black">SG</span>
                      </div>
                      <span className="text-white font-bold text-lg">Supermercados Go</span>
                    </div>
                    {isLoggedIn && user && (
                      <p className="text-white/80 text-sm mt-2">Hola, {user.name.split(' ')[0]} 👋</p>
                    )}
                  </div>
                  <nav className="p-4 space-y-1">
                    {navLinks.map((link) => (
                      <button key={link.page + link.label} onClick={() => { navigate(link.page); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm">
                        {link.label}
                      </button>
                    ))}
                    <div className="border-t my-3" />
                    {isLoggedIn ? (
                      <>
                        {accountLinks.map((link) => (
                          <button key={link.page} onClick={() => { navigate(link.page); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm flex items-center gap-3">
                          <link.icon className="w-4 h-4 text-[#00B860]" />{link.label}
                          </button>
                          ))}
                          {user?.role === 'admin' && (
                            <button onClick={() => { window.open('/admin/', '_blank'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#00B860]/5 transition-colors font-medium text-sm flex items-center gap-3 text-[#00B860]">
                              <LayoutDashboard className="w-4 h-4" />Panel Admin
                            </button>
                          )}
                          {user?.role === 'worker' && (
                            <button onClick={() => { window.open('/worker/', '_blank'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#00B860]/5 transition-colors font-medium text-sm flex items-center gap-3 text-[#00B860]">
                              <LayoutDashboard className="w-4 h-4" />Panel Repartidor
                            </button>
                          )}
                          <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-colors font-medium text-sm flex items-center gap-3">
                            <LogOut className="w-4 h-4" />Cerrar sesión
                          </button>
                        </>
                      ) : (
                      <button onClick={() => { navigate('login'); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-xl bg-[#00B860]/5 text-[#00B860] font-semibold text-sm">
                        Iniciar sesión / Registrarse
                      </button>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>

              {/* Favorites (desktop, logged in) */}
              {isLoggedIn && (
                <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => navigate('favorites')}>
                  <Heart className="w-5 h-5" />
                </Button>
              )}

              {/* Panel button (admin & worker) */}
              {isLoggedIn && (user?.role === 'admin' || user?.role === 'worker') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden md:flex gap-1.5 border-[#00B860]/30 text-[#00B860] hover:bg-[#00B860]/5"
                  onClick={() => window.open(user?.role === 'admin' ? '/admin/' : '/worker/', '_blank')}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="text-xs font-medium">{user?.role === 'admin' ? 'Admin' : 'Repartidor'}</span>
                </Button>
              )}

              {/* Account dropdown (desktop) */}
              <div className="relative hidden md:block" ref={accountRef}>
                <Button variant="ghost" className="gap-1.5" onClick={() => setAccountOpen(!accountOpen)}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00B860] to-[#008040] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{isLoggedIn && user ? user.name.charAt(0) : '?'}</span>
                  </div>
                  <span className="hidden lg:inline text-sm max-w-[100px] truncate">{isLoggedIn && user ? user.name.split(' ')[0] : 'Mi cuenta'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                </Button>
                <AnimatePresence>
                  {accountOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 overflow-hidden">
                      {isLoggedIn ? (
                        <>
                          <div className="px-4 py-3 border-b bg-gray-50">
                            <p className="font-semibold text-sm">{user?.name}</p>
                            <p className="text-xs text-gray-500">{user?.email}</p>
                          </div>
                          {accountLinks.map((link) => (
                            <button key={link.page} onClick={() => { navigate(link.page); setAccountOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm flex items-center gap-3">
                              <link.icon className="w-4 h-4 text-[#00B860]" />{link.label}
                            </button>
                          ))}
                          <div className="border-t my-1" />
                          <button onClick={() => { logout(); setAccountOpen(false); }} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-500 text-sm flex items-center gap-3">
                            <LogOut className="w-4 h-4" />Cerrar sesión
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { navigate('login'); setAccountOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-sm font-medium">Iniciar sesión</button>
                          <button onClick={() => { navigate('register'); setAccountOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-sm font-medium">Crear cuenta</button>
                          <div className="border-t my-1" />
                          <p className="px-4 py-2 text-xs text-gray-400">Inicia sesión para ver tus pedidos y favoritos</p>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Cart button */}
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('cart')}>
                <ShoppingCart className="w-5 h-5" />
                {totalItems() > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#FF8C00] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalItems()}
                  </motion.span>
                )}
              </Button>
            </div>
          </div>

        </div>
      </header>

    </>
  );
}
