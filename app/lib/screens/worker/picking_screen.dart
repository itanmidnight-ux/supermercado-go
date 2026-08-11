import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../models/order_item.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class PickingScreen extends StatefulWidget {
  final int orderId;

  const PickingScreen({super.key, required this.orderId});

  @override
  State<PickingScreen> createState() => _PickingScreenState();
}

class _PickingScreenState extends State<PickingScreen> {
  Order? _order;
  bool _isLoading = true;
  String? _error;
  bool _isFinishing = false;
  final Map<int, int> _pickedQtys = {};
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadOrder();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadOrder() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.order(widget.orderId.toString()));
      final data = response['data'] ?? response['order'] ?? response;
      final order = Order.fromJson(data as Map<String, dynamic>);
      setState(() {
        _order = order;
        for (final item in order.items) {
          _pickedQtys[item.id ?? item.productId] = item.qtyDelivered?.toInt() ?? 0;
        }
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar el pedido';
        _isLoading = false;
      });
    }
  }

  void _togglePicked(int key, int requested) {
    setState(() {
      final current = _pickedQtys[key] ?? 0;
      if (current < requested) {
        _pickedQtys[key] = requested;
      } else {
        _pickedQtys[key] = 0;
      }
    });
  }

  int get _totalRequested {
    if (_order == null) return 0;
    return _order!.items.fold(0, (sum, item) => sum + item.qty.round());
  }

  int get _totalPicked {
    if (_order == null) return 0;
    return _order!.items.fold(0, (sum, item) {
      final key = item.id ?? item.productId;
      return sum + (_pickedQtys[key] ?? 0);
    });
  }

  double get _progress {
    if (_totalRequested == 0) return 0;
    return _totalPicked / _totalRequested;
  }

  Future<void> _finishPicking() async {
    if (_order == null) return;
    setState(() => _isFinishing = true);
    try {
      await apiService.put(
        '/api/orders/${widget.orderId}/status',
        {'status': 'ready'},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Alistamiento finalizado correctamente'),
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
          const SnackBar(content: Text('Error al finalizar alistamiento'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isFinishing = false);
    }
  }

  void _openScanner(int itemId) {
    Navigator.pushNamed(context, '/worker/scanner', arguments: {
      'order_id': widget.orderId,
      'item_id': itemId,
    });
  }

  void _openSubstitution(OrderItem item) {
    Navigator.pushNamed(context, '/worker/substitution', arguments: {
      'order_id': widget.orderId,
      'item': item,
    }).then((changed) {
      if (changed == true) _loadOrder();
    });
  }

  List<OrderItem> get _filteredItems {
    if (_order == null) return [];
    final query = _searchController.text.toLowerCase().trim();
    if (query.isEmpty) return _order!.items;
    return _order!.items
        .where((item) => item.productName.toLowerCase().contains(query))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_order != null ? 'Pedido ${_order!.displayNumber}' : 'Alistamiento'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
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
                        onPressed: _loadOrder,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadOrder,
                  child: Column(
                    children: [
                      _buildProgressHeader(),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: TextField(
                          controller: _searchController,
                          decoration: InputDecoration(
                            hintText: 'Buscar producto...',
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
                        child: _filteredItems.isEmpty
                            ? const Center(
                                child: Text(
                                  'No se encontraron productos',
                                  style: TextStyle(color: AppColors.gray),
                                ),
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                itemCount: _filteredItems.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 8),
                                itemBuilder: (context, index) {
                                  final item = _filteredItems[index];
                                  return _buildItemCard(item);
                                },
                              ),
                      ),
                      _buildBottomBar(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildProgressHeader() {
    final pct = (_progress * 100).toStringAsFixed(0);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Progreso de alistamiento',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              Text(
                '$_totalPicked / $_totalRequested ($pct%)',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: _progress,
              minHeight: 10,
              backgroundColor: AppColors.lightGray,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemCard(OrderItem item) {
    final key = item.id ?? item.productId;
    final picked = _pickedQtys[key] ?? 0;
    final requested = item.qty.round();
    final isComplete = picked >= requested;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      color: isComplete ? AppColors.primary.withOpacity(0.05) : AppColors.surface,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Transform.scale(
              scale: 1.2,
              child: Checkbox(
                value: isComplete,
                onChanged: (_) => _togglePicked(key, requested),
                activeColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.productName,
                    style: TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 14,
                      decoration: isComplete ? TextDecoration.lineThrough : null,
                      color: isComplete ? AppColors.gray : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Solicitado: $requested ${item.unit ?? "un"}  |  Preparado: $picked',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  if (item.substituteProductName != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Sustituido por: ${item.substituteProductName}',
                      style: TextStyle(fontSize: 11, color: AppColors.accent, fontStyle: FontStyle.italic),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              children: [
                IconButton(
                  icon: const Icon(Icons.qr_code_scanner, size: 20),
                  tooltip: 'Escanear código',
                  onPressed: () => _openScanner(item.id ?? item.productId),
                  color: AppColors.primaryDark,
                ),
                IconButton(
                  icon: const Icon(Icons.swap_horiz, size: 20),
                  tooltip: 'Sustituir',
                  onPressed: () => _openSubstitution(item),
                  color: AppColors.accent,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            offset: const Offset(0, -2),
            blurRadius: 8,
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          height: 50,
          child: ElevatedButton.icon(
            onPressed: _isFinishing ? null : _finishPicking,
            icon: _isFinishing
                ? const SizedBox(
                    width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.check_circle_outline),
            label: Text(_isFinishing ? 'Finalizando...' : 'Finalizar alistamiento'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ),
    );
  }
}
