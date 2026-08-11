import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  List<Map<String, dynamic>> _purchases = [];
  bool _isLoading = true;
  String? _error;
  String _statusFilter = 'all';
  int? _supplierFilterId;
  List<Map<String, dynamic>> _suppliers = [];
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadPurchases();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadPurchases() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{};
      if (_statusFilter != 'all') {
        queryParams['status'] = _statusFilter;
      }
      if (_supplierFilterId != null) {
        queryParams['supplier_id'] = _supplierFilterId.toString();
      }
      final response = await apiService.get(ApiEndpoints.adminPurchases, queryParams: queryParams);
      final raw = response['data'] ?? response['purchases'] ?? response;
      final list = raw is List ? raw : [raw];
      final suppliersRaw = response['suppliers'] as List? ?? [];
      setState(() {
        _purchases = list.map((e) => e as Map<String, dynamic>).toList();
        _suppliers = suppliersRaw.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar compras';
        _isLoading = false;
      });
    }
  }

  String _getStatusLabel(String status) {
    const map = {
      'pending': 'Pendiente',
      'received': 'Recibida',
      'cancelled': 'Anulada',
      'recibida': 'Recibida',
      'anulada': 'Anulada',
      'pendiente': 'Pendiente',
    };
    return map[status] ?? status;
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending':
      case 'pendiente':
        return AppColors.accent;
      case 'received':
      case 'recibida':
        return AppColors.success;
      case 'cancelled':
      case 'anulada':
        return AppColors.error;
      default:
        return AppColors.gray;
    }
  }

  List<Map<String, dynamic>> get _filteredPurchases {
    if (_statusFilter == 'all' && _supplierFilterId == null) return _purchases;
    return _purchases.where((p) {
      final s = p['status'] as String? ?? '';
      final supplierId = p['supplier_id'] as int?;
      final matchStatus = _statusFilter == 'all' || s == _statusFilter;
      final matchSupplier = _supplierFilterId == null || supplierId == _supplierFilterId;
      return matchStatus && matchSupplier;
    }).toList();
  }

  void _showPurchaseDetail(Map<String, dynamic> purchase) {
    final items = purchase['items'] as List? ?? [];
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('Compra #${purchase['id']}'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('Proveedor', purchase['supplier_name'] ?? '-'),
              _buildDetailRow('Estado', _getStatusLabel(purchase['status'] ?? '')),
              _buildDetailRow('Total', formatCOP((purchase['total'] as num?)?.toInt() ?? 0)),
              _buildDetailRow('Fecha', purchase['created_at'] != null ? formatDate(purchase['created_at'].toString()) : '-'),
              if (purchase['notes'] != null && purchase['notes'].toString().isNotEmpty)
                _buildDetailRow('Notas', purchase['notes'].toString()),
              const Divider(height: 20),
              const Text('Productos:', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...items.map((item) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text(item['product_name'] ?? '-', style: const TextStyle(fontSize: 13))),
                    Text(
                      '${item['qty'] ?? 0} x ${formatCOP((item['unit_cost'] as num?)?.toInt() ?? 0)}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              )),
              if (purchase['status'] == 'pending' || purchase['status'] == 'pendiente')
                const SizedBox(height: 16),
              if (purchase['status'] == 'pending' || purchase['status'] == 'pendiente')
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _showReceiveForm(purchase);
                    },
                    icon: const Icon(Icons.check),
                    label: const Text('Recibir compra'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cerrar')),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
        ],
      ),
    );
  }

  void _showReceiveForm(Map<String, dynamic> purchase) {
    final notesController = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Recibir compra'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Compra #${purchase['id']} - ${purchase['supplier_name'] ?? ""}'),
            const SizedBox(height: 12),
            TextField(
              controller: notesController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Notas de recepción (opcional)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              notesController.dispose();
              Navigator.pop(ctx);
            },
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              notesController.dispose();
              await _receivePurchase(purchase['id'] as int, notesController.text);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Confirmar recepción'),
          ),
        ],
      ),
    );
  }

  Future<void> _receivePurchase(int id, String notes) async {
    try {
      await apiService.post('${ApiEndpoints.adminPurchases}/$id/receive', {
        'notes': notes.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Compra recibida correctamente'), backgroundColor: AppColors.success),
        );
        _loadPurchases();
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
      appBar: const CustomAppBar(title: 'Compras'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showNewPurchaseForm(),
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add),
        label: const Text('Nueva compra'),
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
                        onPressed: _loadPurchases,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    _buildFilterBar(),
                    Expanded(
                      child: _filteredPurchases.isEmpty
                          ? EmptyState(
                              icon: Icons.receipt_long_outlined,
                              title: 'Sin compras',
                              subtitle: 'No hay compras que coincidan con los filtros',
                            )
                          : RefreshIndicator(
                              onRefresh: _loadPurchases,
                              child: ListView.builder(
                                controller: _scrollController,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                itemCount: _filteredPurchases.length,
                                itemBuilder: (context, index) => _buildPurchaseCard(_filteredPurchases[index]),
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
            _buildFilterChip('Todas', 'all'),
            const SizedBox(width: 6),
            _buildFilterChip('Pendientes', 'pending'),
            const SizedBox(width: 6),
            _buildFilterChip('Recibidas', 'received'),
            const SizedBox(width: 6),
            _buildFilterChip('Anuladas', 'cancelled'),
            if (_suppliers.isNotEmpty) ...[
              const SizedBox(width: 12),
              DropdownButton<int?>(
                value: _supplierFilterId,
                hint: const Text('Proveedor', style: TextStyle(fontSize: 13)),
                underline: const SizedBox(),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Todos')),
                  ..._suppliers.map((s) => DropdownMenuItem(
                        value: s['id'] as int?,
                        child: Text(s['name'] as String? ?? '', style: const TextStyle(fontSize: 13)),
                      )),
                ],
                onChanged: (val) => setState(() => _supplierFilterId = val),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String status) {
    final isActive = _statusFilter == status;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isActive ? Colors.white : AppColors.textSecondary)),
      selected: isActive,
      onSelected: (_) => setState(() => _statusFilter = status),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.lightGray,
      side: BorderSide.none,
      labelStyle: const TextStyle(fontSize: 12),
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildPurchaseCard(Map<String, dynamic> purchase) {
    final status = purchase['status'] as String? ?? 'pending';
    final statusColor = _getStatusColor(status);
    final total = (purchase['total'] as num?)?.toInt() ?? 0;
    final date = purchase['created_at'] as String? ?? '';
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => _showPurchaseDetail(purchase),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.receipt_long, color: statusColor, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '#${(purchase['id'] ?? 0).toString().padLeft(4, "0")}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(width: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _getStatusLabel(status),
                            style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      purchase['supplier_name'] as String? ?? 'Proveedor',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    Text(
                      date.isNotEmpty ? formatDate(date) : '',
                      style: const TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                  ],
                ),
              ),
              Text(
                formatCOP(total),
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showNewPurchaseForm() {
    Navigator.pushNamed(context, '/admin/purchase-form').then((created) {
      if (created == true) _loadPurchases();
    });
  }
}
