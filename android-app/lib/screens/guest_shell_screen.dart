import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../services/guest_cart_service.dart';
import '../utils/product_description.dart';
import '../widgets/animated_tap_scale.dart';
import '../widgets/app_logo.dart';
import '../widgets/empty_state.dart';
import 'login_screen.dart';
import 'client_product_detail.dart';

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
  final _searchFocus = FocusNode();
  final ValueNotifier<double> _scrollOffset = ValueNotifier(0);
  bool _searchFocused = false;

  @override
  void initState() {
    super.initState();
    _searchFocus.addListener(() {
      if (mounted) setState(() => _searchFocused = _searchFocus.hasFocus);
    });
    _loadProducts();
    _loadCart();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchFocus.dispose();
    _scrollOffset.dispose();
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
    final w = MediaQuery.of(context).size.width;
    final isDesktop = w >= 768;
    final _navTabs = ['Productos', 'Mi carrito', 'Políticas', 'Contacto'];

    return Scaffold(
      appBar: isDesktop
          ? PreferredSize(
              preferredSize: const Size.fromHeight(64),
              child: _WebHeader(
                scrollOffset: _scrollOffset,
                cartCount: _cart.length,
                tab: _tab,
                navTabs: _navTabs,
                scheme: scheme,
                searchCtrl: _searchCtrl,
                searchFocus: _searchFocus,
                searchFocused: _searchFocused,
                onTab: (i) => setState(() => _tab = i),
                onSearchChanged: (_) {
                  setState(() {});
                  if (_tab != 0) setState(() => _tab = 0);
                },
                onCart: () => setState(() => _tab = 1),
                onLogin: _goToLogin,
              ),
            )
          : AppBar(
              title: Row(mainAxisSize: MainAxisSize.min, children: const [
                AppLogo(size: 30, animate: false),
                SizedBox(width: 8),
                Text('Supermercado GO',
                    style: TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 16)),
              ]),
              actions: [
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: _goToLogin,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.login_rounded,
                              size: 16, color: scheme.primary),
                          const SizedBox(width: 5),
                          Text('Ingresar',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: scheme.primary)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
      body: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          _scrollOffset.value = n.metrics.pixels.clamp(0, double.infinity);
          return false;
        },
        child: _tab == 0
            ? _buildProducts(scheme)
            : _tab == 1
                ? _buildCart(scheme)
                : _tab == 2
                    ? _buildPolicies(scheme)
                    : _buildContact(scheme),
      ),
      bottomNavigationBar: isDesktop
          ? null
          : NavigationBar(
              selectedIndex: _tab > 1 ? 0 : _tab,
              onDestinationSelected: (i) => setState(() => _tab = i),
              destinations: [
                const NavigationDestination(
                    icon: Icon(Icons.storefront_rounded),
                    label: 'Productos'),
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
    final w = MediaQuery.of(context).size.width;
    final isDesktop = w >= 1024;
    final cols = w < 480 ? 2 : w < 768 ? 3 : w < 1024 ? 4 : 5;
    final ratio = w < 480 ? 0.66 : 0.72;
    final mobilePadding = EdgeInsets.fromLTRB(16, 12, 16, 8);
    return Column(children: [
      if (isDesktop)
        const SizedBox(height: 12)
      else
        Padding(
          padding: mobilePadding,
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
            : Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1280),
                  child: GridView.builder(
                    padding: EdgeInsets.fromLTRB(
                        isDesktop ? 24 : 16, 4, isDesktop ? 24 : 16, 24),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: cols,
                      mainAxisSpacing: isDesktop ? 16 : 14,
                      crossAxisSpacing: isDesktop ? 16 : 14,
                      childAspectRatio: isDesktop ? 0.78 : ratio,
                    ),
                    itemCount: _filtered.length,
                    itemBuilder: (_, i) => GestureDetector(
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => ClientProductDetail(
                                  product: _filtered[i],
                                  description:
                                      productDescription(_filtered[i])))),
                      child: _GuestProductCard(
                          product: _filtered[i], onAdd: _addToCart),
                    ),
                  ),
                ),
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

  Widget _buildPolicies(ColorScheme scheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Políticas de la tienda',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text('Última actualización: Julio 2026',
            style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
        const SizedBox(height: 24),
        _PolicySection(
          icon: Icons.local_shipping_rounded,
          title: 'Envíos y entregas',
          body:
              'Realizamos entregas en Cúcuta y área metropolitana. El '
              'domicilio es gratuito para pedidos superiores a \$50,000. '
              'Los pedidos se entregan el mismo día si se solicitan antes '
              'de las 4:00 PM. Para pedidos con pago contra entrega, '
              'compartir tu ubicación en tiempo real es obligatorio.',
        ),
        const SizedBox(height: 16),
        _PolicySection(
          icon: Icons.payments_rounded,
          title: 'Métodos de pago',
          body:
              'Aceptamos Nequi, tarjeta Visa, y pago contra entrega '
              '(solo con ubicación en tiempo real). Los pagos con Nequi '
              'y Visa se confirman de inmediato con la referencia de pago. '
              'No manejamos crédito ni fiado en compras por internet.',
        ),
        const SizedBox(height: 16),
        _PolicySection(
          icon: Icons.assignment_return_rounded,
          title: 'Cambios y devoluciones',
          body:
              'Aceptamos cambios dentro de las 24 horas siguientes a la '
              'entrega. El producto debe estar en su empaque original y '
              'en buen estado. Los productos perecederos no aplican para '
              'devolución a menos que lleguen en mal estado.',
        ),
        const SizedBox(height: 16),
        _PolicySection(
          icon: Icons.privacy_tip_rounded,
          title: 'Privacidad de datos',
          body:
              'Tus datos personales están protegidos y nunca serán '
              'compartidos con terceros. Usamos encriptación SSL para '
              'todas las transacciones. No almacenamos información de '
              'tarjetas de crédito en nuestros servidores.',
        ),
      ]),
    );
  }

  Widget _buildContact(ColorScheme scheme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Contacto',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                  color: Colors.black12,
                  blurRadius: 12,
                  offset: Offset(0, 4))
            ],
          ),
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            _ContactRow(
                icon: Icons.chat_rounded,
                label: 'WhatsApp',
                value: '+57 300 123 4567',
                color: const Color(0xFF25D366)),
            const Divider(height: 20),
            _ContactRow(
                icon: Icons.phone_rounded,
                label: 'Teléfono',
                value: '+57 (7) 123 4567',
                color: scheme.primary),
            const Divider(height: 20),
            _ContactRow(
                icon: Icons.email_rounded,
                label: 'Email',
                value: 'contacto@supermercadogo.com.co',
                color: const Color(0xFFD44638)),
            const Divider(height: 20),
            _ContactRow(
                icon: Icons.access_time_rounded,
                label: 'Horario de atención',
                value: 'Lun - Sáb: 7:00 AM - 8:00 PM\nDom: 8:00 AM - 2:00 PM',
                color: const Color(0xFF1A1A2E)),
          ]),
        ),
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(children: [
            const Text('Supermercado GO',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('Tu tienda de confianza en Cúcuta',
                style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
            const SizedBox(height: 12),
            Text(
                'Calle 13 # 8-45, Centro\nCúcuta, Norte de Santander\nColombia',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
          ]),
        ),
      ]),
    );
  }
}

