import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../models/category.dart';
import '../../providers/product_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/app_drawer.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/loading_shimmer.dart';
import '../../widgets/product_card.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../main.dart' show Banner;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  int _currentNav = 0;
  String _searchQuery = '';
  List<Banner> _banners = [];
  int _bannerPage = 0;
  Timer? _bannerTimer;
  bool _loadingBanners = true;
  bool _expandedHowToBuy = false;
  late PageController _bannerController;
  String _operatingZone = 'Cúcuta';
  String _businessHours = AppStrings.businessHours;
  String _deliveryZoneInfo = '';

  @override
  void initState() {
    super.initState();
    _bannerController = PageController();
    _loadData();
    _loadBanners();
    _loadPublicSettings();
    _bannerTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_banners.isNotEmpty && mounted) {
        final nextPage = (_bannerPage + 1) % _banners.length;
        _bannerController.animateToPage(nextPage, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
      }
    });
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerController.dispose();
    super.dispose();
  }

  void _loadData() {
    final pp = context.read<ProductProvider>();
    pp.loadCategories();
    pp.loadProducts();
  }

  Future<void> _loadPublicSettings() async {
    try {
      final sp = context.read<SettingsProvider>();
      await sp.loadPublicSettings();
      if (mounted) setState(() {
        _operatingZone = sp.operatingZoneRadius > 0 ? '${AppStrings.businessCity} y zonas aledañas' : 'Cúcuta y zonas aledañas';
        _businessHours = sp.businessHours;
        _deliveryZoneInfo = 'Cobertura: ${AppStrings.businessCity} · Envío gratis en pedidos mayores a ${formatCOP(sp.freeDeliveryMin)}';
      });
    } catch (_) {}
  }

  Future<void> _loadBanners() async {
    try {
      final sp = context.read<SettingsProvider>();
      final baseUrl = sp.serverUrl;
      if (baseUrl.isEmpty) return;
      final resp = await http.get(Uri.parse('$baseUrl/api/banners'), headers: {'Content-Type': 'application/json'});
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        if (mounted) setState(() { _banners = (data['banners'] as List).map((j) => Banner.fromJson(j)).toList(); _loadingBanners = false; });
      } else { if (mounted) setState(() => _loadingBanners = false); }
    } catch (_) { if (mounted) setState(() => _loadingBanners = false); }
  }

  void _onNavTap(int index) {
    setState(() => _currentNav = index);
    if (index == 0) {
      context.read<ProductProvider>().loadProducts(refresh: true);
    } else if (index == 1) {
      // Categories placeholder
    } else if (index == 2) {
      Navigator.pushNamed(context, '/cart');
    } else if (index == 3) {
      Navigator.pushNamed(context, '/my-orders');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        title: GestureDetector(
          onTap: () => Navigator.pushNamed(context, '/search'),
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.search, color: Colors.white70, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Buscar productos...',
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: Colors.white),
            onPressed: () => Navigator.pushNamed(context, '/notifications'),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: Consumer<ProductProvider>(
        builder: (_, pp, __) {
          if (pp.isLoading && pp.products.isEmpty) {
            return const LoadingShimmer();
          }
          if (pp.error != null && pp.products.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text(pp.error!, style: const TextStyle(color: AppColors.error)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => pp.refresh(),
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () => pp.refresh(),
            child: CustomScrollView(
              slivers: [
                // ─── Banner Carousel ───
                if (_banners.isNotEmpty) _buildBannerCarousel(),
                if (_banners.isNotEmpty) const SliverToBoxAdapter(child: SizedBox(height: 16)),
                // ─── Categories ───
                _buildCategoriesRow(pp.categories),
                if (pp.categories.isNotEmpty) const SliverToBoxAdapter(child: SizedBox(height: 8)),
                // ─── Cómo comprar ───
                SliverToBoxAdapter(child: _buildHowToBuyCard()),
                const SliverToBoxAdapter(child: SizedBox(height: 12)),
                // ─── Zona de entrega ───
                SliverToBoxAdapter(child: _buildDeliveryZoneCard()),
                const SliverToBoxAdapter(child: SizedBox(height: 16)),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.65,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) {
                        if (i >= pp.products.length) {
                          if (pp.hasMore) {
                            pp.loadMore();
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                            );
                          }
                          return null;
                        }
                        final product = pp.products[i];
                        return ProductCard(
                          product: product,
                          onTap: () => Navigator.pushNamed(context, '/product', arguments: {'id': product.id}),
                          onAddToCart: () {
                            context.read<CartProvider>().addProduct(product);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('${product.name} agregado al carrito'), backgroundColor: AppColors.primary, duration: Duration(seconds: 1)),
                            );
                          },
                        );
                      },
                      childCount: pp.products.length + (pp.hasMore ? 1 : 0),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: BottomNavBar(currentIndex: _currentNav, onTap: _onNavTap),
    );
  }

  Widget _buildCategoriesRow(List<Category> categories) {
    if (categories.isEmpty) return const SliverToBoxAdapter.shrink();
    return SliverToBoxAdapter(
      child: SizedBox(
        height: 100,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: categories.length,
          itemBuilder: (_, i) {
            final cat = categories[i];
            return GestureDetector(
              onTap: () => Navigator.pushNamed(context, '/category', arguments: {'id': cat.id}),
              child: Container(
                width: 80,
                margin: const EdgeInsets.only(right: 10),
                child: Column(
                  children: [
                    Container(
                      width: 56, height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.category, color: AppColors.primary, size: 28),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      cat.name,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildBannerCarousel() {
    return SliverToBoxAdapter(
      child: Column(
        children: [
          SizedBox(
            height: 160,
            child: PageView.builder(
              controller: _bannerController,
              onPageChanged: (i) => setState(() => _bannerPage = i),
              itemCount: _banners.length,
              itemBuilder: (_, i) {
                final b = _banners[i];
                final bgColor = _tryParseColor(b.bgColor);
                final txtColor = _tryParseColor(b.textColor);
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(gradient: LinearGradient(colors: [bgColor, bgColor.withOpacity(0.8)]), borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: bgColor.withOpacity(0.3), blurRadius: 8)]),
                  child: b.imageUrl != null && b.imageUrl!.isNotEmpty
                      ? ClipRRect(borderRadius: BorderRadius.circular(14), child: CachedNetworkImage(imageUrl: b.imageUrl!, fit: BoxFit.cover))
                      : Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(b.title, style: TextStyle(color: txtColor, fontSize: 20, fontWeight: FontWeight.bold)),
                          if (b.subtitle != null) ...[const SizedBox(height: 6), Text(b.subtitle!, style: TextStyle(color: txtColor.withOpacity(0.9), fontSize: 14))],
                        ])),
                );
              },
            ),
          ),
          if (_banners.length > 1) Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_banners.length, (i) => Container(
                width: i == _bannerPage ? 20 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(3), color: i == _bannerPage ? AppColors.primary : AppColors.lightGray),
              )),
            ),
          ),
        ],
      ),
    );
  }

  Color _tryParseColor(String hex) {
    try { return Color(int.parse(hex.replaceFirst('#', '0xFF'))); } catch (_) { return AppColors.primary; }
  }

  Widget _buildHowToBuyCard() {
    final sp = context.read<SettingsProvider>();
    final steps = ['Regístrate con tu correo y teléfono', 'Agrega productos al carrito', 'Elige entrega a domicilio o recoger en tienda', 'Paga con el método que prefieras', '¡Recibe tu pedido!'];
    return Card(margin: const EdgeInsets.symmetric(horizontal: 12), child: Theme(data: Theme.of(context).copyWith(dividerColor: Colors.transparent), child: ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.help_outline, color: AppColors.primary)),
      title: const Text('¿Cómo comprar?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      trailing: Icon(_expandedHowToBuy ? Icons.expand_less : Icons.expand_more, color: AppColors.primary),
      onExpansionChanged: (v) => setState(() => _expandedHowToBuy = v),
      children: [Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Column(children: steps.asMap().entries.map((e) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 26, height: 26, margin: const EdgeInsets.only(right: 12), decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(13)), child: Center(child: Text('${e.key + 1}', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)))),
            Expanded(child: Text(e.value, style: const TextStyle(fontSize: 14, height: 1.4))),
          ]))).toList()))],
    )));
  }

  Widget _buildDeliveryZoneCard() {
    return Card(margin: const EdgeInsets.symmetric(horizontal: 12), child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => Navigator.pushNamed(context, '/help'),
      child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
        const Icon(Icons.delivery_dining, color: AppColors.primary, size: 32),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Zona de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 4),
          Text(_deliveryZoneInfo.isNotEmpty ? _deliveryZoneInfo : '$_operatingZone · $_businessHours', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ])),
        const Icon(Icons.chevron_right, color: AppColors.gray),
      ])),
    ));
  }
}
