import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/order_item.dart';
import '../../models/product.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class SubstitutionScreen extends StatefulWidget {
  final int orderId;
  final OrderItem item;

  const SubstitutionScreen({
    super.key,
    required this.orderId,
    required this.item,
  });

  @override
  State<SubstitutionScreen> createState() => _SubstitutionScreenState();
}

class _SubstitutionScreenState extends State<SubstitutionScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Product> _searchResults = [];
  bool _isSearching = false;
  String? _error;
  bool _isSubmitting = false;
  Product? _selectedSubstitute;
  double _substituteQty = 1;

  @override
  void initState() {
    super.initState();
    _substituteQty = widget.item.qty;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchProducts(String query) async {
    if (query.length < 2) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _isSearching = true);
    try {
      final response = await apiService.get(
        ApiEndpoints.products,
        queryParams: {'search': query, 'limit': '20'},
      );
      final raw = response['data'] ?? response['products'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _searchResults = list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
        _isSearching = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isSearching = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al buscar productos';
        _isSearching = false;
      });
    }
  }

  void _selectSubstitute(Product product) {
    setState(() => _selectedSubstitute = product);
    _showQtyDialog();
  }

  void _showQtyDialog() {
    final controller = TextEditingController(text: _substituteQty.toStringAsFixed(0));
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Cantidad de sustituto'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_selectedSubstitute!.name, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              autofocus: true,
              decoration: InputDecoration(
                labelText: 'Cantidad',
                suffixText: widget.item.unit ?? 'un',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              final qty = double.tryParse(controller.text) ?? 1;
              Navigator.pop(ctx);
              _confirmSubstitution(qty);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmSubstitution(double qty) async {
    if (_selectedSubstitute == null || widget.item.id == null) return;
    setState(() => _isSubmitting = true);
    try {
      await apiService.post(
        ApiEndpoints.workerSubstitute(
          widget.orderId.toString(),
          widget.item.id.toString(),
        ),
        {
          'substitute_product_id': _selectedSubstitute!.id,
          'qty': qty,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sustitución registrada correctamente'),
            backgroundColor: AppColors.success,
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al registrar sustitución'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _markAsMissing() async {
    if (widget.item.id == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Marcar como faltante'),
        content: Text('¿Marcar "${widget.item.productName}" como faltante? El cliente será notificado.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Marcar faltante'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isSubmitting = true);
    try {
      await apiService.post(
        ApiEndpoints.workerMarkMissing(
          widget.orderId.toString(),
          widget.item.id.toString(),
        ),
        {},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Producto marcado como faltante'),
            backgroundColor: AppColors.accent,
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al marcar faltante'), backgroundColor: AppColors.error),
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
      appBar: AppBar(
        title: const Text('Sustitución de producto'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Column(
        children: [
          _buildMissingProductCard(),
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar producto sustituto...',
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
              onChanged: (query) => _searchProducts(query),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
            ),
          Expanded(child: _buildSearchResults()),
        ],
      ),
      bottomNavigationBar: _isSubmitting
          ? const SafeArea(
              child: LinearProgressIndicator(color: AppColors.primary),
            )
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton.icon(
                  onPressed: _markAsMissing,
                  icon: const Icon(Icons.remove_shopping_cart),
                  label: const Text('Marcar como faltante'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildMissingProductCard() {
    final item = widget.item;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.error.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: item.image != null && item.image!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(item.image!, fit: BoxFit.cover, errorBuilder: (_, __, ___) =>
                        const Icon(Icons.warning_amber, color: AppColors.error)),
                  )
                : const Icon(Icons.warning_amber, color: AppColors.error),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Producto faltante', style: TextStyle(color: AppColors.error, fontSize: 11, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                Text(
                  '${item.qty.round()} ${item.unit ?? "un"} × ${formatCOP(item.unitPrice)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_searchController.text.length < 2) {
      return const Center(
        child: Text(
          'Escribe al menos 2 caracteres para buscar',
          style: TextStyle(color: AppColors.gray),
        ),
      );
    }
    if (_isSearching) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }
    if (_searchResults.isEmpty) {
      return const Center(
        child: Text(
          'No se encontraron productos',
          style: TextStyle(color: AppColors.gray),
        ),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      itemCount: _searchResults.length,
      itemBuilder: (context, index) {
        final product = _searchResults[index];
        return _buildProductCard(product);
      },
    );
  }

  Widget _buildProductCard(Product product) {
    return GestureDetector(
      onTap: () => _selectSubstitute(product),
      child: Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppColors.lightGray,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: product.image != null && product.image!.isNotEmpty
                    ? ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                        child: CachedNetworkImage(
                          imageUrl: product.image!,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => const Center(
                            child: Icon(Icons.shopping_bag, color: AppColors.gray, size: 36),
                          ),
                        ),
                      )
                    : const Center(
                        child: Icon(Icons.shopping_bag, color: AppColors.gray, size: 36),
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatCOP(product.effectivePrice),
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 13),
                  ),
                  Text(
                    'Stock: ${product.stock}',
                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
