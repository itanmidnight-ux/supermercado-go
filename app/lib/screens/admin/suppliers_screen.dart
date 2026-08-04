import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  List<Map<String, dynamic>> _suppliers = [];
  bool _isLoading = true;
  String? _error;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSuppliers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadSuppliers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.adminSuppliers);
      final raw = response['data'] ?? response['suppliers'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _suppliers = list.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar proveedores';
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredSuppliers {
    final query = _searchController.text.toLowerCase().trim();
    if (query.isEmpty) return _suppliers;
    return _suppliers.where((s) {
      final name = (s['name'] as String? ?? '').toLowerCase();
      final nit = (s['nit'] as String? ?? '').toLowerCase();
      final phone = (s['phone'] as String? ?? '').toLowerCase();
      return name.contains(query) || nit.contains(query) || phone.contains(query);
    }).toList();
  }

  void _showForm({Map<String, dynamic>? supplier}) {
    final nameController = TextEditingController(text: supplier?['name'] as String? ?? '');
    final nitController = TextEditingController(text: supplier?['nit'] as String? ?? '');
    final phoneController = TextEditingController(text: supplier?['phone'] as String? ?? '');
    final emailController = TextEditingController(text: supplier?['email'] as String? ?? '');
    final addressController = TextEditingController(text: supplier?['address'] as String? ?? '');
    final isEdit = supplier != null;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text(isEdit ? 'Editar proveedor' : 'Nuevo proveedor'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: 'Nombre *',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nitController,
                decoration: InputDecoration(
                  labelText: 'NIT',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Teléfono',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressController,
                decoration: InputDecoration(
                  labelText: 'Dirección',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              nameController.dispose();
              nitController.dispose();
              phoneController.dispose();
              emailController.dispose();
              addressController.dispose();
              Navigator.pop(ctx);
            },
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('El nombre es obligatorio'), backgroundColor: AppColors.error),
                );
                return;
              }
              Navigator.pop(ctx);
              await _saveSupplier(
                isEdit: isEdit,
                id: supplier?['id'] as int?,
                data: {
                  'name': nameController.text.trim(),
                  'nit': nitController.text.trim(),
                  'phone': phoneController.text.trim(),
                  'email': emailController.text.trim(),
                  'address': addressController.text.trim(),
                },
              );
              nameController.dispose();
              nitController.dispose();
              phoneController.dispose();
              emailController.dispose();
              addressController.dispose();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text(isEdit ? 'Guardar' : 'Crear'),
          ),
        ],
      ),
    );
  }

  Future<void> _saveSupplier({required bool isEdit, int? id, required Map<String, dynamic> data}) async {
    try {
      if (isEdit && id != null) {
        await apiService.put(ApiEndpoints.adminSupplier(id.toString()), data);
      } else {
        await apiService.post(ApiEndpoints.adminSuppliers, data);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEdit ? 'Proveedor actualizado' : 'Proveedor creado'),
            backgroundColor: AppColors.success,
          ),
        );
        _loadSuppliers();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _deleteSupplier(int id, String name) async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Eliminar proveedor'),
        content: Text('¿Estás seguro de eliminar "$name"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await apiService.delete(ApiEndpoints.adminSupplier(id.toString()));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Proveedor eliminado'), backgroundColor: AppColors.success),
        );
        _loadSuppliers();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Proveedores'),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showForm(),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add),
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
                        onPressed: _loadSuppliers,
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
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Buscar proveedor...',
                          prefixIcon: const Icon(Icons.search),
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(vertical: 0),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    Expanded(
                      child: _filteredSuppliers.isEmpty
                          ? EmptyState(
                              icon: Icons.business_outlined,
                              title: 'Sin proveedores',
                              subtitle: _searchController.text.isNotEmpty
                                  ? 'No se encontraron resultados'
                                  : 'Agrega tu primer proveedor',
                            )
                          : RefreshIndicator(
                              onRefresh: _loadSuppliers,
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: _filteredSuppliers.length,
                                itemBuilder: (context, index) => _buildSupplierCard(_filteredSuppliers[index]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildSupplierCard(Map<String, dynamic> supplier) {
    final isActive = supplier['is_active'] as bool? ?? true;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => _showForm(supplier: supplier),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primary.withOpacity(0.1) : AppColors.lightGray,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.business, color: isActive ? AppColors.primary : AppColors.gray),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            supplier['name'] as String? ?? 'Sin nombre',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (isActive)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.success.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text('Activo', style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.w600)),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.gray.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text('Inactivo', style: TextStyle(color: AppColors.gray, fontSize: 11, fontWeight: FontWeight.w600)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (supplier['nit'] != null)
                      Text('NIT: ${supplier['nit']}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    if (supplier['phone'] != null)
                      Text('Tel: ${supplier['phone']}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.gray),
            ],
          ),
        ),
      ),
    );
  }
}
