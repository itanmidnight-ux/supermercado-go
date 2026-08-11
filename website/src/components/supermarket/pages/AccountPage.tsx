'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Plus,
  Check,
  ChevronRight,
  ShoppingBag,
  LogIn,
  ShieldCheck,
  Truck,
  Heart,
  Package,
  Home,
  Building2,
  Users,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth-store';
import { useNavStore } from '@/store/navigation-store';
import { mockAddresses, type Address } from '@/store/data-store';
import { OrdersPage } from './OrdersPage';

// ─── Colors ──────────────────────────────────────────────────
const BRAND_GREEN = '#00B860';
const BRAND_ORANGE = '#FF8C00';
const BRAND_GOLD = '#FFD93D';
const BRAND_GREEN_DARK = '#009a50';

// ─── Animation ──────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Tab definitions ────────────────────────────────────────
type TabKey = 'perfil' | 'direcciones' | 'pedidos';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'perfil', label: 'Perfil', icon: <User className="size-4" /> },
  { key: 'direcciones', label: 'Direcciones', icon: <MapPin className="size-4" /> },
  { key: 'pedidos', label: 'Pedidos', icon: <ShoppingBag className="size-4" /> },
];

// ─── Locked State ───────────────────────────────────────────
function LockedState() {
  const navigate = useNavStore((s) => s.navigate);

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 sm:py-24 px-4"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Illustration with lucide icons */}
      <div className="relative mb-8">
        <motion.div
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#f0fdf4' }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShieldCheck className="size-16" style={{ color: BRAND_GREEN }} />
        </motion.div>
        <motion.div
          className="absolute -top-1 -right-1 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        >
          <Lock className="size-5" style={{ color: BRAND_ORANGE }} />
        </motion.div>
        <motion.div
          className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: BRAND_GOLD }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
        >
          <Heart className="size-4" style={{ color: '#92400e' }} />
        </motion.div>
      </div>

      <motion.h2
        className="text-2xl sm:text-3xl font-bold mb-3 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Tu cuenta te espera
      </motion.h2>
      <motion.p
        className="text-muted-foreground mb-8 text-center max-w-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Inicia sesión para ver tu perfil, gestionar tus direcciones y revisar el historial de pedidos en Supermercados Go.
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          className="font-bold text-white gap-2 px-8 cursor-pointer"
          style={{ backgroundColor: BRAND_GREEN }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN)}
          onClick={() => navigate('login')}
        >
          <LogIn className="size-5" />
          Iniciar sesión
        </Button>
        <Button
          variant="outline"
          className="font-semibold gap-2 px-8 cursor-pointer"
          onClick={() => navigate('register')}
        >
          Crear cuenta
        </Button>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        className="flex flex-wrap justify-center gap-3 mt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {[
          { icon: <Truck className="size-3.5" />, text: 'Seguimiento en tiempo real' },
          { icon: <Package className="size-3.5" />, text: 'Historial de pedidos' },
          { icon: <MapPin className="size-3.5" />, text: 'Múltiples direcciones' },
        ].map((feat) => (
          <div
            key={feat.text}
            className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full"
          >
            {feat.icon}
            {feat.text}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────
function ProfileTab() {
  const user = useAuthStore((s) => s.user)!;
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const navigate = useNavStore((s) => s.navigate);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [saved, setSaved] = useState(false);

  // Password state
  const [showPwFields, setShowPwFields] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const initials = useMemo(() => {
    const parts = name.trim().split(' ');
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  }, [name]);

  const handleSave = () => {
    updateProfile({ name, email, phone });
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    setPwMessage(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwMessage({ type: 'error', text: 'Todos los campos son obligatorios.' });
      return;
    }
    if (newPw.length < 4) {
      setPwMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 4 caracteres.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMessage({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    // Simulate password change
    setPwMessage({ type: 'success', text: '¡Contraseña actualizada exitosamente!' });
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setTimeout(() => {
      setShowPwFields(false);
      setPwMessage(null);
    }, 2500);
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
            <Avatar className="size-20 text-lg" style={{ backgroundColor: BRAND_GREEN, color: 'white' }}>
              <AvatarFallback className="text-xl font-bold" style={{ backgroundColor: BRAND_GREEN, color: 'white' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">Miembro de Supermercados Go · Cúcuta</p>
            </div>
            {!isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2 cursor-pointer"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="size-4" />
                  Editar perfil
                </Button>
                {user.role === 'admin' && (
                  <Button
                    className="gap-2 text-white cursor-pointer"
                    style={{ backgroundColor: '#FF8C00' }}
                    onClick={() => navigate('admin-dashboard')}
                  >
                    <ShieldCheck className="size-4" />
                    Panel Admin
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="gap-2 text-white cursor-pointer"
                  style={{ backgroundColor: BRAND_GREEN }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN_DARK)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN)}
                  onClick={handleSave}
                >
                  <Check className="size-4" />
                  Guardar
                </Button>
                <Button variant="ghost" className="cursor-pointer" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          <Separator className="mb-5" />

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <User className="size-3.5 text-muted-foreground" />
                  Nombre completo
                </label>
                {isEditing ? (
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
                ) : (
                  <p className="text-sm bg-muted/50 rounded-lg px-3 py-2.5">{user.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Correo electrónico
                </label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-sm bg-muted/50 rounded-lg px-3 py-2.5">{user.email}</p>
                )}
              </div>
            </div>
            <div className="space-y-2 max-w-sm">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="size-3.5 text-muted-foreground" />
                Teléfono
              </label>
              {isEditing ? (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="text-sm" />
              ) : (
                <p className="text-sm bg-muted/50 rounded-lg px-3 py-2.5">{user.phone}</p>
              )}
            </div>
          </div>

          {saved && (
            <motion.p
              className="text-sm font-medium mt-3 flex items-center gap-1.5"
              style={{ color: BRAND_GREEN }}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Check className="size-4" />
              Cambios guardados correctamente
            </motion.p>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#fef3c7' }}
              >
                <Lock className="size-5" style={{ color: BRAND_ORANGE }} />
              </div>
              <div>
                <h3 className="font-bold">Cambiar contraseña</h3>
                <p className="text-xs text-muted-foreground">Mantén tu cuenta segura</p>
              </div>
            </div>
            {!showPwFields && (
              <Button
                variant="outline"
                className="gap-2 cursor-pointer"
                onClick={() => setShowPwFields(true)}
              >
                Cambiar
              </Button>
            )}
          </div>

          <AnimatePresence>
            {showPwFields && (
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Separator />
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Contraseña actual</label>
                    <div className="relative">
                      <Input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="Ingresa tu contraseña actual"
                        className="text-sm pr-10"
                      />
                      <button
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        type="button"
                      >
                        {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Nueva contraseña</label>
                    <div className="relative">
                      <Input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Mínimo 4 caracteres"
                        className="text-sm pr-10"
                      />
                      <button
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        type="button"
                      >
                        {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Confirmar nueva contraseña</label>
                    <div className="relative">
                      <Input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                        className="text-sm pr-10"
                      />
                      <button
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        type="button"
                      >
                        {showConfirmPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {pwMessage && (
                    <motion.p
                      className={`text-sm font-medium flex items-center gap-1.5 ${
                        pwMessage.type === 'error' ? 'text-red-500' : ''
                      }`}
                      style={pwMessage.type === 'success' ? { color: BRAND_GREEN } : undefined}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {pwMessage.type === 'success' ? <Check className="size-4" /> : null}
                      {pwMessage.text}
                    </motion.p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      className="gap-2 text-white cursor-pointer"
                      style={{ backgroundColor: BRAND_GREEN }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN_DARK)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN)}
                      onClick={handleChangePassword}
                    >
                      <Lock className="size-4" />
                      Actualizar contraseña
                    </Button>
                    <Button
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={() => {
                        setShowPwFields(false);
                        setPwMessage(null);
                        setCurrentPw('');
                        setNewPw('');
                        setConfirmPw('');
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Addresses Tab ───────────────────────────────────────────
function AddressesTab() {
  const [addresses, setAddresses] = useState<Address[]>(mockAddresses);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New address form
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('');

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({ ...a, is_default: a.id === id }))
    );
  };

  const handleDelete = (id: string) => {
    setAddresses((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      const hasDefault = filtered.some((a) => a.is_default);
      if (!hasDefault && filtered.length > 0) {
        filtered[0] = { ...filtered[0], is_default: true };
      }
      return filtered;
    });
  };

  const handleAddAddress = () => {
    if (!newLabel.trim() || !newAddress.trim()) return;
    const newAddr: Address = {
      id: `addr${Date.now()}`,
      label: newLabel.trim(),
      address: newAddress.trim(),
      detail: newDetail.trim(),
      neighborhood: newNeighborhood.trim(),
      city: 'Cúcuta',
      is_default: addresses.length === 0,
    };
    setAddresses((prev) => [...prev, newAddr]);
    setNewLabel('');
    setNewAddress('');
    setNewDetail('');
    setNewNeighborhood('');
    setDialogOpen(false);
  };

  const getIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('casa') || lower.includes('hogar')) return <Home className="size-5" />;
    if (lower.includes('oficina') || lower.includes('trabajo')) return <Building2 className="size-5" />;
    if (lower.includes('familia') || lower.includes('padre') || lower.includes('madre')) return <Users className="size-5" />;
    return <MapPin className="size-5" />;
  };

  return (
    <motion.div
      className="space-y-5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mis direcciones</h2>
          <p className="text-sm text-muted-foreground">Gestiona tus direcciones de entrega</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 text-white cursor-pointer"
              style={{ backgroundColor: BRAND_GREEN }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN)}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Agregar dirección</span>
              <span className="sm:hidden">Agregar</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="size-5" style={{ color: BRAND_GREEN }} />
                Nueva dirección
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Etiqueta *</label>
                <Input
                  placeholder="Ej: Casa, Oficina, Familia"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dirección *</label>
                <Input
                  placeholder="Ej: Calle 5 #12-34"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Detalle (apto, torre, etc.)</label>
                <Input
                  placeholder="Ej: Apto 302, Torre B"
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Barrio</label>
                <Input
                  placeholder="Ej: La Playa"
                  value={newNeighborhood}
                  onChange={(e) => setNewNeighborhood(e.target.value)}
                />
              </div>
              <Button
                className="w-full text-white font-semibold gap-2 cursor-pointer"
                style={{ backgroundColor: BRAND_GREEN }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = BRAND_GREEN)}
                onClick={handleAddAddress}
                disabled={!newLabel.trim() || !newAddress.trim()}
              >
                <Plus className="size-4" />
                Guardar dirección
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <MapPin className="size-10" style={{ color: BRAND_GREEN }} />
          </div>
          <h3 className="font-bold mb-1">Sin direcciones</h3>
          <p className="text-sm text-muted-foreground mb-4">Agrega tu primera dirección de entrega</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr, idx) => (
            <motion.div
              key={addr.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.3 }}
            >
              <Card className={addr.is_default ? 'border-2' : ''} style={addr.is_default ? { borderColor: BRAND_GREEN } : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: addr.is_default ? '#f0fdf4' : '#f4f4f5',
                        color: addr.is_default ? BRAND_GREEN : '#71717a',
                      }}
                    >
                      {getIcon(addr.label)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-sm">{addr.label}</h3>
                        {addr.is_default && (
                          <Badge
                            className="text-[10px] font-bold px-1.5 py-0 text-white"
                            style={{ backgroundColor: BRAND_GREEN }}
                          >
                            Principal
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{addr.address}</p>
                      {addr.detail && <p className="text-xs text-muted-foreground mt-0.5">{addr.detail}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {addr.neighborhood && `${addr.neighborhood}, `}{addr.city}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {!addr.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 h-7 px-2 cursor-pointer"
                          style={{ color: BRAND_GREEN }}
                          onClick={() => handleSetDefault(addr.id)}
                        >
                          <Check className="size-3" />
                          Principal
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1 h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        onClick={() => handleDelete(addr.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export function AccountPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [activeTab, setActiveTab] = useState<TabKey>('perfil');

  if (!isLoggedIn) {
    return (
      <motion.div
        className="min-h-screen bg-background"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          <motion.h1 {...fadeUp} className="text-2xl sm:text-3xl font-bold mb-2">Mi Cuenta</motion.h1>
          <motion.p {...fadeUp} className="text-muted-foreground mb-8">
            Gestiona tu perfil y pedidos en Supermercados Go
          </motion.p>
          <LockedState />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <motion.div className="mb-6" {...fadeUp}>
          <h1 className="text-2xl sm:text-3xl font-bold">Mi Cuenta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tu perfil, direcciones y pedidos
          </p>
        </motion.div>

        {/* Manual Tab Navigation */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <div
            className="flex gap-1.5 p-1.5 rounded-2xl"
            style={{ backgroundColor: '#f4f4f5' }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={
                    'relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer'
                  }
                  style={
                    isActive
                      ? {
                          backgroundColor: 'white',
                          color: BRAND_GREEN,
                          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.08)',
                        }
                      : { color: '#71717a' }
                  }
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="accountTabIndicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full"
                      style={{ backgroundColor: BRAND_GREEN }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'perfil' && <ProfileTab key="perfil" />}
          {activeTab === 'direcciones' && <AddressesTab key="direcciones" />}
          {activeTab === 'pedidos' && <OrdersPage key="pedidos" />}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
