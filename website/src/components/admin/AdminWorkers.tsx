'use client';

import React, { useEffect, useState } from 'react';
import {
  Plus, Search, Edit3, Trash2, X, UserPlus, Mail, Phone, Lock, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

interface WorkerForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  avatar: string;
}

const emptyForm: WorkerForm = { name: '', email: '', phone: '', password: '', avatar: '' };

export function AdminWorkers() {
  const { users, fetchUsers } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchUsers(token).then(() => setLoading(false));
  }, [token]);

  const workers = users.filter((u: any) => u.role === 'worker');
  const filtered = workers.filter((w: any) =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.email?.toLowerCase().includes(search.toLowerCase()) ||
    w.phone?.includes(search)
  );

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (w: any) => {
    setEditId(String(w.id));
    setForm({ name: w.name || '', email: w.email || '', phone: w.phone || '', password: '', avatar: w.avatar || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return alert('Nombre y email son obligatorios');
    setSaving(true);
    try {
      const API_BASE = `${window.location.protocol}//${window.location.hostname}:3777`;
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
      const body = { ...form, role: 'worker' };
      if (editId) {
        if (!form.password) delete (body as any).password;
        await fetch(`${API_BASE}/api/users/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      } else {
        if (!form.password) return alert('La contraseña es obligatoria para nuevos trabajadores');
        await fetch(`${API_BASE}/api/users`, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      await fetchUsers(token);
      setShowForm(false);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al trabajador "${name}"?`)) return;
    try {
      const API_BASE = `${window.location.protocol}//${window.location.hostname}:3777`;
      await fetch(`${API_BASE}/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchUsers(token);
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trabajadores</h1>
          <p className="text-gray-400 text-sm mt-1">{workers.length} trabajadores registrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm">
          <UserPlus className="w-4 h-4" /> Agregar trabajador
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" placeholder="Buscar por nombre, email o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#111520] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#00B860]/50" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((w: any, i: number) => (
          <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            onClick={() => openEdit(w)} className="bg-[#111520] rounded-xl border border-white/5 p-4 hover:border-[#FF8C00]/30 transition-all cursor-pointer group">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-[#FF8C00]/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {w.avatar ? <img src={w.avatar} alt="" className="w-full h-full object-cover" /> :
                  <span className="text-[#FF8C00] font-bold text-sm">{w.name?.charAt(0)?.toUpperCase() || '?'}</span>}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{w.name}</p>
                <p className="text-gray-500 text-[10px] truncate">{w.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">{w.phone || 'Sin teléfono'}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); openEdit(w); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-blue-400"><Edit3 className="w-3.5 h-3.5" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(String(w.id), w.name); }} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-12 text-gray-500 text-center text-sm">No se encontraron trabajadores</div>}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-[#111520] rounded-2xl border border-white/10 w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold">{editId ? 'Editar trabajador' : 'Nuevo trabajador'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nombre completo *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Email (usuario) *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Teléfono</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">{editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">URL foto de perfil</label>
                  <input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#00B860]/50" />
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-white/5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : (editId ? 'Actualizar' : 'Crear trabajador')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
