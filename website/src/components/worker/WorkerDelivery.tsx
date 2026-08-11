'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Navigation, MapPin, Phone, Package, CheckCircle, XCircle,
  Clock, AlertTriangle, MessageCircle, Copy, Share2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkerStore } from '../../store/worker-store';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export function WorkerDelivery() {
  const {
    myActiveOrder, deliveryCode, isTracking,
    startDelivery, completeDelivery, cancelDelivery, updateLocation
  } = useWorkerStore();
  const token = useAuthStore((s) => s.token)!;
  const [verificationInput, setVerificationInput] = useState('');
  const [action, setAction] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const watchId = useRef<number | null>(null);

  // Start location tracking
  useEffect(() => {
    if (!isTracking || !myActiveOrder) return;

    if ('geolocation' in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          updateLocation(token, String(myActiveOrder.id), latitude, longitude);
          setLocationError(null);
        },
        (err) => {
          setLocationError('No se pudo obtener tu ubicación. Activa el GPS.');
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [isTracking, myActiveOrder?.id]);

  const handleStartDelivery = async () => {
    if (!myActiveOrder) return;
    setAction('starting');
    await startDelivery(token, String(myActiveOrder.id));
    setAction(null);
  };

  const handleComplete = async () => {
    if (!myActiveOrder) return;
    if (!verificationInput.trim()) {
      alert('Ingresa el código de verificación');
      return;
    }
    setAction('completing');
    const success = await completeDelivery(token, String(myActiveOrder.id), verificationInput.trim());
    if (success) {
      alert('¡Entrega completada exitosamente!');
      setVerificationInput('');
    } else {
      alert('Código incorrecto. Intenta de nuevo.');
    }
    setAction(null);
  };

  const handleCancel = async () => {
    if (!myActiveOrder) return;
    if (!confirm('¿Cancelar esta entrega? El pedido volverá a estar disponible.')) return;
    await cancelDelivery(token, String(myActiveOrder.id));
  };

  const copyCode = () => {
    if (deliveryCode) {
      navigator.clipboard.writeText(deliveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const callCustomer = () => {
    if (myActiveOrder?.customer_phone || myActiveOrder?.phone) {
      window.open(`tel:${myActiveOrder.customer_phone || myActiveOrder.phone}`);
    }
  };

  const openMaps = () => {
    if (myActiveOrder?.delivery_lat && myActiveOrder?.delivery_lng) {
      window.open(`https://www.google.com/maps?q=${myActiveOrder.delivery_lat},${myActiveOrder.delivery_lng}`, '_blank');
    } else if (myActiveOrder?.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(myActiveOrder.address)}`, '_blank');
    }
  };

  if (!myActiveOrder) {
    return (
      <div className="text-center py-16">
        <Navigation className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg font-medium">Sin entrega activa</p>
        <p className="text-gray-500 text-sm mt-1">Ve a "Pedidos Disponibles" para tomar uno</p>
      </div>
    );
  }

  const isDelivering = myActiveOrder.status === 'delivering';
  const customerPhone = myActiveOrder.customer_phone || myActiveOrder.phone || '';
  const customerAddress = myActiveOrder.address || myActiveOrder.delivery_address || '';

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white">Mi Entrega</h1>
        <p className="text-gray-400 text-sm mt-1">Gestiona tu entrega actual</p>
      </div>

      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-5 ${
          isDelivering
            ? 'bg-[#00B860]/10 border-[#00B860]/30'
            : 'bg-[#FF8C00]/10 border-[#FF8C00]/30'
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDelivering ? 'bg-[#00B860]/20' : 'bg-[#FF8C00]/20'}`}>
            {isDelivering ? <Navigation className="w-5 h-5 text-[#00B860]" /> : <Clock className="w-5 h-5 text-[#FF8C00]" />}
          </div>
          <div>
            <p className={`font-bold text-sm ${isDelivering ? 'text-[#00B860]' : 'text-[#FF8C00]'}`}>
              {isDelivering ? 'En camino' : 'Pedido reclamado'}
            </p>
            <p className="text-gray-400 text-xs">Pedido #{String(myActiveOrder.id).slice(-6)}</p>
          </div>
        </div>

        {isDelivering && (
          <div className="mb-4 p-3 bg-black/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[#00B860]" />
              <span className="text-[#00B860] text-xs font-medium">Ubicación activa</span>
            </div>
            {currentLocation && (
              <p className="text-gray-300 text-[10px]">Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}</p>
            )}
            {locationError && <p className="text-yellow-400 text-[10px]">{locationError}</p>}
          </div>
        )}

        {/* Customer info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <Package className="w-4 h-4 text-gray-500" />
            {myActiveOrder.items?.length || 0} productos — {formatCOP(myActiveOrder.total)}
          </div>
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <MapPin className="w-4 h-4 text-gray-500" />
            {customerAddress}
          </div>
          <div className="flex items-center gap-2 text-gray-300 text-sm">
            <Phone className="w-4 h-4 text-gray-500" />
            {customerPhone}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isDelivering ? (
            <>
              <button
                onClick={handleStartDelivery}
                disabled={action === 'starting'}
                className="flex-1 py-2.5 bg-[#00B860] hover:bg-[#00d97a] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {action === 'starting' ? 'Iniciando...' : 'Iniciar Entrega'}
              </button>
              <button
                onClick={handleCancel}
                className="py-2.5 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-400 rounded-xl text-sm transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={callCustomer}
                className="py-2.5 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Llamar
              </button>
              <button
                onClick={openMaps}
                className="py-2.5 px-4 bg-[#00B860]/20 hover:bg-[#00B860]/30 text-[#00B860] rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Navegar
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Verification code section */}
      {isDelivering && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111520] rounded-xl border border-white/5 p-5"
        >
          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#FFD93D]" />
            Código de Verificación
          </h3>

          {deliveryCode && (
            <div className="mb-4">
              <p className="text-gray-400 text-xs mb-2">Comparte este código con el cliente:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#FFD93D]/10 border border-[#FFD93D]/30 rounded-xl px-4 py-3 text-center">
                  <span className="text-[#FFD93D] font-mono text-2xl font-bold tracking-widest">{deliveryCode}</span>
                </div>
                <button
                  onClick={copyCode}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                  {copied ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
            </div>
          )}

          <div className="mb-3">
            <p className="text-gray-400 text-xs mb-2">Ingresa el código que te dio el cliente:</p>
            <input
              type="text"
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value.toUpperCase())}
              placeholder="Código de verificación"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-[#00B860]/50"
            />
          </div>

          <button
            onClick={handleComplete}
            disabled={action === 'completing' || !verificationInput.trim()}
            className="w-full py-3 bg-[#00B860] hover:bg-[#00d97a] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {action === 'completing' ? 'Verificando...' : 'Confirmar Entrega'}
          </button>

          <p className="text-gray-500 text-[10px] text-center mt-3">
            El código debe coincidir con el que el cliente tiene en su app
          </p>
        </motion.div>
      )}

      {/* Items list */}
      <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
        <h3 className="text-white font-bold text-sm mb-3">Productos del pedido</h3>
        <div className="space-y-2">
          {myActiveOrder.items?.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300 text-sm">{item.name || item.product_name}</span>
                <span className="text-gray-500 text-xs">x{item.quantity}</span>
              </div>
              <span className="text-[#00B860] text-xs font-medium">{formatCOP(item.subtotal || item.price * item.quantity || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
