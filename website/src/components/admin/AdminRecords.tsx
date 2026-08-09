'use client';

import React, { useState } from 'react';
import {
  FileText, Download, FileSpreadsheet, Calculator, Building, TrendingUp,
  Calendar, Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminStore } from '../../store/admin-store';
import { useAuthStore } from '../../store/auth-store';

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function generatePDF(title: string, data: any[], headers: string[], filename: string) {
  const rows = data.map(row => headers.map(h => row[h] || '—'));
  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
  h1 { color: #00B860; font-size: 24px; border-bottom: 2px solid #00B860; padding-bottom: 10px; }
  .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; color: #666; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #00B860; color: white; padding: 10px 8px; text-align: left; font-size: 12px; }
  td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) { background: #f9f9f9; }
  .total { font-weight: bold; background: #f0fdf4; }
  .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { body { padding: 20px; } }
</style></head><body>
<h1>${title}</h1>
<div class="header-info"><span>Supermercados Go</span><span>${new Date().toLocaleDateString('es-CO')}</span></div>
<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="footer">Documento generado automáticamente — Supermercados Go © ${new Date().getFullYear()}</div>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.html`; a.click();
  URL.revokeObjectURL(url);
}

function generateCSV(headers: string[], rows: any[][], filename: string) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function generateExcel(title: string, headers: string[], rows: any[][], filename: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${title}"><Table>
<Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${rows.map(r => `<Row>${r.map(c => `<Cell><Data ss:Type="String">${c}</Data></Cell>`).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.xls`; a.click();
  URL.revokeObjectURL(url);
}

export function AdminRecords() {
  const { stats, orders, products } = useAdminStore();
  const token = useAuthStore((s) => s.token)!;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);

  const filteredOrders = orders.filter((o: any) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(o.created_at);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalRevenue = filteredOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const totalCost = filteredOrders.reduce((sum: number, o: any) => sum + (o.total || 0) * 0.6, 0);
  const profit = totalRevenue - totalCost;

  const handleExport = async (type: string, format: string) => {
    setGenerating(type);
    await new Promise(r => setTimeout(r, 500));

    const headers: string[] = [];
    const rows: any[][] = [];

    if (type === 'ventas') {
      headers.push('ID', 'Cliente', 'Fecha', 'Total', 'Estado', 'Método Pago');
      filteredOrders.forEach(o => rows.push([
        String(o.id).slice(-6), o.customer_name || o.user_name || '—',
        new Date(o.created_at).toLocaleDateString('es-CO'), formatCOP(o.total || 0),
        o.status, o.payment_method || '—'
      ]));
      if (format === 'pdf') generatePDF('Registro de Ventas', filteredOrders.map((o, i) => ({
        ID: String(o.id).slice(-6), Cliente: o.customer_name || o.user_name || '—',
        Fecha: new Date(o.created_at).toLocaleDateString('es-CO'), Total: formatCOP(o.total || 0),
        Estado: o.status, 'Método Pago': o.payment_method || '—'
      })), headers, 'registro-ventas');
      else if (format === 'csv') generateCSV(headers, rows, 'registro-ventas');
      else generateExcel('Registro de Ventas', headers, rows, 'registro-ventas');
    }

    if (type === 'ganancias') {
      headers.push('Concepto', 'Monto');
      const data = [
        { Concepto: 'Ingresos por ventas', Monto: formatCOP(totalRevenue) },
        { Concepto: 'Costo estimado (60%)', Monto: formatCOP(totalCost) },
        { Concepto: 'Ganancia neta', Monto: formatCOP(profit) },
        { Concepto: 'Número de pedidos', Monto: String(filteredOrders.length) },
        { Concepto: 'Ticket promedio', Monto: formatCOP(totalRevenue / (filteredOrders.length || 1)) },
      ];
      if (format === 'pdf') generatePDF('Registro de Ganancias', data, headers, 'registro-ganancias');
      else if (format === 'csv') generateCSV(headers, data.map(d => [d.Concepto, d.Monto]), 'registro-ganancias');
      else generateExcel('Registro de Ganancias', headers, data.map(d => [d.Concepto, d.Monto]), 'registro-ganancias');
    }

    if (type === 'dian') {
      headers.push('Campo', 'Valor');
      const data = [
        { Campo: 'Razón Social', Valor: 'Supermercados Go S.A.S' },
        { Campo: 'NIT', Valor: '900123456-7' },
        { Campo: 'Dirección', Valor: 'KDX 1-2B Los Mangos, Cúcuta' },
        { Campo: 'Régimen', Valor: 'Responsable de IVA' },
        { Campo: 'Período', Valor: `${dateFrom || 'Inicio'} - ${dateTo || 'Fin'}` },
        { Campo: 'Total Ventas', Valor: formatCOP(totalRevenue) },
        { Campo: 'Total IVA (19%)', Valor: formatCOP(totalRevenue * 0.19) },
        { Campo: 'Retención en la Fuente', Valor: formatCOP(totalRevenue * 0.025) },
        { Campo: 'Total Pedidos', Valor: String(filteredOrders.length) },
        { Campo: 'Fecha Generación', Valor: new Date().toLocaleDateString('es-CO') },
      ];
      if (format === 'pdf') generatePDF('Registro DIAN - Supermercados Go', data, headers, 'registro-dian');
      else if (format === 'csv') generateCSV(headers, data.map(d => [d.Campo, d.Valor]), 'registro-dian');
      else generateExcel('Registro DIAN', headers, data.map(d => [d.Campo, d.Valor]), 'registro-dian');
    }

    if (type === 'inventario') {
      headers.push('Producto', 'SKU', 'Stock', 'Precio', 'Categoría', 'Estado');
      const data = products.map((p: any) => ({
        Producto: p.name, SKU: p.sku || '—', Stock: String(p.stock),
        Precio: formatCOP(p.price), Categoría: p.category_name || '—',
        Estado: p.stock <= 0 ? 'Sin stock' : p.stock <= (p.stock_min || 5) ? 'Stock bajo' : 'OK'
      }));
      if (format === 'pdf') generatePDF('Inventario de Productos', data, headers, 'inventario');
      else if (format === 'csv') generateCSV(headers, data.map(d => Object.values(d)), 'inventario');
      else generateExcel('Inventario', headers, data.map(d => Object.values(d)), 'inventario');
    }

    setGenerating(null);
  };

  const exportOptions = [
    { id: 'ventas', label: 'Registro de Ventas', desc: 'Historial completo de ventas del período', icon: TrendingUp, color: '#00B860' },
    { id: 'ganancias', label: 'Registro de Ganancias', desc: 'Ingresos, costos y ganancia neta', icon: Calculator, color: '#FF8C00' },
    { id: 'dian', label: 'Registro DIAN', desc: 'Datos fiscales para la DIAN', icon: Building, color: '#8B5CF6' },
    { id: 'inventario', label: 'Inventario de Productos', desc: 'Stock actual y estados', icon: FileSpreadsheet, color: '#FFD93D' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Registros</h1>
        <p className="text-gray-400 text-sm mt-1">Exportar datos e informes del negocio</p>
      </div>

      {/* Date filter */}
      <div className="bg-[#111520] rounded-xl border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-white text-sm font-medium">Filtrar por fecha</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-1 block">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
          </div>
          <div className="flex-1">
            <label className="text-gray-400 text-xs mb-1 block">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#00B860]/50" />
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span>Pedidos filtrados: <strong className="text-white">{filteredOrders.length}</strong></span>
          <span>Total: <strong className="text-[#00B860]">{formatCOP(totalRevenue)}</strong></span>
        </div>
      </div>

      {/* Export options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <motion.div key={opt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#111520] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-all">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${opt.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: opt.color }} />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">{opt.label}</h3>
                  <p className="text-gray-400 text-xs">{opt.desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleExport(opt.id, 'pdf')} disabled={generating === opt.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
                <button onClick={() => handleExport(opt.id, 'excel')} disabled={generating === opt.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
                <button onClick={() => handleExport(opt.id, 'csv')} disabled={generating === opt.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
