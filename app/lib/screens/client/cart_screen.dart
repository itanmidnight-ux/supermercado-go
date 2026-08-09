import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/money_text.dart';
import '../../widgets/quantity_stepper.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Mi Carrito', showBack: true),
      body: Consumer<CartProvider>(
        builder: (_, cart, __) {
          if (cart.items.isEmpty) {
            return const EmptyState(
              icon: Icons.shopping_cart_outlined,
              title: 'Tu carrito está vacío',
              subtitle: 'Agrega productos para comenzar tu pedido',
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: cart.items.length,
                  itemBuilder: (_, i) {
                    final item = cart.items[i];
                    final p = item.product;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Row(
                          children: [
                            Container(
                              width: 60, height: 60,
                              decoration: BoxDecoration(
                                color: AppColors.lightGray,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: p.image != null && p.image!.isNotEmpty
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.cover),
                                    )
                                  : const Icon(Icons.shopping_bag, color: AppColors.gray),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  const SizedBox(height: 4),
                                  MoneyText(amount: p.effectivePrice, size: MoneySize.small),
                                ],
                              ),
                            ),
                            QuantityStepper(
                              quantity: item.quantity,
                              max: p.stock,
                              onChanged: (v) => cart.updateQty(p.id, v),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 22),
                              onPressed: () => cart.removeProduct(p.id),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              _buildCartSummary(cart, context),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCartSummary(CartProvider cart, BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, -2))],
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Subtotal', style: TextStyle(color: AppColors.textSecondary)),
                Text(formatCOP(cart.subtotal), style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Domicilio', style: TextStyle(color: AppColors.textSecondary)),
                Text(
                  cart.deliveryFee == 0 ? 'GRATIS' : formatCOP(cart.deliveryFee),
                  style: TextStyle(fontWeight: FontWeight.w500, color: cart.deliveryFee == 0 ? AppColors.success : null),
                ),
              ],
            ),
            if (cart.discount > 0) ...[
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Descuento', style: TextStyle(color: AppColors.success)),
                  Text('-${formatCOP(cart.discount)}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.success)),
                ],
              ),
            ],
            if (cart.subtotal < 50000) ...[
              const SizedBox(height: 6),
              const Text(
                '¡Envío gratis en pedidos mayores a ${AppStrings.currencySymbol}50.000!',
                style: TextStyle(color: AppColors.accent, fontSize: 12),
              ),
            ],
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                MoneyText(amount: cart.total, size: MoneySize.large),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, '/checkout'),
                child: const Text('Ir a Pagar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
