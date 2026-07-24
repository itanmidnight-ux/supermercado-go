import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/local_db.dart';
import '../utils/product_description.dart';
import '../widgets/app_button.dart';
import '../widgets/app_card.dart';
import '../widgets/delivery_modal.dart';
import '../widgets/empty_state.dart';
import '../widgets/long_press_preview_detector.dart';
import '../widgets/payment_modal.dart';
import '../widgets/product_preview_modal.dart';
import 'client_product_detail.dart';

class ClientCartScreen extends StatefulWidget {
  final VoidCallback? onViewProducts;
  const ClientCartScreen({super.key, this.onViewProducts});
  @override
  State<ClientCartScreen> createState() => ClientCartScreenState();
}

class ClientCartScreenState extends State<ClientCartScreen> {
  List<CartItem> _items = [];
  bool _loading = true;
  bool _checking = false;
  Map<int, Product> _productsById = {};

  @override
  void initState() {
    super.initState();
    _load();
    _loadProductsMap();
  }

  void reload() {
    if (mounted) _load();
  }

  // Cache de productos completos (imágenes, aliases) para poder abrir la
  // vista previa o la página completa desde una tarjeta del carrito -- la
  // respuesta de /api/cart solo trae nombre/precio, no el producto entero.
  Future<void> _loadProductsMap() async {
    try {
      var list = await LocalDB.getCachedProducts();
      if (list.isEmpty) list = await ApiService.getProducts();
      if (mounted)
        setState(() => _productsById = {
              for (final p in list)
                if (p.id != null) p.id!: p
            });
    } catch (_) {}
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await ApiService.getCart();
      if (mounted) setState(() => _items = items);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _remove(CartItem item) async {
    try {
      await ApiService.removeFromCart(item.productId);
      await _load();
    } catch (_) {}
  }

  double get _total => _items.fold(0, (s, i) => s + i.subtotal);

  // Checkout en dos pasos, cada uno su propia ventana emergente futurista:
  // 1) entrega (ubicación en tiempo real o dirección escrita) 2) método de
  // pago (contra entrega solo si se compartió ubicación en el paso 1).
  Future<void> _checkout() async {
    if (_items.isEmpty) return;

    final delivery = await showDeliveryModal(context);
    if (delivery == null || !mounted) return;

    final payment = await showPaymentModal(context,
        gpsGranted: delivery.mode == 'gps', total: _total);
    if (payment == null || !mounted) return;

    await _doCheckout(delivery: delivery, payment: payment);
  }

  Future<void> _doCheckout(
      {required DeliveryChoice delivery,
      required PaymentChoice payment}) async {
    setState(() => _checking = true);
    try {
      await ApiService.checkout(
        paymentMethod: payment.method,
        paymentReference: payment.reference,
        deliveryDate: _items.isNotEmpty ? _items.first.deliveryDate : null,
        deliveryMode: delivery.mode,
        deliveryLat: delivery.lat,
        deliveryLng: delivery.lng,
        deliveryAddress: delivery.address,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('¡Pedido realizado exitosamente!'),
          backgroundColor: Theme.of(context).colorScheme.primary,
          behavior: SnackBarBehavior.floating,
        ));
        setState(() => _items = []);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
        ));
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  String _fmt(double v) =>
      NumberFormat.currency(locale: 'es_CO', symbol: '', decimalDigits: 0)
          .format(v);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      appBar: AppBar(
        title: const Text('Mi carrito'),
        actions: [
          if (_items.isNotEmpty)
            TextButton(
              onPressed: () async {
                await ApiService.clearCart();
                _load();
              },
              child:
                  const Text('Vaciar', style: TextStyle(color: Colors.white70)),
            ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: scheme.primary))
          : _items.isEmpty
              ? EmptyState(
                  icon: Icons.shopping_cart_outlined,
                  title: 'Tu carrito está vacío',
                  action: TextButton(
                    // El carrito es una pestaña de un IndexedStack, no una
                    // ruta empujada -- Navigator.pop(context) aqui no tenia
                    // nada que hacer pop y dejaba una pantalla en negro.
                    // El padre (ClientHomeScreen) decide como volver a la
                    // pestaña de productos.
                    onPressed: widget.onViewProducts,
                    child: const Text('Ver productos'),
                  ),
                )
              : Column(children: [
                  Expanded(
                      child: ListView.builder(
                    padding:
                        const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    itemCount: _items.length,
                    itemBuilder: (_, i) {
                      final item = _items[i];
                      final product = _productsById[item.productId];
                      final radius = BorderRadius.circular(20);

                      final card = AppCard(
                        padding: const EdgeInsets.all(14),
                        child: Row(children: [
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(item.productName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                Text('\$${_fmt(item.price)} c/u',
                                    style: TextStyle(
                                        color: Colors.grey.shade500,
                                        fontSize: 12)),
                                if (item.deliveryDate != null)
                                  Text('Entrega: ${item.deliveryDate}',
                                      style: TextStyle(
                                          color: scheme.primary, fontSize: 12)),
                              ])),
                          Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('\$${_fmt(item.subtotal)}',
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: scheme.primary,
                                        fontSize: 15)),
                                Text('x${item.quantity}',
                                    style: TextStyle(
                                        color: Colors.grey.shade500,
                                        fontSize: 13)),
                              ]),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              _remove(item);
                            },
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.red.withValues(alpha: 0.08),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.delete_outline_rounded,
                                  color: Colors.red, size: 20),
                            ),
                          ),
                        ]),
                      );

                      return TweenAnimationBuilder<double>(
                        key: ValueKey(item.productId),
                        tween: Tween(begin: 0, end: 1),
                        duration:
                            Duration(milliseconds: 320 + (i.clamp(0, 6) * 50)),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, child) => Opacity(
                          opacity: v,
                          child: Transform.translate(
                              offset: Offset(0, (1 - v) * 14), child: child),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: LongPressPreviewDetector(
                            borderRadius: radius,
                            onDoubleTap: product == null
                                ? null
                                : () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) => ClientProductDetail(
                                            product: product,
                                            description:
                                                productDescription(product)))),
                            onLongPressReached: product == null
                                ? () {}
                                : () => showProductPreviewModal(context,
                                    product: product,
                                    description: productDescription(product)),
                            child: card,
                          ),
                        ),
                      );
                    },
                  )),

                  // Total + checkout
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(20)),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black12,
                            blurRadius: 8,
                            offset: Offset(0, -2))
                      ],
                    ),
                    child: SafeArea(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      Row(children: [
                        const Text('Total:',
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold)),
                        const Spacer(),
                        Text('\$${_fmt(_total)}',
                            style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: scheme.primary)),
                      ]),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: AppButton(
                          label:
                              _checking ? 'Procesando...' : 'Realizar pedido',
                          onPressed: _checking ? null : _checkout,
                          loading: _checking,
                          icon: Icons.payment_rounded,
                        ),
                      ),
                      const SizedBox(height: 8),
                    ])),
                  ),
                ]),
    );
  }
}
