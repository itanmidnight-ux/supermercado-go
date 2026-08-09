import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../providers/product_provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/money_text.dart';
import '../../widgets/quantity_stepper.dart';
import '../../utils/constants.dart';

class ProductDetailScreen extends StatefulWidget {
  final int productId;
  const ProductDetailScreen({super.key, required this.productId});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    context.read<ProductProvider>().loadProduct(widget.productId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Detalle Producto', showBack: true),
      body: Consumer<ProductProvider>(
        builder: (_, pp, __) {
          if (pp.isLoadingDetail) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }
          final p = pp.selectedProduct;
          if (p == null) {
            return const Center(child: Text('Producto no encontrado'));
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 250,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.lightGray,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: p.image != null && p.image!.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.cover),
                        )
                      : const Icon(Icons.shopping_bag, size: 80, color: AppColors.gray),
                ),
                const SizedBox(height: 16),
                if (p.isOffer && p.offerPrice != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(6)),
                    child: const Text('OFERTA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                const SizedBox(height: 8),
                Text(p.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                if (p.brand != null) ...[
                  const SizedBox(height: 4),
                  Text(p.brand!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                ],
                const SizedBox(height: 12),
                MoneyText(amount: p.effectivePrice, size: MoneySize.large, compareAmount: p.comparePrice),
                if (p.isPricedByWeight) const SizedBox(height: 4),
                if (p.isPricedByWeight)
                  Text('Precio por ${p.displayUnit}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 12),
                Text(p.description.isNotEmpty ? p.description : 'Sin descripción disponible',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5)),
                const SizedBox(height: 24),
                Row(
                  children: [
                    QuantityStepper(
                      quantity: _qty,
                      max: p.stock,
                      onChanged: (v) => setState(() => _qty = v),
                    ),
                    const Spacer(),
                    Text('Subtotal: ', style: const TextStyle(fontSize: 16, color: AppColors.textSecondary)),
                    MoneyText(amount: p.effectivePrice * _qty, size: MoneySize.medium),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: p.inStock
                        ? () {
                            context.read<CartProvider>().addProduct(p, quantity: _qty);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Producto agregado al carrito'), backgroundColor: AppColors.primary, duration: Duration(seconds: 1)),
                            );
                          }
                        : null,
                    icon: const Icon(Icons.shopping_cart, size: 20),
                    label: Text(p.inStock ? 'Agregar al Carrito' : 'Agotado', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
