import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class AdminOrdersScreen extends StatefulWidget {
  const AdminOrdersScreen({super.key});

  @override
  State<AdminOrdersScreen> createState() => _AdminOrdersScreenState();
}

class _AdminOrdersScreenState extends State<AdminOrdersScreen> {
  List<Map<String, dynamic>> _orders = [];
  bool _isLoading = true;
  String? _error;
  String _statusFilter = 'all';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{};
      if (_statusFilter != 'all') queryParams['status'] = _statusFilter;
      final response = await apiService.get(ApiEndpoints.adminOrders, queryParams: queryParams);
      final raw = response['data'] ?? response['orders'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _orders = list.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar pedidos';
        _isLoading = false;
      });
    }
  }

  Color _getStatusColor(String status) {
    return getOrderStatusColor(status);
  }

  String _getStatusLabel(String status) {
    return AppStrings.orderStatuses[status] ?? status;
  }

  List<Map<String, dynamic>> get _filteredOrders {
    final query = _searchController.text.toLowerCase().trim();
    return _orders.where((o) {
      final matchSearch = query.isEmpty ||
          (o['id']?.toString().contains(query) ?? false) ||
          (o['client_name']?.toString().toLowerCase().contains(query) ?? false);
      final matchStatus = _statusFilter == 'all' || (o['status'] ?? '') == _statusFilter;
      return matchSearch && matchStatus;
    }).toList();
  }

  Future<void> _updateStatus(Map<String, dynamic> order, String newStatus) async {
    try {
      await apiService.put(ApiEndpoints.adminOrder(order['id'].toString()), {'status': newStatus});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Estado cambiado a ${_getStatusLabel(newStatus)}'),
          backgroundColor: AppColors.success,
        ));
        _loadOrders();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
      }
    }
  }

  void _showStatusDialog(Map<String, dynamic> order) {
    final currentStatus = order['status'] as String? ?? 'pending';
    final nextStatuses = <String, String>{
      'pending': 'confirmed',
      'confirmed': 'preparing',
      'preparing': 'ready',
      'ready': 'assigned',
      'assigned': 'in_transit',
      'in_transit': 'delivered',
    };
    final next = nextStatuses[currentStatus];
    if (next == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Este pedido no puede cambiar de estado'), backgroundColor: AppColors.accent),
      );
      return;
    }
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Cambiar estado'),
        content: Text('¿Cambiar estado de "${_getStatusLabel(currentStatus)}" a "${_getStatusLabel(next)}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _updateStatus(order, next);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Pedidos'),
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
                        onPressed: _loadOrders,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    _buildFilterBar(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Buscar por ID o cliente...',
                          prefixIcon: const Icon(Icons.search),
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(vertical: 0),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    Expanded(
                      child: _filteredOrders.isEmpty
                          ? EmptyState(icon: Icons.local_shipping_outlined, title: 'Sin pedidos', subtitle: 'No hay pedidos para los filtros seleccionados')
                          : RefreshIndicator(
                              onRefresh: _loadOrders,
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: _filteredOrders.length,
                                itemBuilder: (context, index) => _buildOrderCard(_filteredOrders[index]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.surface,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildChip('Todos', 'all'),
            const SizedBox(width: 6),
            _buildChip('Pendientes', 'pending'),
            const SizedBox(width: 6),
            _buildChip('Confirmados', 'confirmed'),
            const SizedBox(width: 6),
            _buildChip('Preparando', 'preparing'),
            const SizedBox(width: 6),
            _buildChip('Listos', 'ready'),
            const SizedBox(width: 6),
            _buildChip('En camino', 'in_transit'),
            const SizedBox(width: 6),
            _buildChip('Entregados', 'delivered'),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(String label, String status) {
    final isActive = _statusFilter == status;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isActive ? Colors.white : AppColors.textSecondary)),
      selected: isActive,
      onSelected: (_) => setState(() => _statusFilter = status),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.lightGray,
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order) {
    final status = order['status'] as String? ?? 'pending';
    final statusColor = _getStatusColor(status);
    final total = (order['total'] as num?)?.toInt() ?? 0;
    final date = order['created_at'] as String? ?? '';
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => _showStatusDialog(order),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(Icons.receipt_long, color: statusColor, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text('#${(order['id'] ?? 0).toString().padLeft(4, '0')}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: statusColor.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                        child: Text(_getStatusLabel(status), style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                      ),
                    ]),
                    const SizedBox(height: 4),
                    Text(order['client_name'] as String? ?? 'Cliente', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    Text(date.isNotEmpty ? formatDate(date) : '', style: const TextStyle(fontSize: 11, color: AppColors.gray)),
                  ],
                ),
              ),
              Text(formatCOP(total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
        ),
      ),
    );
  }
}
