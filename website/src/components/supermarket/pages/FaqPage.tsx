'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  HelpCircle,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { useDataStore } from '@/store/data-store';
import { useNavStore } from '@/store/navigation-store';

// ─── Animation ──────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: 'easeOut' as const },
  }),
};

// ─── Component ──────────────────────────────────────────────
export function FaqPage() {
  const { navigate } = useNavStore();
  const faqs = useDataStore((s) => s.faqs);
  const [query, setQuery] = useState('');

  const filteredFaqs = useMemo(() => {
    if (!query.trim()) return faqs;
    const lower = query.toLowerCase();
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(lower) ||
        f.answer.toLowerCase().includes(lower),
    );
  }, [query]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 pb-16">
      {/* ── Hero ── */}
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
      >
        <div className="w-16 h-16 rounded-2xl bg-[#FFD93D]/20 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-[#FF8C00]" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
          Preguntas Frecuentes
        </h1>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Encuentra respuestas a las dudas más comunes sobre nuestros servicios, entregas y pagos.
        </p>
      </motion.div>

      {/* ── Search ── */}
      <motion.div
        className="relative mb-8"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
      >
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar en preguntas frecuentes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 rounded-xl h-12 border-gray-200 bg-gray-50 focus:bg-white transition-colors"
        />
      </motion.div>

      {/* ── Accordion ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.4 } }}
      >
        {filteredFaqs.length > 0 ? (
          <Accordion type="single" collapsible className="gap-0">
            {filteredFaqs.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`faq-${idx}`}
                className="border-b border-gray-100 last:border-b-0"
              >
                <AccordionTrigger className="text-left text-sm font-semibold text-gray-800 hover:text-[#00B860] hover:no-underline py-5 transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-500 text-sm leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">
              No encontramos resultados para &ldquo;{query}&rdquo;
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Intenta con otras palabras o contáctanos directamente.
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* ── Bottom CTA ── */}
      <motion.div
        className="mt-12 bg-gray-50 rounded-2xl p-8 text-center"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        custom={0}
      >
        <MessageCircle className="w-8 h-8 text-[#00B860] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          ¿No encontraste tu respuesta?
        </h2>
        <p className="text-gray-500 text-sm mb-5 max-w-sm mx-auto">
          Nuestro equipo de soporte está disponible para ayudarte con cualquier consulta.
        </p>
        <Button
          className="bg-[#00B860] hover:bg-[#009E52] text-white font-semibold rounded-xl px-6 cursor-pointer"
          onClick={() => navigate('contact')}
        >
          Contáctanos
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </main>
  );
}