class _PolicySection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  const _PolicySection({
    required this.icon,
    required this.title,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: scheme.primary, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 15)),
            const SizedBox(height: 4),
            Text(body,
                style: TextStyle(
                    color: Colors.grey.shade600,
                    fontSize: 13,
                    height: 1.5)),
          ]),
        ),
      ]),
    );
  }
}

class _ContactRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _ContactRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) => Row(children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            Text(label,
                style: TextStyle(
                    color: Colors.grey.shade500, fontSize: 11)),
            const SizedBox(height: 2),
            Text(value,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14)),
          ]),
        ),
      ]);
}

class _GuestProductCard extends StatelessWidget {
  final Product product;
  final ValueChanged<Product> onAdd;
  const _GuestProductCard({required this.product, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 280),
      child: Container(
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
                ? Hero(
                    tag: 'product-image-${product.id}',
                    child: CachedNetworkImage(
                        imageUrl:
                            ApiService.productImageUrl(product.images.first),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        placeholder: (_, __) =>
                            _imgPlaceholder(scheme),
                        errorWidget: (_, __, ___) =>
                            _imgPlaceholder(scheme)))
                : _imgPlaceholder(scheme),
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
      ),
    );
  }

  static Widget _imgPlaceholder(ColorScheme scheme) {
    return Container(
      color: scheme.primary.withValues(alpha: 0.08),
      child: Center(
        child: Icon(Icons.inventory_2_rounded,
            size: 36, color: scheme.primary.withValues(alpha: 0.3)),
      ),
    );
  }
}

