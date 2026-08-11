import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/order_provider.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/money_text.dart';

class WorkerOrdersScreen extends StatefulWidget {
  const WorkerOrdersScreen({super.key});

  @override
  State<WorkerOrdersScreen> createState() => _WorkerOrdersScreenState();
}

class _WorkerOrdersScreenState extends State<WorkerOrdersScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadAvailableOrders();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Pedidos Disponibles', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoading && op.orders.isEmpty) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }
          if (op.orders.isEmpty) {
            return const EmptyState(
              icon: Icons.inventory_2,
              title: 'Sin pedidos',
              subtitle: 'No hay pedidos disponibles en este momento',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: op.orders.length,
            itemBuilder: (_, i) {
              final o = op.orders[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            o.displayNumber,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          MoneyText(amount: o.total, size: MoneySize.medium),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${o.items.length} productos',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                      ),
                      if (o.deliveryAddress != null)
                        Text(
                          o.deliveryAddress!,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 42,
                        child: ElevatedButton(
                          onPressed: () async {
                            final ok = await op.acceptOrder(o.id);
                            if (ok && mounted) {
                              Navigator.pushNamed(context, '/worker/picking', arguments: {'id': o.id});
                            }
                          },
                          child: const Text('Aceptar Pedido', style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
