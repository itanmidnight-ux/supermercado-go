import 'package:flutter/material.dart';
import 'package:flutter_barcode_scanner/flutter_barcode_scanner.dart';
import 'package:provider/provider.dart';
import '../../models/product.dart';
import '../../providers/product_provider.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class AdminBarcodePrintScreen extends StatefulWidget {
  const AdminBarcodePrintScreen({super.key});

  @override
  State<AdminBarcodePrintScreen> createState() => _AdminBarcodePrintScreenState();
}

class _AdminBarcodePrintScreenState extends State<AdminBarcodePrintScreen> {
  List<_PrintItem> _items = [];
  String _search = '';
  bool _isSearching = false;
  List<Product> _searchResults = [];
  int _copies = 1;

  @override
  void initState() {
    super.initState();
    context.read<ProductProvider>().loadProducts();
  }

  Future<void> _scanBarcode() async {
    try {
      final result = await FlutterBarcodeScanner.scanBarcode('#00B860', 'Cancelar', true, ScanMode.BARCODE);
      if (result != '-1' && mounted) {
        final products = context.read<ProductProvider>().products;
        final match = products.where((p) => p.barcode == result).toList();
        if (match.isNotEmpty) {
          _addProduct(match.first);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Código $result no encontrado'), backgroundColor: AppColors.accent),
          );
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al escanear'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _addProduct(Product product) {
    final existing = _items.indexWhere((i) => i.product.id == product.id);
    if (existing >= 0) {
      setState(() => _items[existing].copies += _copies);
    } else {
      setState(() => _items.add(_PrintItem(product: product, copies: _copies)));
    }
  }

  void _removeItem(int index) {
    setState(() => _items.removeAt(index));
  }

  void _showPrintPreview() {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega productos para imprimir'), backgroundColor: AppColors.accent),
      );
      return;
    }
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Vista previa de impresión'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ..._items.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text(item.product.name, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        Text('${item.copies}x', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                      ],
                    ),
                  )),
              const Divider(),
              Text('${_items.length} producto(s), ${_items.fold(0, (s, i) => s + i.copies)} etiqueta(s)', style: const TextStyle(color: AppColors.textSecondary)),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Impresión enviada'), backgroundColor: AppColors.success),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Imprimir'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Imprimir Códigos de Barras', showBack: true),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showPrintPreview,
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.print),
        label: Text('Imprimir (${_items.fold(0, (s, i) => s + i.copies)})'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Buscar producto...',
                      prefixIcon: const Icon(Icons.search),
                      filled: true,
                      fillColor: AppColors.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    onChanged: (v) {
                      setState(() => _search = v.toLowerCase());
                      final pp = context.read<ProductProvider>();
                      setState(() {
                        _searchResults = v.isEmpty
                            ? []
                            : pp.products.where((p) => p.name.toLowerCase().contains(_search) || (p.barcode?.toLowerCase().contains(_search) ?? false)).take(10).toList();
                      });
                    },
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _scanBarcode,
                  icon: const Icon(Icons.qr_code_scanner, color: AppColors.primary),
                  tooltip: 'Escanear código',
                ),
              ],
            ),
          ),
          if (_searchResults.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 200),
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))],
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _searchResults.length,
                itemBuilder: (context, index) {
                  final p = _searchResults[index];
                  return ListTile(
                    dense: true,
                    title: Text(p.name, style: const TextStyle(fontSize: 13)),
                    subtitle: Text('Barcode: ${p.barcode ?? "-"}', style: const TextStyle(fontSize: 11)),
                    trailing: IconButton(icon: const Icon(Icons.add_circle, color: AppColors.primary), onPressed: () => _addProduct(p)),
                  );
                },
              ),
            ),
          if (_items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const Text('Copias por etiqueta:', style: TextStyle(fontSize: 13)),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(border: Border.all(color: AppColors.gray.withOpacity(0.3)), borderRadius: BorderRadius.circular(8)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 18),
                          onPressed: _copies > 1 ? () => setState(() => _copies--) : null,
                          padding: const EdgeInsets.all(4),
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                        Text('$_copies', style: const TextStyle(fontWeight: FontWeight.bold)),
                        IconButton(
                          icon: const Icon(Icons.add, size: 18),
                          onPressed: () => setState(() => _copies++),
                          padding: const EdgeInsets.all(4),
                          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _items.isEmpty
                ? const EmptyState(icon: Icons.barcode_reader, title: 'Sin productos', subtitle: 'Busca o escanea productos para imprimir sus códigos de barras')
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _items.length,
                    itemBuilder: (context, index) {
                      final item = _items[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 6),
                        child: ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                            child: const Icon(Icons.barcode, color: AppColors.primary),
                          ),
                          title: Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text(item.product.barcode ?? 'Sin código', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                            Text('${item.copies}x', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                            IconButton(
                              icon: const Icon(Icons.close, size: 18, color: AppColors.error),
                              onPressed: () => _removeItem(index),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                            ),
                          ]),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _PrintItem {
  final Product product;
  int copies;
  _PrintItem({required this.product, required this.copies});
}
