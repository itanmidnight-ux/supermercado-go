import 'package:flutter/material.dart';
import '../models/product.dart';
import '../screens/client_product_detail.dart';
import 'futuristic_modal.dart';

/// Vista previa de un producto en una ventana emergente futurista: reusa
/// la misma pantalla de producto completa (galería, reseñas, agregar al
/// carrito) dentro de una tarjeta flotante con scroll propio. Cerrar con
/// back o tocando fuera vuelve a la grilla sin perder el estado.
Future<void> showProductPreviewModal(
  BuildContext context, {
  required Product product,
  required String description,
}) {
  return showFuturisticModal(context, builder: (_) {
    final size = MediaQuery.of(context).size;
    final scheme = Theme.of(context).colorScheme;
    final modalW = size.width > 560 ? 520.0 : size.width - 32;
    final modalH = size.height * 0.90;
    return Center(
      child: Container(
        width: modalW,
        height: modalH,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 50,
                offset: const Offset(0, 24)),
            BoxShadow(
                color: scheme.primary.withValues(alpha: 0.28), blurRadius: 70),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: ClientProductDetail(product: product, description: description),
      ),
    );
  });
}
