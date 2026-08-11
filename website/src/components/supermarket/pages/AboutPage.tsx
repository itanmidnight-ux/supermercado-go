'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Package,
  DollarSign,
  Users,
  Truck,
  Star,
  Shield,
  Lightbulb,
  Headphones,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavStore } from '@/store/navigation-store';

// ─── Animation helpers ──────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
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

// ─── Mission cards ──────────────────────────────────────────
const missionItems = [
  {
    icon: Package,
    title: 'Llevar lo mejor del supermercado a tu puerta',
    description:
      'Seleccionamos cuidadosamente cada producto para garantizar frescura y calidad en cada entrega.',
  },
  {
    icon: DollarSign,
    title: 'Ofrecer precios justos y productos frescos',
    description:
      'Trabajamos directamente con productores locales para darte los mejores precios sin sacrificar calidad.',
  },
  {
    icon: Users,
    title: 'Crear comunidad con nuestros clientes',
    description:
      'Más que un supermercado, somos tu vecino digital. Construimos relaciones duraderas basadas en confianza.',
  },
];

// ─── Stats ──────────────────────────────────────────────────
const stats = [
  { value: 5000, suffix: '+', label: 'Clientes', icon: Users },
  { value: 50000, suffix: '+', label: 'Pedidos entregados', icon: Package },
  { value: 100, suffix: '+', label: 'Productos', icon: Star },
  { value: 45, suffix: ' min', label: 'Entrega promedio', icon: Truck, prefix: '30-60' },
];

// ─── Team ───────────────────────────────────────────────────
const team = [
  {
    name: 'Carlos Mendoza',
    role: 'CEO',
    initials: 'CM',
    color: 'bg-[#00B860]',
    description: 'Apasionado por la innovación en el retail y comprometido con la comunidad cucuteña.',
  },
  {
    name: 'María Fernanda López',
    role: 'COO',
    initials: 'ML',
    color: 'bg-[#FF8C00]',
    description: 'Especialista en operaciones logísticas con más de 10 años de experiencia en distribución.',
  },
  {
    name: 'Andrés Pérez',
    role: 'CTO',
    initials: 'AP',
    color: 'bg-[#FFD93D]',
    description: 'Ingeniero de sistemas enfocado en crear experiencias digitales excepcionales para nuestros clientes.',
  },
  {
    name: 'Laura Martínez',
    role: 'CM',
    initials: 'LM',
    color: 'bg-emerald-500',
    description: 'Experta en marketing digital y relaciones públicas, conecta la marca con nuestra comunidad.',
  },
];

// ─── Values ─────────────────────────────────────────────────
const values = [
  {
    icon: Star,
    title: 'Calidad',
    description: 'Cada producto es seleccionado con los más altos estándares de frescura.',
  },
  {
    icon: Shield,
    title: 'Confianza',
    description: 'Transparencia total en precios, procesos y atención al cliente.',
  },
  {
    icon: Lightbulb,
    title: 'Innovación',
    description: 'Tecnología de punta para hacer tu experiencia de compra más fácil.',
  },
  {
    icon: Headphones,
    title: 'Servicio',
    description: 'Equipo dedicado a resolver cualquier inquietud de forma rápida y amable.',
  },
];

// ─── Animated counter hook ──────────────────────────────────
function useAnimatedNumber(target: number, inView: boolean, duration = 2000) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inView) return;

    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, inView, duration]);

  return count;
}

function AnimatedStat({
  stat,
}: {
  stat: (typeof stats)[number];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const count = useAnimatedNumber(stat.value, inView);
  const Icon = stat.icon;

  return (
    <div ref={ref} className="text-center">
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <p className="text-3xl md:text-4xl font-extrabold text-white mb-1">
        {stat.prefix ?? '+'}{count.toLocaleString('es-CO')}{stat.suffix}
      </p>
      <p className="text-white/80 text-sm font-medium">{stat.label}</p>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────
export function AboutPage() {
  const { navigate } = useNavStore();

  return (
    <main className="pb-16">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#00B860] via-[#009E52] to-emerald-700 py-16 md:py-24 px-4">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.h1
            className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.6 } }}
          >
            Sobre Nosotros
          </motion.h1>
          <motion.p
            className="text-white/85 text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.5 } }}
          >
            En Supermercados Go creemos que hacer las compras del hogar debe ser
            fácil, rápido y accesible para toda la familia cucuteña.
          </motion.p>
        </div>
      </section>

      {/* ── Nuestra Misión ── */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <motion.h2
          className="text-2xl md:text-3xl font-extrabold text-gray-900 text-center mb-3"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0}
        >
          Nuestra Misión
        </motion.h2>
        <motion.p
          className="text-gray-500 text-center mb-10 max-w-lg mx-auto text-sm"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={1}
        >
          Tres pilares que guían todo lo que hacemos cada día.
        </motion.p>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {missionItems.map((item) => (
            <motion.div key={item.title} variants={childFade}>
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow h-full">
                <CardContent className="flex flex-col items-start gap-4 p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#00B860]/10 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-[#00B860]" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-gradient-to-r from-[#00B860] to-emerald-600 py-14 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <AnimatedStat key={stat.label} stat={stat} />
          ))}
        </div>
      </section>

      {/* ── Nuestro Equipo ── */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <motion.h2
          className="text-2xl md:text-3xl font-extrabold text-gray-900 text-center mb-3"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0}
        >
          Nuestro Equipo
        </motion.h2>
        <motion.p
          className="text-gray-500 text-center mb-10 max-w-lg mx-auto text-sm"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={1}
        >
          Las personas detrás de Supermercados Go.
        </motion.p>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {team.map((member) => (
            <motion.div key={member.name} variants={childFade}>
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow h-full text-center">
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <div
                    className={`w-16 h-16 rounded-full ${member.color} flex items-center justify-center text-white text-lg font-bold shadow-md`}
                  >
                    {member.initials}
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {member.name}
                  </h3>
                  <span className="text-xs font-semibold text-[#00B860] bg-[#00B860]/10 px-3 py-1 rounded-full">
                    {member.role}
                  </span>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    {member.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Valores ── */}
      <section className="bg-gray-50 py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="text-2xl md:text-3xl font-extrabold text-gray-900 text-center mb-3"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            custom={0}
          >
            Nuestros Valores
          </motion.h2>
          <motion.p
            className="text-gray-500 text-center mb-10 max-w-lg mx-auto text-sm"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            custom={1}
          >
            Los principios que definen nuestra cultura.
          </motion.p>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {values.map((v) => (
              <motion.div key={v.title} variants={childFade}>
                <div className="flex flex-col items-center text-center gap-3 p-5">
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <v.icon className="w-6 h-6 text-[#FF8C00]" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{v.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    {v.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-5xl mx-auto px-4 py-14">
        <motion.div
          className="bg-gradient-to-r from-[#FF8C00] to-[#FFD93D] rounded-2xl p-8 md:p-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
          viewport={{ once: true, margin: '-60px' }}
        >
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
            ¿Listo para ordenar?
          </h2>
          <p className="text-gray-800/80 text-sm mb-6 max-w-md mx-auto">
            Descubre nuestra amplia variedad de productos frescos y recibe tu pedido
            en la puerta de tu casa.
          </p>
          <Button
            size="lg"
            className="bg-[#00B860] hover:bg-[#009E52] text-white font-bold rounded-xl px-8 text-base cursor-pointer shadow-lg"
            onClick={() => navigate('catalog')}
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Ir al catálogo
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </section>
    </main>
  );
}
