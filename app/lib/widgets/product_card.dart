import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/product.dart';
import '../utils/constants.dart';
import '../utils/formatters.dart';

class ProductCard extends StatelessWidget {
  final Product product;
  final VoidCallback? onTap;
  final VoidCallback? onAddToCart;
  final bool showAddButton;

  const ProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.onAddToCart,
    this.showAddButton = true,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildImage(context),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (product.brand != null && product.brand!.isNotEmpty)
                      Text(
                        product.brand!,
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    const SizedBox(height: 2),
                    Text(
                      product.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Spacer(),
                    _buildPrice(),
                    const SizedBox(height: 4),
                    _buildStockIndicator(),
                    if (showAddButton && product.inStock) _buildAddButton(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage(BuildContext context) {
    final unitLabel = product.isPricedByWeight
        ? '/${product.displayUnit}'
        : '';

    return Stack(
      children: [
        Container(
          height: 120,
          width: double.infinity,
          color: AppColors.lightGray,
          child: product.image != null && product.image!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: product.image!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => const Center(
                    child: Icon(Icons.shopping_bag, size: 40, color: AppColors.gray),
                  ),
                  errorWidget: (_, __, ___) => const Center(
                    child: Icon(Icons.shopping_bag, size: 40, color: AppColors.gray),
                  ),
                )
              : const Center(
                  child: Icon(Icons.shopping_bag, size: 40, color: AppColors.gray),
                ),
        ),
        if (product.isOffer && product.offerPrice != null)
          Positioned(
            top: 6,
            left: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'OFERTA',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        if (!product.inStock)
          Positioned.fill(
            child: Container(
              color: Colors.black54,
              child: const Center(
                child: Text(
                  'Agotado',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildPrice() {
    if (product.isPricedByWeight) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${formatCOP(product.effectivePrice)}/${product.displayUnit}',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
          if (product.comparePrice != null && product.comparePrice! > product.effectivePrice)
            Text(
              '${formatCOP(product.comparePrice!)}/${product.displayUnit}',
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.gray,
                decoration: TextDecoration.lineThrough,
              ),
            ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          formatCOP(product.effectivePrice),
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: AppColors.primary,
          ),
        ),
        if (product.comparePrice != null && product.comparePrice! > product.effectivePrice)
          Text(
            formatCOP(product.comparePrice!),
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.gray,
              decoration: TextDecoration.lineThrough,
            ),
          ),
      ],
    );
  }

  Widget _buildStockIndicator() {
    if (!product.inStock) {
      return const Text(
        'Agotado',
        style: TextStyle(fontSize: 11, color: AppColors.error),
      );
    }
    if (product.stock <= 5) {
      return Text(
        '¡Últimas ${product.stock} unidades!',
        style: const TextStyle(fontSize: 11, color: AppColors.accent),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildAddButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onAddToCart,
        icon: const Icon(Icons.add, size: 16),
        label: const Text('Agregar', style: TextStyle(fontSize: 12)),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 4),
          minimumSize: Size.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      ),
    );
  }
}
