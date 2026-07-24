import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/guest_cart_service.dart';
import '../utils/product_description.dart';
import '../widgets/animated_tap_scale.dart';
import '../widgets/empty_state.dart';
import 'login_screen.dart';

/// Punto de entrada del sitio web para visitantes sin sesión: pueden
/// navegar el catálogo público y armar un carrito local (GuestCartService)
/// sin necesidad de loguearse. El login solo se pide al tocar "continuar
/// con la compra" -- el carrito se fusiona automáticamente al carrito real
/// apenas la sesión inicia (ver GuestCartService.mergeIntoServerCart,
/// llamado desde LoginScreen/RegisterScreen).
///
/// Solo se usa en kIsWeb (ver main.dart) -- la app nativa (Android/iOS)
/// sigue exigiendo login desde el arranque, sin cambios.
class GuestShellScreen extends StatefulWidget {
  const GuestShellScreen({super.key});
  @override
  State<GuestShellScreen> createState() => _GuestShellScreenState();
}

class _GuestShellScreenState extends State<GuestShellScreen> {
  int _tab = 0;
  List<Product> _products = [];
  bool _loading = true;
  String? _error;
  List<CartItem> _cart = [];
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _loadCart();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ApiService.getPublicProducts();
      if (mounted) setState(() => _products = list);
    } catch (_) {
      if (mounted) setState(() => _error = 'No se pudo cargar el catálogo.');
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadCart() async {
    final items = await GuestCartService.load();
    if (mounted) setState(() => _cart = items);
  }

  List<Product> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return _products;
    return _products.where((p) => p.name.toLowerCase().contains(q)).toList();
  }

  double get _total => _cart.fold(0, (s, i) => s + i.subtotal);

  Future<void> _addToCart(Product p) async {
    final items = await GuestCartService.add(
        productId: p.id!, productName: p.name, price: p.price);
    if (!mounted) return;
    setState(() => _cart = items);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text('${p.name} agregado al carrito'),
      duration: const Duration(milliseconds: 1200),
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<void> _setQty(int productId, int qty) async {
    final items = await GuestCartService.setQuantity(productId, qty);
    if (mounted) setState(() => _cart = items);
  }

  Future<void> _goToLogin() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const LoginScreen()));
    // Si el login no se completó (usuario volvió atrás), el carrito de
    // invitado sigue intacto y seguimos mostrando esta pantalla.
    await _loadCart();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('CONCENTRADOS MONSERRATH'),
        actions: [
          TextButton.icon(
            onPressed: _goToLogin,
            icon: const Icon(Icons.login_rounded, color: Colors.white),
            label: const Text('Iniciar sesión',
                style: TextStyle(color: Colors.white)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _tab == 0 ? _buildProducts(scheme) : _buildCart(scheme),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          const NavigationDestination(
              icon: Icon(Icons.storefront_rounded), label: 'Productos'),
          NavigationDestination(
            icon: Badge(
              label: Text('${_cart.length}'),
              isLabelVisible: _cart.isNotEmpty,
              child: const Icon(Icons.shopping_cart_rounded),
            ),
            label: 'Mi carrito',
          ),
        ],
      ),
    );
  }

  Widget _buildProducts(ColorScheme scheme) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return EmptyState(
          icon: Icons.error_outline_rounded,
          title: _error!,
          action: TextButton(
              onPressed: _loadProducts, child: const Text('Reintentar')));
    }
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: TextField(
          controller: _searchCtrl,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            hintText: 'Buscar producto...',
            prefixIcon: const Icon(Icons.search_rounded),
            filled: true,
            fillColor: Colors.grey.shade100,
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none),
          ),
        ),
      ),
      Expanded(
        child: _filtered.isEmpty
            ? const EmptyState(
                icon: Icons.search_off_rounded, title: 'Sin resultados')
            : GridView.builder(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  childAspectRatio: 0.66,
                ),
                itemCount: _filtered.length,
                itemBuilder: (_, i) =>
                    _GuestProductCard(product: _filtered[i], onAdd: _addToCart),
              ),
      ),
    ]);
  }

  Widget _buildCart(ColorScheme scheme) {
    if (_cart.isEmpty) {
      return EmptyState(
        icon: Icons.shopping_cart_outlined,
        title: 'Tu carrito está vacío',
        action: TextButton(
            onPressed: () => setState(() => _tab = 0),
            child: const Text('Ver productos')),
      );
    }
    return Column(children: [
      Expanded(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _cart.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final item = _cart[i];
            return Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.productName,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text('\$${item.price.toStringAsFixed(0)} c/u',
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.remove_circle_outline_rounded),
                  onPressed: () => _setQty(item.productId, item.quantity - 1),
                ),
                Text('${item.quantity}',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                IconButton(
                  icon: const Icon(Icons.add_circle_outline_rounded),
                  onPressed: () => _setQty(item.productId, item.quantity + 1),
                ),
                IconButton(
                  icon: Icon(Icons.delete_outline_rounded,
                      color: Colors.red.shade400),
                  onPressed: () => _setQty(item.productId, 0),
                ),
              ]),
            );
          },
        ),
      ),
      Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 12,
                offset: const Offset(0, -4))
          ],
        ),
        child: SafeArea(
          top: false,
          child: Row(children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total',
                      style:
                          TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  Text('\$${_total.toStringAsFixed(0)}',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: scheme.primary)),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: _goToLogin,
              icon: const Icon(Icons.lock_rounded, size: 18),
              label: const Text('Continuar con la compra'),
              style: FilledButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ]),
        ),
      ),
    ]);
  }
}

class _GuestProductCard extends StatelessWidget {
  final Product product;
  final ValueChanged<Product> onAdd;
  const _GuestProductCard({required this.product, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2))
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: product.images.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: ApiService.productImageUrl(product.images.first),
                  fit: BoxFit.cover,
                  width: double.infinity,
                  placeholder: (_, __) =>
                      Container(color: Colors.grey.shade100),
                  errorWidget: (_, __, ___) => Container(
                      color: Colors.grey.shade100,
                      child: const Icon(Icons.image_not_supported_rounded,
                          color: Colors.grey)),
                )
              : Container(
                  color: Colors.grey.shade100,
                  child: const Icon(Icons.storefront_rounded,
                      size: 32, color: Colors.grey)),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(product.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13, height: 1.3)),
            const SizedBox(height: 3),
            Text(productDescription(product),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: Colors.grey.shade600, fontSize: 10.5, height: 1.3)),
            const SizedBox(height: 6),
            Row(children: [
              Expanded(
                  child: Text('\$${product.price.toStringAsFixed(0)}',
                      style: TextStyle(
                          color: scheme.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 16))),
              AnimatedTapScale(
                onTap: () => onAdd(product),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                      color: scheme.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.add_shopping_cart_rounded,
                      color: Colors.white, size: 14),
                ),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}
