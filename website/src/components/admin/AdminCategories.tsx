'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, X, FolderTree, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

export function AdminCategories() {
  const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchCategories(token).then(() => setLoading(false));
  }, [token]);

  const openNew = () => { setEditId(null); setName(''); setSlug(''); setDescription(''); setImage(''); setSortOrder('0'); setShowForm(true); };

  const openEdit = (c: any) => {
    setEditId(String(c.id));
    setName(c.name || '');
    setSlug(c.slug || '');
    setDescription(c.description || '');
    setImage(c.image || '');
    setSortOrder(String(c.sort_order || 0));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name) return alert('El nombre es obligatorio');
    setSaving(true);
    try {
      const data: any = {
        name, slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description: description || null, image: image || null,
        sort_order: Number(sortOrder) || 0,
      };
      if (editId) {
        await updateCategory(token, editId, data);
      } else {
        await createCategory(token, data);
      }
      setShowForm(false);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Desactivar la categoría "${name}"?`)) return;
    try { await deleteCategory(token, id); } catch (e: any) { alert('Error: ' + e.message); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-gray-400 text-sm mt-1">{categories.length} categorías activas</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Nueva categoría
        </button>
      </div>

      {/* Categories grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c: any, i: number) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#111520] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00B860]/10 flex items-center justify-center flex-shrink-0">
                  {c.image ? (
                    <img src={c.image} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <FolderTree className="w-5 h-5 text-[#00B860]" />
                  )}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{c.name}</p>
                  <p className="text-gray-500 text-[10px]">{c.product_count || 0} productos</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-blue-400 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(String(c.id), c.name)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {c.description && (
              <p className="text-gray-400 text-xs line-clamp-2">{c.description}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-gray-500 text-[10px]">Slug:</span>
              <code className="text-gray-400 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">{c.slug}</code>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#111520] rounded-2xl border border-white/10 w-full max-w-md"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold">{editId ? 'Editar categoría' : 'Nueva categoría'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nombre *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Slug</label>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generado desde el nombre" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Descripción</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50 resize-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">URL de imagen</label>
                  <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#00B860]/50" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Orden</label>
                  <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                </div>
              </div>
              <div className="flex gap-3 p-5 border-t border-white/5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : (editId ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
