import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/product.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';

class CountItem {
  final Product product;
  int systemStock;
  int countedStock;

  CountItem({
    required this.product,
    required this.systemStock,
    this.countedStock = 0,
  });

  int get difference => countedStock - systemStock;
  bool get isMatch => difference == 0;
}

class StockCountScreen extends StatefulWidget {
  const StockCountScreen({super.key});

  @override
  State<StockCountScreen> createState() => _StockCountScreenState();
}

class _StockCountScreenState extends State<StockCountScreen> {
  List<CountItem> _items = [];
  bool _isLoading = false;
  bool _isSubmitting = false;
  String? _error;
  final TextEditingController _searchController = TextEditingController();
  List<Product> _searchResults = [];
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.adminInventory);
      final raw = response['data'] ?? response['products'] ?? response;
      final list = raw is List ? raw : [raw];
      final products = list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
      setState(() {
        _items = products.map((p) => CountItem(product: p, systemStock: p.stock)).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar productos';
        _isLoading = false;
      });
    }
  }

  Future<void> _searchForAdd(String query) async {
    if (query.length < 2) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _isSearching = true);
    try {
      final response = await apiService.get(
        ApiEndpoints.products,
        queryParams: {'search': query, 'limit': '10'},
      );
      final raw = response['data'] ?? response['products'] ?? response;
      final list = raw is List ? raw : [raw];
      final existingIds = _items.map((i) => i.product.id).toSet();
      setState(() {
        _searchResults = list
            .map((e) => Product.fromJson(e as Map<String, dynamic>))
            .where((p) => !existingIds.contains(p.id))
            .toList();
        _isSearching = false;
      });
    } catch (e) {
      setState(() => _isSearching = false);
    }
  }

  void _addProduct(Product product) {
    setState(() {
      _items.add(CountItem(product: product, systemStock: product.stock));
      _searchResults = [];
      _searchController.clear();
    });
  }

  void _removeItem(int index) {
    setState(() => _items.removeAt(index));
  }

  Future<void> _saveCount() async {
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay productos para contar'), backgroundColor: AppColors.accent),
      );
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      final countData = _items.map((item) => {
        return {
          'product_id': item.product.id,
          'system_stock': item.systemStock,
          'counted_stock': item.countedStock,
          'difference': item.difference,
        };
      }).toList();

      await apiService.post(ApiEndpoints.adminStockCount, {
        'items': countData,
      });

      if (mounted) {
        final allMatch = _items.every((i) => i.isMatch);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              allMatch
                  ? 'Cuadre perfecto. Inventario coincide al 100%'
                  : 'Conteo guardado. Se encontraron diferencias.',
            ),
            backgroundColor: allMatch ? AppColors.success : AppColors.accent,
          ),
        );
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Conteo físico', showBack: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadProducts,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              decoration: InputDecoration(
                                hintText: 'Buscar y agregar producto...',
                                prefixIcon: const Icon(Icons.search),
                                filled: true,
                                fillColor: AppColors.surface,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: BorderSide.none,
                                ),
                                suffixIcon: _isSearching
                                    ? const Padding(
                                        padding: EdgeInsets.all(12),
                                        child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                                      )
                                    : null,
                              ),
                              onChanged: _searchForAdd,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_searchResults.isNotEmpty)
                      Container(
                        height: 200,
                        margin: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2)),
                          ],
                        ),
                        child: ListView.builder(
                          itemCount: _searchResults.length,
                          itemBuilder: (context, index) {
                            final p = _searchResults[index];
                            return ListTile(
                              dense: true,
                              title: Text(p.name, style: const TextStyle(fontSize: 13)),
                              subtitle: Text('Stock: ${p.stock} | SKU: ${p.sku ?? "-"}', style: const TextStyle(fontSize: 11)),
                              trailing: IconButton(
                                icon: const Icon(Icons.add_circle, color: AppColors.primary),
                                onPressed: () => _addProduct(p),
                              ),
                            );
                          },
                        ),
                      ),
                    if (_items.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Row(
                          children: [
                            Text('${_items.length} producto${_items.length > 1 ? "s" : ""}'),
                            const Spacer(),
                            Text(
                              '${_items.where((i) => i.isMatch).length}/${_items.length} coinciden',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    Expanded(child: _buildItemsList()),
                    _buildBottomBar(),
                  ],
                ),
    );
  }

  Widget _buildItemsList() {
    if (_items.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.countertops, size: 64, color: AppColors.gray),
            SizedBox(height: 16),
            Text('Agrega productos para iniciar el conteo', style: TextStyle(color: AppColors.gray)),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _items.length,
      itemBuilder: (context, index) {
        final item = _items[index];
        return _buildCountRow(item, index);
      },
    );
  }

  Widget _buildCountRow(CountItem item, int index) {
    final diff = item.difference;
    final diffColor = diff == 0 ? AppColors.success : diff > 0 ? AppColors.accent : AppColors.error;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 6),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                width: 38,
                height: 38,
                child: item.product.image != null && item.product.image!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: item.product.image!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                            color: AppColors.lightGray,
                            child: const Icon(Icons.shopping_bag, size: 16, color: AppColors.gray)),
                      )
                    : Container(
                        color: AppColors.lightGray,
                        child: const Icon(Icons.shopping_bag, size: 16, color: AppColors.gray),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('SKU: ${item.product.sku ?? "-"}', style: const TextStyle(fontSize: 11, color: AppColors.gray)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('Sistema', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                Text('${item.systemStock}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              ],
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 60,
              child: TextField(
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                decoration: InputDecoration(
                  labelText: 'Contado',
                  labelStyle: const TextStyle(fontSize: 10),
                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                  isDense: true,
                ),
                onChanged: (val) {
                  setState(() {
                    _items[index].countedStock = int.tryParse(val) ?? 0;
                  });
                },
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('Dif.', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                Text(
                  '${diff >= 0 ? "+" : ""}$diff',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: diffColor),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 16, color: AppColors.error),
              onPressed: () => _removeItem(index),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), offset: const Offset(0, -2), blurRadius: 8)],
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton.icon(
            onPressed: _isSubmitting ? null : _saveCount,
            icon: _isSubmitting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.save),
            label: Text(_isSubmitting ? 'Guardando...' : 'Guardar conteo'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ),
    );
  }
}
