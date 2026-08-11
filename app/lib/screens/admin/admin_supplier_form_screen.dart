import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';

class AdminSupplierFormScreen extends StatefulWidget {
  final int? supplierId;
  const AdminSupplierFormScreen({super.key, this.supplierId});

  @override
  State<AdminSupplierFormScreen> createState() => _AdminSupplierFormScreenState();
}

class _AdminSupplierFormScreenState extends State<AdminSupplierFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _nitCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _contactPersonCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _isActive = true;
  bool _isLoading = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.supplierId != null) _loadSupplier();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _nitCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _contactPersonCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSupplier() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiService.get(ApiEndpoints.adminSupplier(widget.supplierId.toString()));
      final data = response['data'] ?? response;
      if (mounted) {
        setState(() {
          _nameCtrl.text = data['name']?.toString() ?? '';
          _nitCtrl.text = data['nit']?.toString() ?? '';
          _phoneCtrl.text = data['phone']?.toString() ?? '';
          _emailCtrl.text = data['email']?.toString() ?? '';
          _addressCtrl.text = data['address']?.toString() ?? '';
          _contactPersonCtrl.text = data['contact_person']?.toString() ?? '';
          _notesCtrl.text = data['notes']?.toString() ?? '';
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
        'nit': _nitCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'contact_person': _contactPersonCtrl.text.trim(),
        'notes': _notesCtrl.text.trim(),
        'is_active': _isActive,
      };
      if (widget.supplierId != null) {
        await apiService.put(ApiEndpoints.adminSupplier(widget.supplierId.toString()), body);
      } else {
        await apiService.post(ApiEndpoints.adminSuppliers, body);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(widget.supplierId != null ? 'Proveedor actualizado' : 'Proveedor creado'),
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
      appBar: CustomAppBar(title: widget.supplierId == null ? 'Nuevo Proveedor' : 'Editar Proveedor', showBack: true),
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
                          const Text('Datos del proveedor', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _nameCtrl,
                            decoration: InputDecoration(labelText: 'Nombre *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Obligatorio' : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _nitCtrl,
                            decoration: InputDecoration(labelText: 'NIT', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          Row(children: [
                            Expanded(
                              child: TextFormField(
                                controller: _phoneCtrl,
                                keyboardType: TextInputType.phone,
                                decoration: InputDecoration(labelText: 'Teléfono', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: _emailCtrl,
                                keyboardType: TextInputType.emailAddress,
                                decoration: InputDecoration(labelText: 'Email', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _addressCtrl,
                            decoration: InputDecoration(labelText: 'Dirección', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _contactPersonCtrl,
                            decoration: InputDecoration(labelText: 'Persona de contacto', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _notesCtrl,
                            maxLines: 3,
                            decoration: InputDecoration(labelText: 'Notas', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
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
