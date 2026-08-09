import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';

class AdminPurchaseFormScreen extends StatefulWidget {
  final int? purchaseId;
  const AdminPurchaseFormScreen({super.key, this.purchaseId});

  @override
  State<AdminPurchaseFormScreen> createState() => _AdminPurchaseFormScreenState();
}

class _AdminPurchaseFormScreenState extends State<AdminPurchaseFormScreen> {
  final _formKey = GlobalKey<FormState>();
  int? _selectedSupplierId;
  List<Map<String, dynamic>> _suppliers = [];
  List<_PurchaseItem> _items = [];
  final _notesCtrl = TextEditingController();
  bool _isLoading = false;
  bool _isSaving = false;
  String _searchProduct = '';
  List<Map<String, dynamic>> _productResults = [];
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _loadSuppliers();
    if (widget.purchaseId != null) _loadPurchase();
  }

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSuppliers() async {
    try {
      final response = await apiService.get(ApiEndpoints.adminSuppliers);
      final raw = response['data'] ?? response['suppliers'] ?? response;
      final list = raw is List ? raw : [raw];
      if (mounted) setState(() => _suppliers = list.cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _loadPurchase() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiService.get('${ApiEndpoints.adminPurchases}/${widget.purchaseId}');
      final data = response['data'] ?? response;
      final itemsRaw = data['items'] as List? ?? [];
      if (mounted) {
        setState(() {
          _selectedSupplierId = data['supplier_id'] as int?;
          _notesCtrl.text = data['notes']?.toString() ?? '';
          _items = itemsRaw.map((e) => _PurchaseItem(
                productId: e['product_id'] as int,
                productName: e['product_name']?.toString() ?? '',
                qty: (e['qty'] as num?)?.toInt() ?? 0,
                unitCost: (e['unit_cost'] as num?)?.toInt() ?? 0,
              )).toList();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _searchProducts(String query) async {
    if (query.length < 2) {
      setState(() => _productResults = []);
      return;
    }
    setState(() => _isSearching = true);
    try {
      final response = await apiService.get(ApiEndpoints.products, queryParams: {'search': query, 'limit': '10'});
      final raw = response['data'] ?? response['products'] ?? response;
      final list = raw is List ? raw : [raw];
      if (mounted) {
        setState(() {
          _productResults = list.cast<Map<String, dynamic>>();
          _isSearching = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  void _addProduct(Map<String, dynamic> product) {
    setState(() {
      _items.add(_PurchaseItem(
        productId: product['id'] as int,
        productName: product['name']?.toString() ?? '',
        qty: 1,
        unitCost: (product['cost'] as num?)?.toInt() ?? 0,
      ));
      _productResults = [];
      _searchProduct = '';
    });
  }

  void _removeItem(int index) {
    setState(() => _items.removeAt(index));
  }

  int get _totalCost => _items.fold(0, (sum, item) => sum + (item.qty * item.unitCost));

  Future<void> _save() async {
    if (_selectedSupplierId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona un proveedor'), backgroundColor: AppColors.error),
      );
      return;
    }
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agrega al menos un producto'), backgroundColor: AppColors.error),
      );
      return;
    }
    setState(() => _isSaving = true);
    try {
      final body = <String, dynamic>{
        'supplier_id': _selectedSupplierId,
        'notes': _notesCtrl.text.trim(),
        'items': _items.map((item) => {
          'product_id': item.productId,
          'qty': item.qty,
          'unit_cost': item.unitCost,
        }).toList(),
      };
      if (widget.purchaseId != null) {
        await apiService.put('${ApiEndpoints.adminPurchases}/${widget.purchaseId}', body);
      } else {
        await apiService.post(ApiEndpoints.adminPurchases, body);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(widget.purchaseId != null ? 'Compra actualizada' : 'Compra creada'),
          backgroundColor: AppColors.success,
        ));
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(title: widget.purchaseId == null ? 'Nueva Compra' : 'Editar Compra', showBack: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Form(
              key: _formKey,
              child: Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Card(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Proveedor', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 12),
                                DropdownButtonFormField<int>(
                                  value: _selectedSupplierId,
                                  decoration: InputDecoration(labelText: 'Proveedor *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                                  items: _suppliers.map((s) => DropdownMenuItem(value: s['id'] as int, child: Text(s['name']?.toString() ?? ''))).toList(),
                                  onChanged: (v) => setState(() => _selectedSupplierId = v),
                                ),
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _notesCtrl,
                                  maxLines: 2,
                                  decoration: InputDecoration(labelText: 'Notas', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Card(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Productos', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 12),
                                TextField(
                                  decoration: InputDecoration(
                                    hintText: 'Buscar producto para agregar...',
                                    prefixIcon: const Icon(Icons.search),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    suffixIcon: _isSearching ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))) : null,
                                  ),
                                  onChanged: _searchProducts,
                                ),
                                if (_productResults.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    constraints: const BoxConstraints(maxHeight: 150),
                                    decoration: BoxDecoration(border: Border.all(color: AppColors.gray.withOpacity(0.3)), borderRadius: BorderRadius.circular(8)),
                                    child: ListView.builder(
                                      shrinkWrap: true,
                                      itemCount: _productResults.length,
                                      itemBuilder: (context, index) {
                                        final p = _productResults[index];
                                        return ListTile(
                                          dense: true,
                                          title: Text(p['name']?.toString() ?? '', style: const TextStyle(fontSize: 13)),
                                          subtitle: Text('Costo: ${formatCOP((p['cost'] as num?)?.toInt() ?? 0)}', style: const TextStyle(fontSize: 11)),
                                          trailing: IconButton(icon: const Icon(Icons.add_circle, color: AppColors.primary), onPressed: () => _addProduct(p)),
                                        );
                                      },
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                if (_items.isEmpty)
                                  const Center(child: Padding(padding: EdgeInsets.all(20), child: Text('No hay productos agregados', style: TextStyle(color: AppColors.gray))))
                                else
                                  ..._items.asMap().entries.map((entry) {
                                    final idx = entry.key;
                                    final item = entry.value;
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: 8),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            flex: 3,
                                            child: Text(item.productName, style: const TextStyle(fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                                          ),
                                          SizedBox(
                                            width: 60,
                                            child: TextField(
                                              keyboardType: TextInputType.number,
                                              textAlign: TextAlign.center,
                                              decoration: InputDecoration(isDense: true, contentPadding: const EdgeInsets.symmetric(vertical: 8), border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)), labelText: 'Cant.', labelStyle: const TextStyle(fontSize: 10)),
                                              onChanged: (v) => setState(() => item.qty = int.tryParse(v) ?? 0),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          SizedBox(
                                            width: 80,
                                            child: TextField(
                                              keyboardType: TextInputType.number,
                                              textAlign: TextAlign.center,
                                              decoration: InputDecoration(isDense: true, contentPadding: const EdgeInsets.symmetric(vertical: 8), border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)), labelText: 'Costo', labelStyle: const TextStyle(fontSize: 10)),
                                              onChanged: (v) => setState(() => item.unitCost = int.tryParse(v) ?? 0),
                                            ),
                                          ),
                                          IconButton(
                                            icon: const Icon(Icons.close, size: 18, color: AppColors.error),
                                            onPressed: () => _removeItem(idx),
                                            padding: EdgeInsets.zero,
                                            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), offset: const Offset(0, -2), blurRadius: 8)],
                    ),
                    child: SafeArea(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Total:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                              Text(formatCOP(_totalCost), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary)),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton.icon(
                              onPressed: _isSaving ? null : _save,
                              icon: _isSaving
                                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : const Icon(Icons.save),
                              label: Text(_isSaving ? 'Guardando...' : 'Guardar compra'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _PurchaseItem {
  final int productId;
  final String productName;
  int qty;
  int unitCost;

  _PurchaseItem({required this.productId, required this.productName, required this.qty, required this.unitCost});
}
