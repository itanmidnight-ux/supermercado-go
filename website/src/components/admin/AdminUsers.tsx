'use client';

import React, { useEffect, useState } from 'react';
import { Search, Users, Shield, User, Mail, Phone, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  worker: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  client: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  worker: 'Trabajador',
  client: 'Cliente',
};

export function AdminUsers() {
  const { users, fetchUsers } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    if (!token) return;
    fetchUsers(token).then(() => setLoading(false));
  }, [token]);

  const filtered = users.filter((u: any) => {
    const matchSearch = !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search);
    const matchRole = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const roleCounts = users.reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00B860] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <p className="text-gray-400 text-sm mt-1">{users.length} usuarios registrados</p>
      </div>

      {/* Role filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'client', 'worker', 'admin'].map(role => (
          <button
            key={role}
            onClick={() => setFilterRole(role)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterRole === role
                ? role === 'admin' ? ROLE_COLORS.admin : role === 'worker' ? ROLE_COLORS.worker : role === 'client' ? ROLE_COLORS.client : 'bg-white/10 text-white border border-white/20'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
            }`}
          >
            {role === 'all' ? 'Todos' : ROLE_LABELS[role] || role} ({role === 'all' ? users.length : roleCounts[role] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#111520] border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#00B860]/50"
        />
      </div>

      {/* Users grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((u: any, i: number) => (
          <motion.div
            key={u.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-[#111520] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#00B860]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-[#00B860] font-bold text-sm">
                  {u.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{u.name}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${ROLE_COLORS[u.role] || ROLE_COLORS.client}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-3 h-3" />
                <span className="truncate">{u.email}</span>
              </div>
              {u.phone && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Phone className="w-3 h-3" />
                  <span>{u.phone}</span>
                </div>
              )}
              {u.created_at && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(u.created_at).toLocaleDateString('es-CO')}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-gray-500 text-center text-sm">No se encontraron usuarios</div>
        )}
      </div>
    </div>
  );
}
