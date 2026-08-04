import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/order.dart';
import '../../models/product.dart';
import '../../providers/order_provider.dart';
import '../../providers/cart_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/order_status_chip.dart';
import '../../widgets/confirm_dialog.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class OrderDetailScreen extends StatefulWidget {
  final int orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final TextEditingController _cancelReasonController = TextEditingController();
  bool _isCancelling = false;
  Order? _order;
  bool _isLoading = true;
  String? _error;

  static const List<String> _statusSteps = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'assigned',
    'in_transit',
    'delivered',
  ];

  static const List<String> _pickupSteps = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'picked_up',
  ];

  @override
  void initState() {
    super.initState();
    _loadOrder();
  }

  @override
  void dispose() {
    _cancelReasonController.dispose();
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
      setState(() {
        _order = Order.fromJson(data as Map<String, dynamic>);
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

  Future<void> _cancelOrder() async {
    _cancelReasonController.clear();
    final reason = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Cancelar pedido'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('¿Por qué deseas cancelar este pedido?'),
            const SizedBox(height: 12),
            TextField(
              controller: _cancelReasonController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Razón de cancelación...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Volver'),
          ),
          ElevatedButton(
            onPressed: () {
              final text = _cancelReasonController.text.trim();
              if (text.isEmpty) {
                Navigator.pop(context, 'Cliente solicitó cancelación');
              } else {
                Navigator.pop(context, text);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Cancelar pedido'),
          ),
        ],
      ),
    );

    if (reason == null) return;

    setState(() => _isCancelling = true);
    try {
      await apiService.post(ApiEndpoints.orderCancel(widget.orderId.toString()), {
        'reason': reason,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pedido cancelado'), backgroundColor: AppColors.error),
      );
      _loadOrder();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } finally {
      setState(() => _isCancelling = false);
    }
  }

  void _repeatOrder() {
    if (_order == null) return;
    final cart = context.read<CartProvider>();
    for (final item in _order!.items) {
      final product = Product(
        id: item.productId,
        name: item.productName,
        price: item.unitPrice,
        stock: 999,
        image: item.image,
        unit: item.unit,
      );
      cart.addProduct(product, quantity: item.qty.toInt());
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${_order!.items.length} productos agregados al carrito'),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'Ver carrito',
          textColor: Colors.white,
          onPressed: () => Navigator.pushNamed(context, '/cart'),
        ),
      ),
    );
  }

  void _viewInvoice() {
    if (_order?.invoiceId != null) {
      Navigator.pushNamed(context, '/invoice', arguments: _order!);
    }
  }

  int _getCurrentStepIndex(String status) {
    if (status == 'cancelled') return -1;
    final steps = _order?.isPickup == true ? _pickupSteps : _statusSteps;
    final idx = steps.indexOf(status);
    return idx >= 0 ? idx : 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_order != null ? 'Pedido ${_order!.displayNumber}' : 'Detalle del pedido'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (_order?.invoiceId != null)
            IconButton(
              icon: const Icon(Icons.receipt_long),
              tooltip: 'Ver factura',
              onPressed: _viewInvoice,
            ),
        ],
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
              : _order == null
                  ? const SizedBox()
                  : RefreshIndicator(
                      onRefresh: _loadOrder,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildStatusSection(),
                          const SizedBox(height: 16),
                          _buildFulfillmentInfo(),
                          const SizedBox(height: 16),
                          _buildItemsList(),
                          const SizedBox(height: 16),
                          _buildCostBreakdown(),
                          const SizedBox(height: 16),
                          _buildActions(),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildStatusSection() {
    final status = _order!.status;
    final steps = _order!.isPickup ? _pickupSteps : _statusSteps;
    final currentIdx = _getCurrentStepIndex(status);

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                OrderStatusChip(status: status),
                const Spacer(),
                if (_order!.createdAt != null)
                  Text(
                    formatDate(_order!.createdAt!),
                    style: const TextStyle(fontSize: 12, color: AppColors.gray),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (status == 'cancelled') ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.cancel, color: AppColors.error, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Motivo: ${_order!.cancelledReason ?? "No especificado"}',
                        style: const TextStyle(fontSize: 13, color: AppColors.error),
                      ),
                    ),
                  ],
                ),
              ),
            ] else
              _buildStepper(steps, currentIdx),
          ],
        ),
      ),
    );
  }

  Widget _buildStepper(List<String> steps, int currentIdx) {
    return Column(
      children: List.generate(steps.length, (index) {
        final isCompleted = index < currentIdx;
        final isCurrent = index == currentIdx;
        final isLast = index == steps.length - 1;
        final stepLabel = AppStrings.orderStatuses[steps[index]] ?? steps[index];

        return Row(
          children: [
            Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isCompleted || isCurrent ? AppColors.primary : AppColors.lightGray,
                    border: isCurrent
                        ? Border.all(color: AppColors.primary, width: 3)
                        : null,
                  ),
                  child: isCompleted
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : isCurrent
                          ? Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primary,
                              ),
                            )
                          : null,
                ),
                if (!isLast)
                  Container(
                    width: 2,
                    height: 24,
                    color: isCompleted ? AppColors.primary : AppColors.lightGray,
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: isLast ? 0 : 24),
                child: Text(
                  stepLabel,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isCurrent ? FontWeight.w600 : FontWeight.normal,
                    color: isCompleted || isCurrent
                        ? AppColors.textPrimary
                        : AppColors.gray,
                  ),
                ),
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _buildFulfillmentInfo() {
    if (_order!.isPickup) {
      return Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.store, color: AppColors.accent, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Recogida en tienda', style: TextStyle(fontWeight: FontWeight.w600)),
                    if (_order!.pickupCode != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Código: ${_order!.pickupCode}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                          letterSpacing: 2,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.delivery_dining, color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Dirección de entrega', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                    _order!.deliveryAddress ?? 'No especificada',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItemsList() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Productos del pedido',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const Divider(height: 20),
            ..._order!.items.map((item) => _buildItemRow(item)),
          ],
        ),
      ),
    );
  }

  Widget _buildItemRow(OrderItem item) {
    final displayQty = item.qty == item.qty.roundToDouble()
        ? item.qty.toInt().toString()
        : item.qty.toStringAsFixed(2);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 50,
              height: 50,
              child: item.image != null && item.image!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: item.image!,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(
                        color: AppColors.lightGray,
                        child: const Icon(Icons.shopping_bag, size: 20, color: AppColors.gray),
                      ),
                    )
                  : Container(
                      color: AppColors.lightGray,
                      child: const Icon(Icons.shopping_bag, size: 20, color: AppColors.gray),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '$displayQty ${item.unit ?? 'un'} × ${formatCOP(item.unitPrice)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          Text(
            formatCOP(item.lineTotal),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildCostBreakdown() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resumen del pago',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const Divider(height: 20),
            _buildCostRow('Subtotal', formatCOP(_order!.subtotal)),
            _buildCostRow('Domicilio', formatCOP(_order!.deliveryFee)),
            if (_order!.discount > 0)
              _buildCostRow(
                'Descuento',
                '-${formatCOP(_order!.discount)}',
                valueColor: AppColors.success,
              ),
            _buildCostRow('Impuestos', formatCOP(_order!.taxTotal)),
            const Divider(height: 20),
            _buildCostRow(
              'Total',
              formatCOP(_order!.total),
              isTotal: true,
            ),
            if (_order!.paymentMethod != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('Método de pago: ', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                  Text(
                    AppStrings.paymentMethods[_order!.paymentMethod] ?? _order!.paymentMethod!,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCostRow(String label, String value, {bool isTotal = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color: isTotal ? AppColors.textPrimary : AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isTotal ? 18 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w600,
              color: valueColor ?? (isTotal ? AppColors.primary : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    final status = _order!.status;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (status == 'delivered' || status == 'picked_up')
          ElevatedButton.icon(
            onPressed: _repeatOrder,
            icon: const Icon(Icons.replay),
            label: const Text('Repetir pedido'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        if (_order!.canRate)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pushNamed(context, '/rate-order', arguments: _order!);
              },
              icon: const Icon(Icons.star_rate),
              label: const Text('Calificar pedido'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.textPrimary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        if (_order!.canCancel)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: OutlinedButton.icon(
              onPressed: _isCancelling ? null : _cancelOrder,
              icon: _isCancelling
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.cancel_outlined),
              label: Text(_isCancelling ? 'Cancelando...' : 'Cancelar pedido'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
      ],
    );
  }
}
