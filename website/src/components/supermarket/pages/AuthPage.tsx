'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  ShoppingCart,
  Truck,
  ShieldCheck,
  Star,
  ArrowRight,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/auth-store';
import { useNavStore } from '@/store/navigation-store';

// ─── Animation ──────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

const formSlideVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 80 : -80,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -80 : 80,
  }),
};

// ─── Password Strength ─────────────────────────────────────
function getPasswordStrength(pw: string): { level: number; color: string; label: string } {
  if (pw.length === 0) return { level: 0, color: '#e5e7eb', label: '' };
  if (pw.length < 4) return { level: 1, color: '#ef4444', label: 'Débil' };
  if (pw.length < 7) return { level: 2, color: '#f59e0b', label: 'Media' };
  return { level: 3, color: '#00B860', label: 'Fuerte' };
}

// ─── Trust Badges ───────────────────────────────────────────
const trustBadges = [
  { icon: Truck, label: 'Entrega en 30-60 min' },
  { icon: ShieldCheck, label: 'Pago 100% seguro' },
  { icon: Star, label: '+10,000 clientes felices' },
  { icon: ShoppingCart, label: '+2,000 productos' },
];

// ─── PIN Input Component ────────────────────────────────────
function PinInput({ onComplete, disabled }: { onComplete: (pin: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (newDigits.every(d => d !== '')) {
      onComplete(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const newDigits = pasted.split('');
      setDigits(newDigits);
      onComplete(pasted);
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-200 focus:border-[#00B860] focus:ring-2 focus:ring-[#00B860]/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────
export function AuthPage() {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const verifyPin = useAuthStore((s) => s.verifyPin);
  const { user, isLoggedIn, pinVerified } = useAuthStore();
  const navigate = useNavStore((s) => s.navigate);
  const currentPage = useNavStore((s) => s.currentPage);
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(currentPage !== 'register');
  const [direction, setDirection] = useState(1);

  // Sync with navigation page
  useEffect(() => {
    if (currentPage === 'register' && isLogin) {
      setIsLogin(false);
      setDirection(1);
    } else if (currentPage === 'login' && !isLogin) {
      setIsLogin(true);
      setDirection(-1);
    }
  }, [currentPage]);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // PIN verification state
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinBlocked, setPinBlocked] = useState(false);
  const [pinBlockedMinutes, setPinBlockedMinutes] = useState(0);
  const [pinLoading, setPinLoading] = useState(false);

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPw, setRegConfirmPw] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Password strength
  const pwStrength = useMemo(() => getPasswordStrength(regPassword), [regPassword]);

  // Check if user needs PIN verification
  useEffect(() => {
    if (!isLoggedIn) {
      setShowPinScreen(false);
      return;
    }

    if (user && ['admin', 'worker'].includes(user.role || '') && !pinVerified) {
      setShowPinScreen(true);
    } else if (user && pinVerified && showPinScreen) {
      // PIN verified: stay on home page (admin/worker access panels via header button)
      setShowPinScreen(false);
      navigate('home');
    } else if (user && !['admin', 'worker'].includes(user.role || '')) {
      // Client: redirect to home
      navigate('home');
    }
  }, [isLoggedIn, user, pinVerified, showPinScreen, navigate]);

  // Toggle view
  const toggleView = useCallback((toLogin: boolean) => {
    setDirection(toLogin ? 1 : -1);
    setIsLogin(toLogin);
    navigate(toLogin ? 'login' : 'register');
  }, [navigate]);

  // Handle login
  const handleLogin = useCallback(() => {
    if (!loginEmail || !loginPassword) {
      toast({ title: 'Datos incompletos', description: 'Ingresa tu correo y contraseña.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setTimeout(async () => {
      const success = await login(loginEmail, loginPassword);
      setIsLoading(false);
      if (success) {
        toast({ title: '¡Bienvenido de vuelta!', description: 'Has iniciado sesión correctamente.' });
        // PIN screen will be shown by useEffect
      } else {
        toast({ title: 'Error', description: 'Credenciales inválidas. Intenta de nuevo.', variant: 'destructive' });
      }
    }, 600);
  }, [loginEmail, loginPassword, login, toast]);

  // Handle PIN verification
  const handlePinComplete = useCallback(async (pin: string) => {
    setPinLoading(true);
    setPinError('');

    const result = await verifyPin(pin);
    setPinLoading(false);

    if (result.verified) {
      toast({ title: '¡Verificado!', description: 'Código PIN correcto.' });
      // Navigation will be triggered by useEffect
    } else if (result.blocked) {
      setPinBlocked(true);
      setPinBlockedMinutes(result.remainingMinutes || 15);
      setPinError(result.error || 'Cuenta bloqueada');
    } else {
      setPinAttempts(prev => prev + 1);
      setPinError(result.error || 'PIN incorrecto');
    }
  }, [verifyPin, toast]);

  // Handle register
  const handleRegister = useCallback(() => {
    if (!regName || !regEmail || !regPhone || !regPassword || !regConfirmPw) {
      toast({ title: 'Datos incompletos', description: 'Completa todos los campos del formulario.', variant: 'destructive' });
      return;
    }
    if (regPassword !== regConfirmPw) {
      toast({ title: 'Contraseñas no coinciden', description: 'Las contraseñas deben ser iguales.', variant: 'destructive' });
      return;
    }
    if (regPassword.length < 4) {
      toast({ title: 'Contraseña muy corta', description: 'La contraseña debe tener al menos 4 caracteres.', variant: 'destructive' });
      return;
    }
    if (!acceptTerms) {
      toast({ title: 'Términos requeridos', description: 'Debes aceptar los términos y condiciones.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const success = register(regName, regEmail, regPhone, regPassword);
      setIsLoading(false);
      if (success) {
        toast({ title: '¡Cuenta creada!', description: `Bienvenido/a, ${regName}! Tu cuenta ha sido creada exitosamente.` });
        navigate('home');
      } else {
        toast({ title: 'Error', description: 'No se pudo crear la cuenta. Intenta de nuevo.', variant: 'destructive' });
      }
    }, 600);
  }, [regName, regEmail, regPhone, regPassword, regConfirmPw, acceptTerms, register, navigate, toast]);

  // Social login (visual only)
  const handleSocialLogin = useCallback((provider: string) => {
    toast({ title: `${provider} (Próximamente)`, description: `El inicio de sesión con ${provider} estará disponible pronto.` });
  }, [toast]);

  // Forgot password
  const [forgotScreen, setForgotScreen] = useState<'idle' | 'email' | 'code' | 'newpw' | 'done'>('idle');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPw, setForgotNewPw] = useState('');
  const [forgotConfirmPw, setForgotConfirmPw] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDevCode, setForgotDevCode] = useState('');

  const handleForgotPassword = useCallback(() => {
    setForgotScreen('email');
    setForgotEmail(loginEmail || '');
  }, [loginEmail]);

  const handleForgotSendCode = useCallback(async () => {
    if (!forgotEmail) {
      toast({ title: 'Correo requerido', description: 'Ingresa tu correo electrónico.', variant: 'destructive' });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (data._devCode) setForgotDevCode(data._devCode);
      setForgotScreen('code');
      toast({ title: 'Código enviado', description: 'Revisa tu correo electrónico para el código de recuperación.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo procesar la solicitud.', variant: 'destructive' });
    }
    setForgotLoading(false);
  }, [forgotEmail, toast]);

  const handleForgotVerifyCode = useCallback(async () => {
    if (!forgotCode || forgotCode.length !== 6) {
      toast({ title: 'Código inválido', description: 'El código debe ser de 6 dígitos.', variant: 'destructive' });
      return;
    }
    setForgotScreen('newpw');
  }, [forgotCode, toast]);

  const handleForgotResetPw = useCallback(async () => {
    if (!forgotNewPw || forgotNewPw.length < 6) {
      toast({ title: 'Contraseña muy corta', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (forgotNewPw !== forgotConfirmPw) {
      toast({ title: 'No coinciden', description: 'Las contraseñas deben ser iguales.', variant: 'destructive' });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, code: forgotCode, new_password: forgotNewPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotScreen('done');
        toast({ title: '¡Contraseña actualizada!', description: 'Ya puedes iniciar sesión con tu nueva contraseña.' });
      } else {
        toast({ title: 'Error', description: data.error || 'Código inválido o expirado.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo restablecer la contraseña.', variant: 'destructive' });
    }
    setForgotLoading(false);
  }, [forgotEmail, forgotCode, forgotNewPw, forgotConfirmPw, toast]);

  // ─── Forgot Password Screens ──────────────────────────────
  if (forgotScreen !== 'idle') {
    return (
      <motion.div
        className="min-h-screen bg-background flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-md w-full p-8 shadow-xl border-0">
          <CardContent className="flex flex-col items-center gap-6 pt-0">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: forgotScreen === 'done' ? '#f0fdf4' : '#FFF3E0' }}>
              {forgotScreen === 'done' ? (
                <ShieldCheck className="w-10 h-10 text-[#00B860]" />
              ) : (
                <Mail className="w-10 h-10 text-[#FF8C00]" />
              )}
            </div>

            {/* Step: Email */}
            {forgotScreen === 'email' && (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Recuperar contraseña</h1>
                  <p className="text-gray-500 text-sm">Ingresa tu correo y te enviaremos un código de recuperación.</p>
                </div>
                <div className="w-full space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="tu@email.com"
                      className="pl-10"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotSendCode()}
                    />
                  </div>
                  {forgotDevCode && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                      <strong>Dev:</strong> Código enviado: {forgotDevCode}
                    </div>
                  )}
                  <Button
                    className="w-full text-white font-bold cursor-pointer"
                    style={{ backgroundColor: '#00B860' }}
                    onClick={handleForgotSendCode}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Enviar código'}
                  </Button>
                </div>
              </>
            )}

            {/* Step: Code verification */}
            {forgotScreen === 'code' && (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Código de verificación</h1>
                  <p className="text-gray-500 text-sm">Ingresa el código de 6 dígitos enviado a <strong>{forgotEmail}</strong></p>
                </div>
                <div className="w-full space-y-4">
                  <Input
                    type="text"
                    placeholder="000000"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotVerifyCode()}
                  />
                  {forgotDevCode && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
                      <strong>Dev:</strong> Código: {forgotDevCode}
                    </div>
                  )}
                  <Button
                    className="w-full text-white font-bold cursor-pointer"
                    style={{ backgroundColor: '#00B860' }}
                    onClick={handleForgotVerifyCode}
                  >
                    Verificar código
                  </Button>
                  <button
                    onClick={() => setForgotScreen('email')}
                    className="w-full text-sm text-gray-500 hover:underline cursor-pointer"
                  >
                    ← Volver a enviar código
                  </button>
                </div>
              </>
            )}

            {/* Step: New password */}
            {forgotScreen === 'newpw' && (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Nueva contraseña</h1>
                  <p className="text-gray-500 text-sm">Ingresa tu nueva contraseña (mínimo 6 caracteres).</p>
                </div>
                <div className="w-full space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Nueva contraseña"
                      className="pl-10"
                      value={forgotNewPw}
                      onChange={(e) => setForgotNewPw(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Confirmar contraseña"
                      className="pl-10"
                      value={forgotConfirmPw}
                      onChange={(e) => setForgotConfirmPw(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleForgotResetPw()}
                    />
                  </div>
                  <Button
                    className="w-full text-white font-bold cursor-pointer"
                    style={{ backgroundColor: '#00B860' }}
                    onClick={handleForgotResetPw}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? (
                      <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Restablecer contraseña'}
                  </Button>
                </div>
              </>
            )}

            {/* Step: Done */}
            {forgotScreen === 'done' && (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Listo!</h1>
                  <p className="text-gray-500 text-sm">Tu contraseña ha sido actualizada. Ya puedes iniciar sesión.</p>
                </div>
                <Button
                  className="w-full text-white font-bold cursor-pointer"
                  style={{ backgroundColor: '#00B860' }}
                  onClick={() => {
                    setForgotScreen('idle');
                    setForgotCode('');
                    setForgotNewPw('');
                    setForgotConfirmPw('');
                    setForgotDevCode('');
                  }}
                >
                  Iniciar sesión
                </Button>
              </>
            )}

            {/* Back to login */}
            {forgotScreen !== 'done' && (
              <button
                onClick={() => { setForgotScreen('idle'); setForgotDevCode(''); }}
                className="text-sm text-gray-500 hover:underline cursor-pointer"
              >
                ← Volver al inicio de sesión
              </button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── PIN Verification Screen ────────────────────────────
  if (showPinScreen) {
    return (
      <motion.div
        className="min-h-screen bg-background flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-md w-full p-8 shadow-xl border-0">
          <CardContent className="flex flex-col items-center gap-6 pt-0">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-[#FFF3E0] flex items-center justify-center">
              {pinBlocked ? (
                <AlertTriangle className="w-10 h-10 text-[#E53935]" />
              ) : (
                <KeyRound className="w-10 h-10 text-[#FF8C00]" />
              )}
            </div>

            {/* Title */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {pinBlocked ? 'Cuenta bloqueada' : 'Verificación de seguridad'}
              </h1>
              <p className="text-gray-500 text-sm">
                {pinBlocked
                  ? `Demasiados intentos fallidos. Intenta de nuevo en ${pinBlockedMinutes} minuto(s).`
                  : `Hola ${user?.name?.split(' ')[0]}. Ingresa tu código PIN de 4 dígitos para continuar.`
                }
              </p>
            </div>

            {/* PIN Input */}
            {!pinBlocked && (
              <>
                <PinInput onComplete={handlePinComplete} disabled={pinLoading} />

                {pinLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="size-4 border-2 border-gray-300 border-t-[#00B860] rounded-full animate-spin" />
                    Verificando...
                  </div>
                )}

                {pinError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-600 text-sm"
                  >
                    <AlertTriangle className="size-4" />
                    {pinError}
                  </motion.div>
                )}

                <p className="text-xs text-gray-400 text-center">
                  Intento {pinAttempts + 1} de 3. Después de 3 intentos fallidos, la cuenta se bloqueará por 15 minutos.
                </p>
              </>
            )}

            {/* Back to login */}
            <button
              onClick={() => {
                setShowPinScreen(false);
                useAuthStore.getState().logout();
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline cursor-pointer"
            >
              Volver al inicio de sesión
            </button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── Main Login/Register Screen ────────────────────────
  return (
    <motion.div
      className="min-h-screen bg-background"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* ─── Left Panel (Desktop) ────────────────────────── */}
        <div
          className="hidden lg:flex flex-col justify-between p-10 xl:p-16 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #00B860 0%, #009e52 40%, #008c48 100%)',
          }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 bg-white" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-10 bg-white" />
          <div className="absolute top-1/3 right-10 w-32 h-32 rounded-full opacity-5 bg-white" />

          {/* Logo & Text */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <ShoppingCart className="size-6 text-white" />
              </div>
              <span className="text-2xl font-extrabold text-white tracking-tight">
                Supermercados Go
              </span>
            </div>
            <p className="text-white/70 text-sm mt-1">
              Tu supermercado en línea en Cúcuta
            </p>
          </div>

          {/* Center Illustration Area */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center -my-6">
            <div className="w-48 h-48 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <div className="text-center text-white">
                <ShoppingCart className="size-16 mx-auto mb-3 opacity-90" />
                <p className="text-lg font-bold">Compra fácil</p>
                <p className="text-sm opacity-70">Recibe en tu puerta</p>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="relative z-10 grid grid-cols-2 gap-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10"
              >
                <badge.icon className="size-4 text-white/90 shrink-0" />
                <span className="text-xs font-medium text-white/90">{badge.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Right Panel: Form ────────────────────────────── */}
        <div className="flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#f0fdf4' }}
              >
                <ShoppingCart className="size-5" style={{ color: '#00B860' }} />
              </div>
              <span className="text-xl font-extrabold tracking-tight" style={{ color: '#00B860' }}>
                Supermercados Go
              </span>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              {isLogin ? (
                /* ─── LOGIN FORM ──────────────────────────── */
                <motion.div
                  key="login"
                  custom={direction}
                  variants={formSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <h1 className="text-2xl sm:text-3xl font-bold mb-1">Iniciar sesión</h1>
                  <p className="text-sm text-muted-foreground mb-6">
                    Ingresa a tu cuenta para hacer tus pedidos
                  </p>

                  {/* Social Login */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => handleSocialLogin('Google')}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <svg className="size-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-sm font-medium">Google</span>
                    </button>
                    <button
                      onClick={() => handleSocialLogin('Facebook')}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="text-sm font-medium">Facebook</span>
                    </button>
                  </div>

                  <div className="relative mb-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                      o continúa con tu email
                    </span>
                  </div>

                  {/* Email */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Correo electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="tu@email.com"
                          className="pl-10"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type={showLoginPw ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw(!showLoginPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={showLoginPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showLoginPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember me + Forgot */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(v) => setRememberMe(v === true)}
                        />
                        <Label htmlFor="remember" className="text-sm cursor-pointer">
                          Recordarme
                        </Label>
                      </div>
                      <button
                        onClick={handleForgotPassword}
                        className="text-sm font-medium hover:underline cursor-pointer"
                        style={{ color: '#FF8C00' }}
                      >
                        Olvidé mi contraseña
                      </button>
                    </div>

                    {/* Submit */}
                    <Button
                      className="w-full text-base font-bold text-white gap-2 cursor-pointer h-11"
                      style={{ backgroundColor: '#00B860' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                      onClick={handleLogin}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Iniciar sesión'
                      )}
                    </Button>
                  </div>

                  {/* Switch to register */}
                  <p className="text-sm text-center text-muted-foreground mt-6">
                    ¿No tienes cuenta?{' '}
                    <button
                      onClick={() => toggleView(false)}
                      className="font-semibold hover:underline cursor-pointer"
                      style={{ color: '#00B860' }}
                    >
                      Regístrate
                    </button>
                  </p>
                </motion.div>
              ) : (
                /* ─── REGISTER FORM ──────────────────────── */
                <motion.div
                  key="register"
                  custom={direction}
                  variants={formSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <h1 className="text-2xl sm:text-3xl font-bold mb-1">Crear cuenta</h1>
                  <p className="text-sm text-muted-foreground mb-6">
                    Regístrate para empezar a comprar
                  </p>

                  {/* Social Login */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={() => handleSocialLogin('Google')}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <svg className="size-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-sm font-medium">Google</span>
                    </button>
                    <button
                      onClick={() => handleSocialLogin('Facebook')}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <svg className="size-5" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="text-sm font-medium">Facebook</span>
                    </button>
                  </div>

                  <div className="relative mb-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                      o regístrate con tu email
                    </span>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Nombre completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="Juan Pérez"
                          className="pl-10"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Correo electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="tu@email.com"
                          className="pl-10"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Teléfono</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type="tel"
                          placeholder="304 401 6277"
                          className="pl-10"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                        />
                        <Badge
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold px-1.5"
                          style={{ backgroundColor: '#FFD93D', color: '#333333' }}
                        >
                          +57
                        </Badge>
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type={showRegPw ? 'text' : 'password'}
                          placeholder="Mínimo 4 caracteres"
                          className="pl-10 pr-10"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPw(!showRegPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={showRegPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showRegPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {/* Password Strength Bar */}
                      {regPassword.length > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: pwStrength.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${(pwStrength.level / 3) * 100}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          <p
                            className="text-xs mt-1 font-medium"
                            style={{ color: pwStrength.color }}
                          >
                            {pwStrength.label}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <Label className="text-sm font-medium mb-1.5 block">Confirmar contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          type={showRegConfirmPw ? 'text' : 'password'}
                          placeholder="Repite tu contraseña"
                          className="pl-10 pr-10"
                          value={regConfirmPw}
                          onChange={(e) => setRegConfirmPw(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegConfirmPw(!showRegConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={showRegConfirmPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showRegConfirmPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        className="mt-0.5"
                        checked={acceptTerms}
                        onCheckedChange={(v) => setAcceptTerms(v === true)}
                      />
                      <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                        Acepto los{' '}
                        <span className="font-medium" style={{ color: '#00B860' }}>
                          términos y condiciones
                        </span>{' '}
                        y la{' '}
                        <span className="font-medium" style={{ color: '#00B860' }}>
                          política de privacidad
                        </span>
                      </Label>
                    </div>

                    {/* Submit */}
                    <Button
                      className="w-full text-base font-bold text-white gap-2 cursor-pointer h-11"
                      style={{ backgroundColor: '#00B860' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#00a050')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#00B860')}
                      onClick={handleRegister}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Crear cuenta'
                      )}
                    </Button>
                  </div>

                  {/* Switch to login */}
                  <p className="text-sm text-center text-muted-foreground mt-6">
                    ¿Ya tienes cuenta?{' '}
                    <button
                      onClick={() => toggleView(true)}
                      className="font-semibold hover:underline cursor-pointer"
                      style={{ color: '#00B860' }}
                    >
                      Inicia sesión
                      <ArrowRight className="inline size-3.5 ml-1" />
                    </button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
