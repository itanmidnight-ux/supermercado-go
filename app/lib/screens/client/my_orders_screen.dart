import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/order_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/money_text.dart';
import '../../widgets/order_status_chip.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadMyOrders();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Mis Pedidos', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoading && op.orders.isEmpty) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          if (op.orders.isEmpty) return const EmptyState(icon: Icons.receipt_long_outlined, title: 'Sin pedidos', subtitle: 'Aún no has realizado ningún pedido');
          return RefreshIndicator(
            onRefresh: () => op.loadMyOrders(refresh: true),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: op.orders.length,
              itemBuilder: (_, i) {
                final o = op.orders[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: InkWell(
                    onTap: () => Navigator.pushNamed(context, '/order', arguments: {'id': o.id}),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(o.displayNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              OrderStatusChip(status: o.status),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text('${o.items.length} productos', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                          const SizedBox(height: 4),
                          if (o.createdAt != null) Text(formatRelative(o.createdAt!), style: const TextStyle(color: AppColors.gray, fontSize: 12)),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Total', style: const TextStyle(color: AppColors.textSecondary)),
                              MoneyText(amount: o.total, size: MoneySize.medium),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
