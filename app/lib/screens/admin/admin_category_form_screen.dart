import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';

class AdminCategoryFormScreen extends StatefulWidget {
  final int? categoryId;
  const AdminCategoryFormScreen({super.key, this.categoryId});

  @override
  State<AdminCategoryFormScreen> createState() => _AdminCategoryFormScreenState();
}

class _AdminCategoryFormScreenState extends State<AdminCategoryFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _imageCtrl = TextEditingController();
  final _sortCtrl = TextEditingController(text: '0');
  bool _isActive = true;
  bool _isLoading = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.categoryId != null) _loadCategory();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _imageCtrl.dispose();
    _sortCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCategory() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiService.get(ApiEndpoints.adminCategory(widget.categoryId.toString()));
      final data = response['data'] ?? response;
      if (mounted) {
        setState(() {
          _nameCtrl.text = data['name']?.toString() ?? '';
          _descCtrl.text = data['description']?.toString() ?? '';
          _imageCtrl.text = data['image']?.toString() ?? '';
          _sortCtrl.text = (data['sort_order'] ?? 0).toString();
          _isActive = data['is_active'] != false;
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
        'image': _imageCtrl.text.trim().isEmpty ? null : _imageCtrl.text.trim(),
        'sort_order': int.tryParse(_sortCtrl.text) ?? 0,
        'is_active': _isActive,
      };
      if (widget.categoryId != null) {
        await apiService.put(ApiEndpoints.adminCategory(widget.categoryId.toString()), body);
      } else {
        await apiService.post(ApiEndpoints.adminCategories, body);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(widget.categoryId != null ? 'Categoría actualizada' : 'Categoría creada'),
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
      appBar: CustomAppBar(title: widget.categoryId == null ? 'Nueva Categoría' : 'Editar Categoría', showBack: true),
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
                          const Text('Datos de la categoría', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
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
                          TextFormField(
                            controller: _imageCtrl,
                            decoration: InputDecoration(labelText: 'URL de imagen', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _sortCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(labelText: 'Orden', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 8),
                          SwitchListTile(
                            title: const Text('Activo'),
                            value: _isActive,
                            onChanged: (v) => setState(() => _isActive = v),
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
                ],
              ),
            ),
    );
  }
}
