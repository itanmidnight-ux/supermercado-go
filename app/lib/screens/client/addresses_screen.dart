import 'package:flutter/material.dart';
import '../../models/address.dart';
import '../../services/api_service.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/confirm_dialog.dart';
import '../../utils/constants.dart';

class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<Address> _addresses = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.addresses);
      final data = response['data'] ?? response['addresses'] ?? response;
      List<Address> parsed = [];
      if (data is List) {
        parsed = data.map((e) => Address.fromJson(e as Map<String, dynamic>)).toList();
      }
      setState(() {
        _addresses = parsed;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar direcciones';
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteAddress(Address address) async {
    final confirmed = await ConfirmDialog.show(
      context: context,
      title: 'Eliminar dirección',
      message: '¿Estás seguro de eliminar la dirección "${address.label}"?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      isDangerous: true,
    );
    if (!confirmed) return;

    try {
      await apiService.delete(ApiEndpoints.address(address.id.toString()));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Dirección eliminada'), backgroundColor: AppColors.primary),
      );
      _loadAddresses();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al eliminar dirección'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _setDefault(Address address) async {
    if (address.isDefault) return;
    try {
      await apiService.put(ApiEndpoints.address(address.id.toString()), {
        'is_default': true,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Dirección predeterminada actualizada'), backgroundColor: AppColors.primary),
      );
      _loadAddresses();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _navigateToAdd() async {
    final result = await Navigator.pushNamed(context, '/address/edit');
    if (result == true) {
      _loadAddresses();
    }
  }

  void _navigateToEdit(Address address) async {
    final result = await Navigator.pushNamed(context, '/address/edit', arguments: address);
    if (result == true) {
      _loadAddresses();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mis direcciones'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
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
                        onPressed: _loadAddresses,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _addresses.isEmpty
                  ? EmptyState(
                      icon: Icons.location_off_outlined,
                      title: 'Sin direcciones',
                      subtitle: 'Agrega una dirección para recibir tus pedidos en la puerta de tu casa.',
                      buttonText: 'Agregar dirección',
                      onButtonPressed: _navigateToAdd,
                    )
                  : RefreshIndicator(
                      onRefresh: _loadAddresses,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _addresses.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final address = _addresses[index];
                          return Dismissible(
                            key: ValueKey(address.id),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              margin: const EdgeInsets.symmetric(vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.delete, color: Colors.white),
                            ),
                            confirmDismiss: (_) async {
                              return await ConfirmDialog.show(
                                context: context,
                                title: 'Eliminar dirección',
                                message: '¿Eliminar "${address.label}"?',
                                confirmText: 'Eliminar',
                                isDangerous: true,
                              );
                            },
                            onDismissed: (_) => _deleteAddress(address),
                            child: _buildAddressCard(address),
                          );
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton(
        onPressed: _navigateToAdd,
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add_location_alt, color: Colors.white),
      ),
    );
  }

  Widget _buildAddressCard(Address address) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () => _navigateToEdit(address),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  address.isDefault ? Icons.home : Icons.location_on_outlined,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          address.label,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (address.isDefault) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              'Predeterminada',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      address.address,
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (address.neighborhood != null && address.neighborhood!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        address.neighborhood!,
                        style: const TextStyle(fontSize: 12, color: AppColors.gray),
                      ),
                    ],
                  ],
                ),
              ),
              if (!address.isDefault)
                PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'default') _setDefault(address);
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 'default', child: Text('Establecer como predeterminada')),
                  ],
                  icon: const Icon(Icons.more_vert, color: AppColors.gray),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
