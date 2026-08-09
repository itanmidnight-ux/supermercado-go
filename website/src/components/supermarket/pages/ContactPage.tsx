'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  Clock,
  MapPin,
  Send,
  Facebook,
  Instagram,
  Twitter,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';
import { useNavStore } from '@/store/navigation-store';

// ─── Animation helpers ──────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const childFade = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
};

// ─── Contact info data ──────────────────────────────────────
const contactInfo = [
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    value: '+57 304 401 6277',
    color: 'bg-emerald-50',
    iconColor: 'text-[#00B860]',
  },
  {
    icon: Mail,
    label: 'Correo Electrónico',
    value: 'hola@supermercadosgo.com',
    color: 'bg-orange-50',
    iconColor: 'text-[#FF8C00]',
  },
  {
    icon: Clock,
    label: 'Horario de Atención',
    value: 'Lun - Dom  7:00 am - 10:00 pm',
    color: 'bg-amber-50',
    iconColor: 'text-[#FFD93D]',
  },
];

// ─── Component ──────────────────────────────────────────────
export function ContactPage() {
  const { toast } = useToast();
  const { navigate } = useNavStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [sent, setSent] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    toast({
      title: '¡Mensaje enviado!',
      description: 'Te responderemos lo antes posible. Gracias por contactarnos.',
    });
    setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <motion.section
      className="max-w-5xl mx-auto px-4 py-8 pb-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
    >
      {/* ── Header ── */}
      <motion.div
        className="text-center mb-10"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
      >
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
          Contáctanos
        </h1>
        <p className="text-gray-500 text-base max-w-lg mx-auto">
          Estamos aquí para ayudarte. Escríbenos y te responderemos lo más pronto posible.
        </p>
      </motion.div>

      {/* ── Contact info cards ── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {contactInfo.map((info) => (
          <motion.div key={info.label} variants={childFade}>
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow h-full">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <div className={`w-14 h-14 rounded-2xl ${info.color} flex items-center justify-center`}>
                  <info.icon className={`w-6 h-6 ${info.iconColor}`} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{info.label}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{info.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Form + Map grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Form */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">
                Envíanos un mensaje
              </h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">
                      Nombre completo
                    </label>
                    <Input
                      placeholder="Tu nombre"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                      className="rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">
                      Correo electrónico
                    </label>
                    <Input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">
                      Teléfono
                    </label>
                    <Input
                      type="tel"
                      placeholder="+57 300 000 0000"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">
                      Asunto
                    </label>
                    <Select
                      value={formData.subject}
                      onValueChange={(v) => handleChange('subject', v)}
                    >
                      <SelectTrigger className="w-full rounded-lg">
                        <SelectValue placeholder="Selecciona un asunto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pedido">Problema con un pedido</SelectItem>
                        <SelectItem value="producto">Consulta sobre un producto</SelectItem>
                        <SelectItem value="pago">Problema de pago</SelectItem>
                        <SelectItem value="entrega">Demora en entrega</SelectItem>
                        <SelectItem value="sugerencia">Sugerencia</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">
                    Mensaje
                  </label>
                  <Textarea
                    placeholder="Cuéntanos en qué podemos ayudarte..."
                    rows={4}
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    required
                    className="rounded-lg resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  className="bg-[#00B860] hover:bg-[#009E52] text-white font-semibold rounded-xl py-3 text-sm cursor-pointer"
                >
                  {sent ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      ¡Enviado!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar mensaje
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Map placeholder */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <Card className="border-0 shadow-md h-full">
            <CardContent className="p-0 h-full">
              <div className="w-full h-full min-h-[320px] bg-gray-100 rounded-t-xl flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-16 h-16 rounded-full bg-[#00B860]/10 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-[#00B860]" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-800 text-sm mb-1">
                    Nuestra Ubicación
                  </p>
                  <p className="text-gray-500 text-xs leading-relaxed max-w-xs">
                    KDX 1-2B Los Mangos, Cúcuta, Norte de Santander
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Social media ── */}
      <motion.div
        className="text-center"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
      >
        <p className="text-sm text-gray-400 font-medium mb-4">
              Síguenos en redes sociales
        </p>
        <div className="flex items-center justify-center gap-4">
          {[
            { icon: Facebook, color: 'hover:bg-blue-600', label: 'Facebook' },
            { icon: Instagram, color: 'hover:bg-pink-600', label: 'Instagram' },
            { icon: Twitter, color: 'hover:bg-sky-500', label: 'Twitter' },
          ].map((social) => (
            <button
              key={social.label}
              className={`w-11 h-11 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center transition-colors cursor-pointer ${social.color} hover:text-white`}
              aria-label={social.label}
            >
              <social.icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </motion.div>
    </motion.section>
  );
}
