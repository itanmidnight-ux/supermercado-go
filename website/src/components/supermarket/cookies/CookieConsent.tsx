'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Shield, BarChart3, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COOKIE_KEY = 'sg-cookie-consent';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

function getConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConsent(prefs: CookiePreferences) {
  localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    marketing: false,
  });

  useEffect(() => {
    const existing = getConsent();
    if (!existing) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    const all = { necessary: true, analytics: true, marketing: true };
    saveConsent(all);
    setPrefs(all);
    setVisible(false);
  };

  const acceptSelected = () => {
    saveConsent(prefs);
    setVisible(false);
  };

  const rejectOptional = () => {
    const minimal = { necessary: true, analytics: false, marketing: false };
    saveConsent(minimal);
    setPrefs(minimal);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed bottom-0 inset-x-0 z-[100] p-4 sm:p-6"
        >
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF3E0] flex items-center justify-center shrink-0">
                  <Cookie className="w-5 h-5 text-[#FF8C00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base">Usamos cookies</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    Utilizamos cookies para mejorar tu experiencia, analizar el tráfico y personalizar el contenido. Puedes elegir qué cookies aceptar.
                  </p>
                </div>
                <button
                  onClick={rejectOptional}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Detailed options */}
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 space-y-3"
                >
                  {/* Necessary */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-[#00B860]" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Necesarias</p>
                        <p className="text-xs text-gray-500">Sesión, carrito, autenticación</p>
                      </div>
                    </div>
                    <div className="w-10 h-5 bg-[#00B860] rounded-full relative cursor-not-allowed">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  </div>

                  {/* Analytics */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <BarChart3 className="w-4 h-4 text-[#00B860]" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Analíticas</p>
                        <p className="text-xs text-gray-500">Estadísticas de uso anónimas</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPrefs((p) => ({ ...p, analytics: !p.analytics }))}
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${prefs.analytics ? 'bg-[#00B860]' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs.analytics ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* Marketing */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Target className="w-4 h-4 text-[#FF8C00]" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Marketing</p>
                        <p className="text-xs text-gray-500">Publicidad personalizada</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPrefs((p) => ({ ...p, marketing: !p.marketing }))}
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${prefs.marketing ? 'bg-[#00B860]' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${prefs.marketing ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-5 sm:px-6 pb-5 flex flex-wrap gap-2">
              {!showDetails && (
                <button
                  onClick={() => setShowDetails(true)}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 underline cursor-pointer"
                >
                  Personalizar
                </button>
              )}
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={rejectOptional}
                className="text-xs font-medium cursor-pointer"
              >
                Rechazar opcionales
              </Button>
              {showDetails && (
                <Button
                  size="sm"
                  onClick={acceptSelected}
                  className="text-xs font-medium bg-[#00B860] hover:bg-[#00a050] text-white cursor-pointer"
                >
                  Guardar preferencias
                </Button>
              )}
              <Button
                size="sm"
                onClick={acceptAll}
                className="text-xs font-medium bg-[#FF8C00] hover:bg-[#e07800] text-white cursor-pointer"
              >
                Aceptar todas
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { getConsent };
