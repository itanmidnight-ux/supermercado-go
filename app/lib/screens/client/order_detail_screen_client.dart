import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../providers/order_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/money_text.dart';
import '../../widgets/order_status_chip.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class OrderDetailScreenClient extends StatefulWidget {
  final int orderId;
  const OrderDetailScreenClient({super.key, required this.orderId});

  @override
  State<OrderDetailScreenClient> createState() => _OrderDetailScreenClientState();
}

class _OrderDetailScreenClientState extends State<OrderDetailScreenClient> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadOrder(widget.orderId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Pedido #${widget.orderId.toString().padLeft(4, '0')}', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoadingCurrent) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          final o = op.currentOrder;
          if (o == null) return const Center(child: Text('Pedido no encontrado'));
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text(o.displayNumber, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  OrderStatusChip(status: o.status),
                ]),
                const SizedBox(height: 16),
                const Text('Productos', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                const SizedBox(height: 8),
                ...o.items.map((item) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.lightGray, borderRadius: BorderRadius.circular(6)), child: item.image != null ? ClipRRect(borderRadius: BorderRadius.circular(6), child: CachedNetworkImage(imageUrl: item.image!, fit: BoxFit.cover)) : const Icon(Icons.shopping_bag, color: AppColors.gray, size: 20)),
                    title: Text(item.productName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${item.qty} x ${formatCOP(item.unitPrice)}'),
                    trailing: Text(formatCOP(item.lineTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                )),
                const Divider(height: 24),
                _buildDetailRow('Subtotal', formatCOP(o.subtotal)),
                _buildDetailRow('Domicilio', formatCOP(o.deliveryFee)),
                if (o.discount > 0) _buildDetailRow('Descuento', '-${formatCOP(o.discount)}', color: AppColors.success),
                if (o.taxTotal > 0) _buildDetailRow('IVA', formatCOP(o.taxTotal)),
                const Divider(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  MoneyText(amount: o.total, size: MoneySize.large),
                ]),
                if (o.canRate) ...[
                  const SizedBox(height: 24),
                  SizedBox(width: double.infinity, height: 48, child: ElevatedButton(onPressed: () => Navigator.pushNamed(context, '/rate', arguments: {'id': o.id}), child: const Text('Calificar Pedido', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)))),
                ],
                if (o.canCancel) ...[
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, height: 48, child: OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)), onPressed: () async {
                    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(title: const Text('Cancelar Pedido'), content: const TextField(decoration: InputDecoration(labelText: 'Motivo de cancelación')), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No')), ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sí, cancelar'), style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white))]));
                    if (ok == true) {
                      await op.cancelOrder(o.id, 'Cancelado por el cliente');
                      if (mounted) Navigator.pop(context);
                    }
                  }, child: const Text('Cancelar Pedido', style: TextStyle(fontWeight: FontWeight.w600)))),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? color}) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: AppColors.textSecondary)),
      Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
    ]));
  }
}
