'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Save, Store, MapPin, Phone, Clock, Truck, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

export function AdminSettings() {
  const { settings, fetchSettings, updateSettings } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    fetchSettings(token).then(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(token, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    {
      title: 'Información del negocio',
      icon: Store,
      fields: [
        { key: 'business_name', label: 'Nombre del negocio' },
        { key: 'business_phone', label: 'Teléfono', icon: Phone },
        { key: 'business_email', label: 'Email' },
        { key: 'business_address', label: 'Dirección', icon: MapPin },
        { key: 'business_city', label: 'Ciudad' },
        { key: 'business_department', label: 'Departamento' },
        { key: 'business_hours', label: 'Horario', icon: Clock },
        { key: 'business_tagline', label: 'Eslogan' },
      ]
    },
    {
      title: 'Entrega',
      icon: Truck,
      fields: [
        { key: 'delivery_fee', label: 'Costo de entrega (COP)' },
        { key: 'free_delivery_min', label: 'Envío gratis desde (COP)' },
        { key: 'operating_zone', label: 'Zona de operación' },
      ]
    },
    {
      title: 'Marca',
      icon: Palette,
      fields: [
        { key: 'brand_primary', label: 'Color primario (hex)', type: 'color' },
        { key: 'brand_accent', label: 'Color acento (hex)', type: 'color' },
        { key: 'brand_dark', label: 'Color oscuro (hex)', type: 'color' },
      ]
    },
    {
      title: 'Contenido',
      icon: Settings,
      fields: [
        { key: 'app_welcome_message', label: 'Mensaje de bienvenida', type: 'textarea' },
        { key: 'delivery_info_text', label: 'Info de entrega', type: 'textarea' },
        { key: 'how_to_buy_text', label: 'Cómo comprar', type: 'textarea' },
      ]
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-gray-400 text-sm mt-1">Administra la configuración del negocio</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar cambios'}
        </button>
      </div>

      {sections.map((section, si) => {
        const Icon = section.icon;
        return (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.1 }}
            className="bg-[#111520] rounded-xl border border-white/5 p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#00B860]/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#00B860]" />
              </div>
              <h3 className="text-white font-semibold text-sm">{section.title}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.fields.map(field => (
                <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50 resize-none"
                    />
                  ) : field.type === 'color' ? (
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={form[field.key] || '#00B860'}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        className="w-10 h-9 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={form[field.key] || ''}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50"
                      />
                    </div>
                  ) : (
                    <input
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50"
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