class _WebHeader extends StatelessWidget {
  final ValueNotifier<double> scrollOffset;
  final int cartCount;
  final int tab;
  final List<String> navTabs;
  final ColorScheme scheme;
  final TextEditingController searchCtrl;
  final FocusNode searchFocus;
  final bool searchFocused;
  final ValueChanged<int> onTab;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback onCart;
  final VoidCallback onLogin;

  const _WebHeader({
    required this.scrollOffset,
    required this.cartCount,
    required this.tab,
    required this.navTabs,
    required this.scheme,
    required this.searchCtrl,
    required this.searchFocus,
    required this.searchFocused,
    required this.onTab,
    required this.onSearchChanged,
    required this.onCart,
    required this.onLogin,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: scrollOffset,
      builder: (_, offset, __) {
        final scrolled = offset > 12;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          height: 64,
          decoration: BoxDecoration(
            color: scrolled
                ? Colors.white
                : Colors.white.withValues(alpha: 0.92),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: scrolled ? 0.08 : 0.02),
                blurRadius: scrolled ? 12 : 4,
                offset: const Offset(0, 2),
              ),
            ],
            border: Border(
              bottom: BorderSide(
                color: scrolled ? Colors.grey.shade200 : Colors.transparent,
                width: 1,
              ),
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(children: [
            Row(mainAxisSize: MainAxisSize.min, children: const [
              AppLogo(size: 30, animate: false),
              SizedBox(width: 10),
              Text('Supermercado GO',
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      color: Color(0xFF1A1A2E),
                      letterSpacing: -0.3)),
            ]),
            const SizedBox(width: 20),
            for (var i = 0; i < navTabs.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor:
                        tab == i ? scheme.primary : const Color(0xFF4A4A4A),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                  ),
                  onPressed: () => onTab(i),
                  child: Text(navTabs[i],
                      style: TextStyle(
                          fontWeight: tab == i
                              ? FontWeight.w700
                              : FontWeight.w500,
                          fontSize: 13)),
                ),
              ),
            const Spacer(),
            ConstrainedBox(
              constraints:
                  BoxConstraints(maxWidth: searchFocused ? 600 : 460),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 240),
                curve: Curves.easeOut,
                height: 42,
                child: TextField(
                  controller: searchCtrl,
                  focusNode: searchFocus,
                  onChanged: onSearchChanged,
                  decoration: InputDecoration(
                    hintText: 'Buscar producto...',
                    hintStyle: const TextStyle(fontSize: 13),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    filled: true,
                    fillColor:
                        searchFocused ? Colors.white : Colors.grey.shade100,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: BorderSide(
                        color: searchFocused
                            ? scheme.primary.withValues(alpha: 0.4)
                            : Colors.transparent,
                        width: 1,
                      ),
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide:
                          BorderSide(color: scheme.primary, width: 2),
                    ),
                  ),
                ),
              ),
            ),
            const Spacer(),
            Stack(clipBehavior: Clip.none, children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined),
                color:
                    tab == 1 ? scheme.primary : const Color(0xFF4A4A4A),
                onPressed: onCart,
              ),
              if (cartCount > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: TweenAnimationBuilder<double>(
                    key: ValueKey('badge-$cartCount'),
                    tween: Tween(begin: 0.4, end: 1.0),
                    duration: const Duration(milliseconds: 320),
                    curve: Curves.elasticOut,
                    builder: (_, scale, child) =>
                        Transform.scale(scale: scale, child: child),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                          color: scheme.primary, shape: BoxShape.circle),
                      child: Text('$cartCount',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
            ]),
            const SizedBox(width: 4),
            TextButton.icon(
              onPressed: onLogin,
              icon: const Icon(Icons.login_rounded, size: 18),
              label: const Text('Ingresar'),
              style: TextButton.styleFrom(foregroundColor: scheme.primary),
            ),
          ]),
        );
      },
    );
  }
}
