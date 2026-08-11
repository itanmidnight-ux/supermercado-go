'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit3, Trash2, X, Users, Mail, Phone, Ban, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

interface ClientForm { name: string; email: string; phone: string; password: string; }
const emptyForm: ClientForm = { name: '', email: '', phone: '', password: '' };

export function AdminClients() {
  const { users, fetchUsers } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (token) fetchUsers(token).then(() => setLoading(false)); }, [token]);

  const clients = users.filter((u: any) => u.role === 'client');
  const filtered = clients.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c: any) => {
    setEditId(String(c.id));
    setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '', password: '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return alert('Nombre y email son obligatorios');
    setSaving(true);
    try {
      const API_BASE = `${window.location.protocol}//${window.location.hostname}:3777`;
      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
      const body: any = { name: form.name, email: form.email, phone: form.phone, role: 'client' };
      if (form.password) body.password = form.password;
      if (editId) {
        await fetch(`${API_BASE}/api/users/${editId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      } else {
        if (!form.password) return alert('La contraseña es obligatoria');
        body.password = form.password;
        await fetch(`${API_BASE}/api/users`, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      await fetchUsers(token);
      setShowForm(false);
    } catch (e: any) { alert('Error: ' + e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al cliente "${name}"?`)) return;
    try {
      const API_BASE = `${window.location.protocol}//${window.location.hostname}:3777`;
      await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      await fetchUsers(token);
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const handleBlock = async (id: string, name: string) => {
    if (!confirm(`¿Bloquear/desbloquear a "${name}"?`)) return;
    try {
      const API_BASE = `${window.location.protocol}//${window.location.hostname}:3777`;
      await fetch(`${API_BASE}/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_active: 0 }),
      });
      await fetchUsers(token);
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 text-sm mt-1">{clients.length} clientes registrados</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm">
          <UserPlus className="w-4 h-4" /> Agregar cliente
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" placeholder="Buscar por nombre, email o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#111520] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#00B860]/50" />
      </div>

      <div className="bg-[#111520] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Cliente</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Email</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Teléfono</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Estado</th>
                <th className="text-right text-gray-400 font-medium py-3 px-4 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#00B860]/15 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#00B860] font-bold text-xs">{c.name?.charAt(0)?.toUpperCase() || '?'}</span>
                      </div>
                      <span className="text-white text-xs font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-300 text-xs">{c.email}</td>
                  <td className="py-3 px-4 text-gray-300 text-xs">{c.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.is_active ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                      {c.is_active ? 'Activo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-blue-400"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleBlock(String(c.id), c.name)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-yellow-400"><Ban className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(String(c.id), c.name)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="py-12 text-gray-500 text-center text-sm">No se encontraron clientes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-[#111520] rounded-2xl border border-white/10 w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold">{editId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div><label className="text-gray-400 text-xs mb-1 block">Nombre *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" /></div>
                <div><label className="text-gray-400 text-xs mb-1 block">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" /></div>
                <div><label className="text-gray-400 text-xs mb-1 block">Teléfono</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" /></div>
                <div><label className="text-gray-400 text-xs mb-1 block">{editId ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña *'}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" /></div>
              </div>
              <div className="flex gap-3 p-5 border-t border-white/5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : (editId ? 'Actualizar' : 'Crear cliente')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
