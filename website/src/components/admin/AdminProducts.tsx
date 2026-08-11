'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, Search, Edit3, Trash2, X, Package, Upload, Image as ImageIcon,
  FileSpreadsheet, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

interface ProductForm {
  name: string;
  description: string;
  price: string;
  cost: string;
  compare_price: string;
  stock: string;
  stock_min: string;
  category_id: string;
  image: string;
  images: string[];
  unit: string;
  is_weighed: boolean;
  is_offer: boolean;
  offer_price: string;
  brand: string;
  sku: string;
  barcode: string;
  nit: string;
}

const emptyForm: ProductForm = {
  name: '', description: '', price: '', cost: '', compare_price: '',
  stock: '', stock_min: '5', category_id: '', image: '', images: [], unit: 'UN',
  is_weighed: false, is_offer: false, offer_price: '', brand: '', sku: '', barcode: '', nit: '',
};

export function AdminProducts() {
  const { products, categories, fetchProducts, fetchCategories, createProduct, updateProduct, deleteProduct } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([fetchProducts(token), fetchCategories(token)]).then(() => setLoading(false));
  }, [token]);

  const filtered = products.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.nit?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (p: any) => {
    setForm({
      name: p.name || '',
      description: p.description || '',
      price: String(p.price || ''),
      cost: String(p.cost || ''),
      compare_price: String(p.compare_price || ''),
      stock: String(p.stock || ''),
      stock_min: String(p.stock_min || 5),
      category_id: String(p.category_id || ''),
      image: p.image || '',
      images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [],
      unit: p.unit || 'UN',
      is_weighed: !!p.is_weighed,
      is_offer: !!p.is_offer,
      offer_price: String(p.offer_price || ''),
      brand: p.brand || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      nit: p.nit || '',
    });
    setEditId(String(p.id));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return alert('Nombre y precio son obligatorios');
    setSaving(true);
    try {
      const data: any = {
        name: form.name, description: form.description,
        price: Number(form.price), cost: Number(form.cost) || 0,
        compare_price: Number(form.compare_price) || null,
        stock: Number(form.stock) || 0, stock_min: Number(form.stock_min) || 5,
        category_id: Number(form.category_id) || null,
        image: form.image || null, images: JSON.stringify(form.images),
        unit: form.unit,
        is_weighed: form.is_weighed, is_offer: form.is_offer,
        offer_price: Number(form.offer_price) || null,
        brand: form.brand || null, sku: form.sku || null, barcode: form.barcode || null,
        nit: form.nit || null,
      };
      if (editId) {
        await updateProduct(token, editId, data);
      } else {
        await createProduct(token, data);
      }
      setShowForm(false);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este producto?')) return;
    try { await deleteProduct(token, id); } catch (e: any) { alert('Error: ' + e.message); }
  };

  const addImage = () => {
    if (newImageUrl.trim()) {
      setForm({ ...form, images: [...form.images, newImageUrl.trim()] });
      setNewImageUrl('');
    }
  };

  const removeImage = (idx: number) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
        const row: any = {};
        headers.forEach((h, j) => { row[h] = values[j]; });
        if (row.name && row.price) {
          try {
            await createProduct(token, {
              name: row.name,
              price: Number(row.price) || 0,
              stock: Number(row.stock) || 0,
              brand: row.brand || null,
              sku: row.sku || null,
              nit: row.nit || null,
              category_id: row.category_id ? Number(row.category_id) : null,
            });
            imported++;
          } catch {}
        }
      }
      alert(`${imported} productos importados correctamente`);
      setShowImport(false);
    } catch (err: any) {
      alert('Error al importar: ' + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
          <h1 className="text-2xl font-bold text-white">Productos</h1>
          <p className="text-gray-400 text-sm mt-1">{products.length} productos registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2.5 rounded-xl transition-colors text-sm border border-white/10">
            <FileSpreadsheet className="w-4 h-4" /> Importar Excel
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium px-4 py-2.5 rounded-xl transition-colors text-sm">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por nombre, marca, SKU o NIT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#111520] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#00B860]/50"
        />
      </div>

      {/* Products table */}
      <div className="bg-[#111520] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Producto</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">NIT</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Precio</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Stock</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Categoría</th>
                <th className="text-left text-gray-400 font-medium py-3 px-4 text-xs">Oferta</th>
                <th className="text-right text-gray-400 font-medium py-3 px-4 text-xs">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate max-w-[200px]">{p.name}</p>
                        {p.brand && <p className="text-gray-500 text-[10px]">{p.brand}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-300 text-xs font-mono">{p.nit || '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[#00B860] font-medium text-xs">{formatCOP(p.price)}</span>
                    {p.compare_price > 0 && (
                      <span className="text-gray-500 text-[10px] line-through ml-1">{formatCOP(p.compare_price)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium ${p.stock <= (p.stock_min || 0) ? 'text-red-400' : 'text-gray-300'}`}>
                      {p.stock} {p.unit || 'ud'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-400 text-xs">{categories.find((c: any) => c.id === p.category_id)?.name || '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {p.is_offer ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FF8C00]/10 text-[#FF8C00] text-[10px] font-medium border border-[#FF8C00]/20">
                        -{Math.round((1 - (p.offer_price || p.price) / p.price) * 100)}%
                      </span>
                    ) : (
                      <span className="text-gray-600 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-blue-400 transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(String(p.id))} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-gray-500 text-center text-sm">No se encontraron productos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              className="bg-[#111520] rounded-2xl border border-white/10 w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#111520] z-10">
                <h2 className="text-white font-bold">{editId ? 'Editar producto' : 'Nuevo producto'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Nombre y NIT */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Nombre *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">NIT / Código</label>
                    <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} placeholder="Ej: 890123456" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Descripción</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50 resize-none" />
                </div>

                {/* Precios */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Precio (COP) *</label>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Costo</label>
                    <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">P. Comparado</label>
                    <input type="number" value={form.compare_price} onChange={(e) => setForm({ ...form, compare_price: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                </div>

                {/* Stock */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Stock</label>
                    <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Stock mínimo</label>
                    <input type="number" value={form.stock_min} onChange={(e) => setForm({ ...form, stock_min: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Unidad</label>
                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50">
                      <option value="UN">Unidad</option>
                      <option value="kg">Kilogramo</option>
                      <option value="g">Gramo</option>
                      <option value="ml">Mililitro</option>
                      <option value="L">Litro</option>
                    </select>
                  </div>
                </div>

                {/* Categoría y Marca */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Categoría</label>
                    <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50">
                      <option value="">Sin categoría</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Marca</label>
                    <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                </div>

                {/* SKU y Barcode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">SKU</label>
                    <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Código de barras</label>
                    <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                </div>

                {/* Imagen principal */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Imagen principal (URL)</label>
                  <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#00B860]/50" />
                </div>

                {/* Imágenes adicionales */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Imágenes adicionales (opcional)</label>
                  <div className="flex gap-2 mb-2">
                    <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="URL de imagen..." className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#00B860]/50" />
                    <button onClick={addImage} type="button" className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 text-sm transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {form.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.images.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                          <button onClick={() => removeImage(idx)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checkboxes */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_weighed} onChange={(e) => setForm({ ...form, is_weighed: e.target.checked })} className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#00B860]" />
                    <span className="text-gray-300 text-xs">Es pesado (kg)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_offer} onChange={(e) => setForm({ ...form, is_offer: e.target.checked })} className="w-4 h-4 rounded bg-white/5 border-white/10 accent-[#00B860]" />
                    <span className="text-gray-300 text-xs">En oferta</span>
                  </label>
                </div>
                {form.is_offer && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Precio de oferta</label>
                    <input type="number" value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 p-5 border-t border-white/5 sticky bottom-0 bg-[#111520]">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#00B860] hover:bg-[#00d97a] text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50">
                  {saving ? 'Guardando...' : (editId ? 'Actualizar' : 'Crear producto')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Excel Modal */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-[#111520] rounded-2xl border border-white/10 w-full max-w-md p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">Importar desde Excel</h2>
                <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <p className="text-gray-300 text-xs mb-2">Formato esperado del CSV:</p>
                <code className="text-[10px] text-gray-400 block">name,price,stock,brand,sku,nit,category_id</code>
                <code className="text-[10px] text-gray-500 block mt-1">Arroz,5500,100,Arroz Mary,SKU001,890123456,1</code>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleExcelImport} className="w-full mb-4 text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#00B860] file:text-white file:cursor-pointer file:hover:bg-[#00d97a]" />
              {importing && <p className="text-[#00B860] text-sm text-center">Importando productos...</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
