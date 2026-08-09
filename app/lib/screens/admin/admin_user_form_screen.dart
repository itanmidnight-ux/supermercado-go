import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';

class AdminUserFormScreen extends StatefulWidget {
  final int? userId;
  const AdminUserFormScreen({super.key, this.userId});

  @override
  State<AdminUserFormScreen> createState() => _AdminUserFormScreenState();
}

class _AdminUserFormScreenState extends State<AdminUserFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  String _role = 'client';
  bool _isActive = true;
  bool _isLoading = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.userId != null) _loadUser();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUser() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiService.get(ApiEndpoints.adminUser(widget.userId.toString()));
      final data = response['data'] ?? response;
      if (mounted) {
        setState(() {
          _nameCtrl.text = data['name']?.toString() ?? '';
          _emailCtrl.text = data['email']?.toString() ?? '';
          _phoneCtrl.text = data['phone']?.toString() ?? '';
          _role = data['role']?.toString() ?? 'client';
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
        'email': _emailCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'role': _role,
        'is_active': _isActive,
      };
      if (_passwordCtrl.text.isNotEmpty) {
        body['password'] = _passwordCtrl.text;
      }
      if (widget.userId != null) {
        await apiService.put(ApiEndpoints.adminUser(widget.userId.toString()), body);
      } else {
        await apiService.post(ApiEndpoints.adminUsers, body);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(widget.userId != null ? 'Usuario actualizado' : 'Usuario creado'),
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
      appBar: CustomAppBar(title: widget.userId == null ? 'Nuevo Usuario' : 'Editar Usuario', showBack: true),
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
                          const Text('Datos del usuario', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _nameCtrl,
                            decoration: InputDecoration(labelText: 'Nombre *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Obligatorio' : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            decoration: InputDecoration(labelText: 'Email *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            validator: (v) {
                              if (v == null || v.trim().isEmpty) return 'Obligatorio';
                              if (!v.contains('@')) return 'Email inválido';
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _phoneCtrl,
                            keyboardType: TextInputType.phone,
                            decoration: InputDecoration(labelText: 'Teléfono', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          if (widget.userId == null)
                            TextFormField(
                              controller: _passwordCtrl,
                              obscureText: true,
                              decoration: InputDecoration(labelText: 'Contraseña *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                              validator: (v) {
                                if (widget.userId == null && (v == null || v.isEmpty)) return 'Obligatorio';
                                return null;
                              },
                            )
                          else
                            TextFormField(
                              controller: _passwordCtrl,
                              obscureText: true,
                              decoration: InputDecoration(labelText: 'Nueva contraseña (dejar vacío para mantener)', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            value: _role,
                            decoration: InputDecoration(labelText: 'Rol', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            items: const [
                              DropdownMenuItem(value: 'client', child: Text('Cliente')),
                              DropdownMenuItem(value: 'worker', child: Text('Repartidor')),
                              DropdownMenuItem(value: 'admin', child: Text('Administrador')),
                            ],
                            onChanged: (v) => setState(() => _role = v ?? 'client'),
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
