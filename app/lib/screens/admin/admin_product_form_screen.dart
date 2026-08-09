import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';

class AdminProductFormScreen extends StatefulWidget {
  final int? productId;
  const AdminProductFormScreen({super.key, this.productId});

  @override
  State<AdminProductFormScreen> createState() => _AdminProductFormScreenState();
}

class _AdminProductFormScreenState extends State<AdminProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _comparePriceCtrl = TextEditingController();
  final _stockCtrl = TextEditingController(text: '0');
  final _stockMinCtrl = TextEditingController(text: '0');
  final _skuCtrl = TextEditingController();
  final _barcodeCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _imageCtrl = TextEditingController();
  final _unitCtrl = TextEditingController(text: 'un');
  bool _isOffer = false;
  bool _isActive = true;
  bool _isWeighed = false;
  bool _isLoading = false;
  bool _isSaving = false;
  int? _selectedCategoryId;
  List<Map<String, dynamic>> _categories = [];

  @override
  void initState() {
    super.initState();
    _loadCategories();
    if (widget.productId != null) _loadProduct();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _comparePriceCtrl.dispose();
    _stockCtrl.dispose();
    _stockMinCtrl.dispose();
    _skuCtrl.dispose();
    _barcodeCtrl.dispose();
    _brandCtrl.dispose();
    _imageCtrl.dispose();
    _unitCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final response = await apiService.get(ApiEndpoints.adminCategories);
      final raw = response['data'] ?? response['categories'] ?? response;
      final list = raw is List ? raw : [raw];
      if (mounted) {
        setState(() => _categories = list.cast<Map<String, dynamic>>());
      }
    } catch (_) {}
  }

  Future<void> _loadProduct() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiService.get('/api/products/${widget.productId}');
      final data = response['data'] ?? response;
      if (mounted) {
        setState(() {
          _nameCtrl.text = data['name']?.toString() ?? '';
          _descCtrl.text = data['description']?.toString() ?? '';
          _priceCtrl.text = (data['price'] ?? 0).toString();
          _comparePriceCtrl.text = data['compare_price']?.toString() ?? '';
          _stockCtrl.text = (data['stock'] ?? 0).toString();
          _stockMinCtrl.text = (data['stock_min'] ?? 0).toString();
          _skuCtrl.text = data['sku']?.toString() ?? '';
          _barcodeCtrl.text = data['barcode']?.toString() ?? '';
          _brandCtrl.text = data['brand']?.toString() ?? '';
          _imageCtrl.text = data['image']?.toString() ?? '';
          _unitCtrl.text = data['unit']?.toString() ?? 'un';
          _isOffer = data['is_offer'] == true;
          _isActive = data['is_active'] != false;
          _isWeighed = data['is_weighed'] == true;
          _selectedCategoryId = data['category_id'] as int?;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    try {
      final body = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'price': int.tryParse(_priceCtrl.text) ?? 0,
        'compare_price': _comparePriceCtrl.text.trim().isEmpty ? null : int.tryParse(_comparePriceCtrl.text),
        'stock': int.tryParse(_stockCtrl.text) ?? 0,
        'stock_min': int.tryParse(_stockMinCtrl.text) ?? 0,
        'sku': _skuCtrl.text.trim().isEmpty ? null : _skuCtrl.text.trim(),
        'barcode': _barcodeCtrl.text.trim().isEmpty ? null : _barcodeCtrl.text.trim(),
        'brand': _brandCtrl.text.trim().isEmpty ? null : _brandCtrl.text.trim(),
        'image': _imageCtrl.text.trim().isEmpty ? null : _imageCtrl.text.trim(),
        'unit': _unitCtrl.text.trim(),
        'category_id': _selectedCategoryId,
        'is_offer': _isOffer,
        'is_active': _isActive,
        'is_weighed': _isWeighed,
      };
      if (widget.productId != null) {
        await apiService.put('/api/products/${widget.productId}', body);
      } else {
        await apiService.post('/api/products', body);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(widget.productId != null ? 'Producto actualizado' : 'Producto creado'),
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
      appBar: CustomAppBar(title: widget.productId == null ? 'Nuevo Producto' : 'Editar Producto', showBack: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Form(
              key: _formKey,
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
                          const Text('Información básica', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _nameCtrl,
                            decoration: InputDecoration(labelText: 'Nombre *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Obligatorio' : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _descCtrl,
                            maxLines: 3,
                            decoration: InputDecoration(labelText: 'Descripción', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<int?>(
                            value: _selectedCategoryId,
                            decoration: InputDecoration(labelText: 'Categoría', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            items: [
                              const DropdownMenuItem(value: null, child: Text('Sin categoría')),
                              ..._categories.map((c) => DropdownMenuItem(value: c['id'] as int, child: Text(c['name']?.toString() ?? ''))),
                            ],
                            onChanged: (v) => setState(() => _selectedCategoryId = v),
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
                          const Text('Precios y stock', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          Row(children: [
                            Expanded(
                              child: TextFormField(
                                controller: _priceCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: 'Precio COP *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                                validator: (v) => v == null || v.trim().isEmpty ? 'Obligatorio' : null,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: _comparePriceCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: 'Precio antes', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          Row(children: [
                            Expanded(
                              child: TextFormField(
                                controller: _stockCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: 'Stock', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: _stockMinCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: 'Stock mínimo', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          SwitchListTile(
                            title: const Text('Oferta'),
                            value: _isOffer,
                            onChanged: (v) => setState(() => _isOffer = v),
                            contentPadding: EdgeInsets.zero,
                            activeColor: AppColors.accent,
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
                          const Text('Detalles', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          Row(children: [
                            Expanded(
                              child: TextFormField(
                                controller: _skuCtrl,
                                decoration: InputDecoration(labelText: 'SKU', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: _barcodeCtrl,
                                decoration: InputDecoration(labelText: 'Código barras', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          Row(children: [
                            Expanded(
                              child: TextFormField(
                                controller: _brandCtrl,
                                decoration: InputDecoration(labelText: 'Marca', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: _unitCtrl,
                                decoration: InputDecoration(labelText: 'Unidad', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _imageCtrl,
                            decoration: InputDecoration(labelText: 'URL imagen', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 8),
                          SwitchListTile(
                            title: const Text('Activo'),
                            value: _isActive,
                            onChanged: (v) => setState(() => _isActive = v),
                            contentPadding: EdgeInsets.zero,
                            activeColor: AppColors.primary,
                          ),
                          SwitchListTile(
                            title: const Text('Producto pesado'),
                            value: _isWeighed,
                            onChanged: (v) => setState(() => _isWeighed = v),
                            contentPadding: EdgeInsets.zero,
                            activeColor: AppColors.primary,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _isSaving ? null : _save,
                      icon: _isSaving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save),
                      label: Text(_isSaving ? 'Guardando...' : 'Guardar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }
}
