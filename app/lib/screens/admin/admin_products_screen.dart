import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../models/product.dart';
import '../../providers/product_provider.dart';
import '../../providers/settings_provider.dart';
import '../../services/storage_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/empty_state.dart';

class AdminProductsScreen extends StatefulWidget {
  const AdminProductsScreen({super.key});

  @override
  State<AdminProductsScreen> createState() => _AdminProductsScreenState();
}

class _AdminProductsScreenState extends State<AdminProductsScreen> {
  String _search = '';

  @override
  void initState() {
    super.initState();
    context.read<ProductProvider>().loadProducts();
  }

  Future<void> _quickToggleOffer(Product p) async {
    final newIsOffer = !p.isOffer;
    final body = <String, dynamic>{'is_offer': newIsOffer};
    if (!newIsOffer) {
      body['offer_price'] = null;
    } else if (p.offerPrice == null) {
      body['offer_price'] = (p.price * 0.8).round();
    }
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.put(
        Uri.parse('${sp.serverUrl}/api/products/${p.id}'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
      if (mounted) {
        context.read<ProductProvider>().loadProducts();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(newIsOffer ? '${p.name} marcado como oferta' : '${p.name} quitado de oferta'),
          backgroundColor: AppColors.primary,
          duration: const Duration(seconds: 1),
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al actualizar producto'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _showProductDialog(Product? p) {
    final nameCtrl = TextEditingController(text: p?.name ?? '');
    final priceCtrl = TextEditingController(text: p != null ? p.price.toString() : '');
    final compareCtrl = TextEditingController(text: p?.comparePrice?.toString() ?? '');
    final offerCtrl = TextEditingController(text: p?.offerPrice?.toString() ?? '');
    final stockCtrl = TextEditingController(text: p != null ? p.stock.toInt().toString() : '0');
    final descCtrl = TextEditingController(text: p?.description ?? '');
    final imgCtrl = TextEditingController(text: p?.image ?? '');
    final brandCtrl = TextEditingController(text: p?.brand ?? '');
    final skuCtrl = TextEditingController(text: p?.sku ?? '');
    final barcodeCtrl = TextEditingController(text: p?.barcode ?? '');
    bool isOffer = p?.isOffer ?? false;
    bool isActive = p?.isActive ?? true;
    final isEdit = p != null;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(isEdit ? 'Editar Producto' : 'Nuevo Producto'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nombre *')),
                const SizedBox(height: 8),
                TextField(controller: descCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Descripción')),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio COP *'))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: compareCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio antes (COP)'))),
                ]),
                const SizedBox(height: 8),
                SwitchListTile(
                  title: const Text('OFERTA', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.accent)),
                  value: isOffer,
                  onChanged: (v) => setDlg(() => isOffer = v),
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppColors.accent,
                ),
                if (isOffer)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: TextField(
                      controller: offerCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Precio oferta COP', prefixIcon: Icon(Icons.local_offer, color: AppColors.accent)),
                    ),
                  ),
                Row(children: [
                  Expanded(child: TextField(controller: stockCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Stock'))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: skuCtrl, decoration: const InputDecoration(labelText: 'SKU'))),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: TextField(controller: barcodeCtrl, decoration: const InputDecoration(labelText: 'Código barras'))),
                  const SizedBox(width: 8),
                  Expanded(child: TextField(controller: brandCtrl, decoration: const InputDecoration(labelText: 'Marca'))),
                ]),
                const SizedBox(height: 8),
                TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'URL imagen')),
                SwitchListTile(
                  title: const Text('Activo'),
                  value: isActive,
                  onChanged: (v) => setDlg(() => isActive = v),
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppColors.primary,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty || priceCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Nombre y precio son obligatorios'), backgroundColor: AppColors.error),
                  );
                  return;
                }
                Navigator.pop(ctx);
                final sp = context.read<SettingsProvider>();
                final token = await StorageService.getToken();
                final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
                final body = <String, dynamic>{
                  'name': nameCtrl.text.trim(),
                  'description': descCtrl.text.trim(),
                  'price': int.tryParse(priceCtrl.text) ?? 0,
                  'compare_price': compareCtrl.text.trim().isEmpty ? null : int.tryParse(compareCtrl.text),
                  'stock': int.tryParse(stockCtrl.text) ?? 0,
                  'sku': skuCtrl.text.trim().isEmpty ? null : skuCtrl.text.trim(),
                  'barcode': barcodeCtrl.text.trim().isEmpty ? null : barcodeCtrl.text.trim(),
                  'brand': brandCtrl.text.trim().isEmpty ? null : brandCtrl.text.trim(),
                  'image': imgCtrl.text.trim().isEmpty ? null : imgCtrl.text.trim(),
                  'is_offer': isOffer,
                  'offer_price': isOffer ? (int.tryParse(offerCtrl.text)) : null,
                  'is_active': isActive,
                };
                try {
                  if (isEdit) {
                    await http.put(Uri.parse('${sp.serverUrl}/api/products/${p!.id}'), headers: headers, body: jsonEncode(body));
                  } else {
                    await http.post(Uri.parse('${sp.serverUrl}/api/products'), headers: headers, body: jsonEncode(body));
                  }
                  if (mounted) {
                    context.read<ProductProvider>().loadProducts();
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(isEdit ? 'Producto actualizado' : 'Producto creado'),
                      backgroundColor: AppColors.primary,
                    ));
                  }
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Error al guardar producto'), backgroundColor: AppColors.error),
                    );
                  }
                }
              },
              child: Text(isEdit ? 'Guardar' : 'Crear'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        title: const Text('Productos'),
        actions: [
          IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => _showProductDialog(null)),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Buscar...', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _search = v.toLowerCase()),
            ),
          ),
          Expanded(
            child: Consumer<ProductProvider>(
              builder: (_, pp, __) {
                if (pp.isLoading && pp.products.isEmpty) {
                  return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                }
                final filtered = pp.products.where((p) => p.name.toLowerCase().contains(_search)).toList();
                if (filtered.isEmpty) return const EmptyState(icon: Icons.inventory_2, title: 'Sin productos', subtitle: 'No hay productos para mostrar');
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) {
                    final p = filtered[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        onTap: () => _showProductDialog(p),
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(color: AppColors.lightGray, borderRadius: BorderRadius.circular(8)),
                                child: p.image != null && p.image!.isNotEmpty
                                    ? ClipRRect(borderRadius: BorderRadius.circular(8), child: CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.cover))
                                    : const Icon(Icons.shopping_bag, color: AppColors.gray),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [
                                      Expanded(child: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                                      if (p.isOffer)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(4)),
                                          child: const Text('OFERTA', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                                        ),
                                    ]),
                                    const SizedBox(height: 4),
                                    Row(children: [
                                      Text(formatCOP(p.effectivePrice), style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 14)),
                                      if (p.isOffer && p.offerPrice != null) ...[
                                        const SizedBox(width: 6),
                                        Text(formatCOP(p.price), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppColors.gray, fontSize: 12)),
                                      ],
                                      if (p.comparePrice != null && p.comparePrice! > 0 && !p.isOffer) ...[
                                        const SizedBox(width: 6),
                                        Text(formatCOP(p.comparePrice!), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppColors.gray, fontSize: 11)),
                                      ],
                                      const Spacer(),
                                      Text('Stock: ${p.stock.toInt()}', style: TextStyle(color: p.stock <= 0 ? AppColors.error : AppColors.textSecondary, fontSize: 12)),
                                    ]),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: Icon(p.isOffer ? Icons.local_offer : Icons.local_offer_outlined, color: p.isOffer ? AppColors.accent : AppColors.gray, size: 20),
                                tooltip: p.isOffer ? 'Quitar oferta' : 'Marcar como oferta',
                                onPressed: () => _quickToggleOffer(p),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.edit, color: AppColors.primary, size: 20),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
