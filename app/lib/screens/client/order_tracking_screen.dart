import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/order_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../utils/constants.dart';

class OrderTrackingScreen extends StatefulWidget {
  final int orderId;
  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadOrder(widget.orderId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Rastrear Pedido', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoadingCurrent) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          final o = op.currentOrder;
          if (o == null) return const Center(child: Text('Pedido no encontrado'));
          final steps = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'in_transit', 'delivered'];
          final statusLabels = {'pending': 'Pendiente', 'confirmed': 'Confirmado', 'preparing': 'Preparando', 'ready': 'Listo', 'assigned': 'Asignado', 'in_transit': 'En camino', 'delivered': 'Entregado'};
          final currentIdx = steps.indexOf(o.status);
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(o.displayNumber, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('Repartidor: ${o.workerName ?? 'Por asignar'}', style: const TextStyle(color: AppColors.textSecondary)),
                const SizedBox(height: 24),
                ...steps.asMap().entries.map((e) {
                  final i = e.key;
                  final s = e.value;
                  final isActive = i <= currentIdx;
                  final isCurrent = i == currentIdx;
                  return _buildStep(i, steps.length, statusLabels[s]!, isActive, isCurrent);
                }),
                if (o.isPickup && o.pickupCode != null) ...[
                  const SizedBox(height: 24),
                  const Text('Código de recogida:', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(o.pickupCode!, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppColors.primary, letterSpacing: 8)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStep(int index, int total, String label, bool active, bool current) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(width: 28, height: 28, decoration: BoxDecoration(shape: BoxShape.circle, color: active ? AppColors.primary : AppColors.lightGray), child: active ? const Icon(Icons.check, color: Colors.white, size: 16) : null),
                if (index < total - 1) Expanded(child: Container(width: 2, color: active ? AppColors.primary : AppColors.lightGray)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(label, style: TextStyle(fontSize: 14, fontWeight: current ? FontWeight.bold : FontWeight.normal, color: active ? AppColors.textPrimary : AppColors.gray)),
          ),
        ],
      ),
    );
  }
}
