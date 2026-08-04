import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/product.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<Product> _products = [];
  List<Product> _filteredProducts = [];
  bool _isLoading = true;
  String? _error;
  bool _isAdjusting = false;
  final TextEditingController _searchController = TextEditingController();
  String _statusFilter = 'all';
  int _lowStockCount = 0;

  @override
  void initState() {
    super.initState();
    _loadInventory();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInventory() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.adminInventory);
      final raw = response['data'] ?? response['products'] ?? response;
      final list = raw is List ? raw : [raw];
      final products = list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
      final lowCount = products.where((p) {
        final min = p.stockMin ?? 0;
        return p.stock <= min;
      }).length;
      setState(() {
        _products = products;
        _lowStockCount = lowCount;
        _filteredProducts = products;
        _applyFilters();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar el inventario';
        _isLoading = false;
      });
    }
  }

  void _applyFilters() {
    final query = _searchController.text.toLowerCase().trim();
    setState(() {
      _filteredProducts = _products.where((p) {
        final matchesSearch = query.isEmpty ||
            p.name.toLowerCase().contains(query) ||
            (p.sku?.toLowerCase().contains(query) ?? false);
        String status;
        final min = p.stockMin ?? 0;
        if (p.stock <= 0) {
          status = 'critical';
        } else if (p.stock <= min) {
          status = 'warning';
        } else {
          status = 'ok';
        }
        final matchesStatus = _statusFilter == 'all' || status == _statusFilter;
        return matchesSearch && matchesStatus;
      }).toList();
    });
  }

  String _getStockStatus(Product p) {
    final min = p.stockMin ?? 0;
    if (p.stock <= 0) return 'critical';
    if (p.stock <= min) return 'warning';
    return 'ok';
  }

  Color _getStockColor(String status) {
    switch (status) {
      case 'critical':
        return AppColors.error;
      case 'warning':
        return AppColors.accent;
      default:
        return AppColors.success;
    }
  }

  String _getStockLabel(String status) {
    switch (status) {
      case 'critical':
        return 'Crítico';
      case 'warning':
        return 'Bajo';
      default:
        return 'OK';
    }
  }

  Future<void> _adjustStock(Product product) async {
    final controller = TextEditingController(text: product.stock.toString());
    final reasonController = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('Ajustar stock - ${product.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Stock actual: ${product.stock}'),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: InputDecoration(
                labelText: 'Nuevo stock',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: InputDecoration(
                labelText: 'Razón del ajuste',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
    controller.dispose();
    reasonController.dispose();
    if (result != true) return;
    final newStock = int.tryParse(controller.text);
    if (newStock == null) return;
    setState(() => _isAdjusting = true);
    try {
      await apiService.put('/api/inventory/adjust', {
        'product_id': product.id,
        'new_stock': newStock,
        'reason': reasonController.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Stock actualizado'), backgroundColor: AppColors.success),
        );
        _loadInventory();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isAdjusting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Inventario'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/admin/stock-count'),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.countertops),
        label: const Text('Conteo físico'),
      ),
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
                        onPressed: _loadInventory,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    if (_lowStockCount > 0)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        color: AppColors.error.withOpacity(0.08),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber, color: AppColors.error, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              '$_lowStockCount producto${_lowStockCount > 1 ? "s" : ""} con stock bajo o agotado',
                              style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.w500, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              decoration: InputDecoration(
                                hintText: 'Buscar por nombre o SKU...',
                                prefixIcon: const Icon(Icons.search),
                                filled: true,
                                fillColor: AppColors.surface,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: BorderSide.none,
                                ),
                                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                              ),
                              onChanged: (_) => _applyFilters(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          PopupMenuButton<String>(
                            onSelected: (value) {
                              setState(() => _statusFilter = value);
                              _applyFilters();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.gray.withOpacity(0.3)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.filter_list, size: 18),
                                  const SizedBox(width: 4),
                                  Text(
                                    _statusFilter == 'all' ? 'Todos' : _getStockLabel(_statusFilter),
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                            itemBuilder: (_) => [
                              const PopupMenuItem(value: 'all', child: Text('Todos')),
                              const PopupMenuItem(value: 'ok', child: Text('OK')),
                              const PopupMenuItem(value: 'warning', child: Text('Stock bajo')),
                              const PopupMenuItem(value: 'critical', child: Text('Crítico')),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: _filteredProducts.isEmpty
                          ? EmptyState(
                              icon: Icons.inventory_2_outlined,
                              title: 'Sin productos',
                              subtitle: 'No se encontraron productos con los filtros seleccionados',
                            )
                          : RefreshIndicator(
                              onRefresh: _loadInventory,
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: _filteredProducts.length,
                                itemBuilder: (context, index) => _buildProductRow(_filteredProducts[index]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildProductRow(Product product) {
    final status = _getStockStatus(product);
    final statusColor = _getStockColor(status);
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
                width: 42,
                height: 42,
                child: product.image != null && product.image!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: product.image!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.lightGray,
                          child: const Icon(Icons.shopping_bag, size: 18, color: AppColors.gray),
                        ),
                      )
                    : Container(
                        color: AppColors.lightGray,
                        child: const Icon(Icons.shopping_bag, size: 18, color: AppColors.gray),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(product.sku ?? '-', style: const TextStyle(fontSize: 11, color: AppColors.gray)),
                ],
              ),
            ),
            Text('${product.stock}', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: statusColor)),
            const SizedBox(width: 8),
            Text('mín: ${product.stockMin ?? 0}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(_getStockLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.edit, size: 18),
              tooltip: 'Ajustar stock',
              onPressed: _isAdjusting ? null : () => _adjustStock(product),
              color: AppColors.primary,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          ],
        ),
      ),
    );
  }
}
