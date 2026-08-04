import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../services/api_service.dart';
import '../../services/storage_service.dart';
import '../../widgets/product_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_shimmer.dart';
import '../../utils/constants.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  List<Product> _favorites = [];
  List<int> _favoriteIds = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _favoriteIds = await StorageService.getFavorites();

      if (_favoriteIds.isEmpty) {
        setState(() {
          _favorites = [];
          _isLoading = false;
        });
        return;
      }

      final List<Product> loaded = [];
      for (final id in _favoriteIds) {
        try {
          final response = await apiService.get(ApiEndpoints.product(id.toString()));
          final data = response['data'] ?? response['product'] ?? response;
          loaded.add(Product.fromJson(data as Map<String, dynamic>));
        } catch (_) {
          // Skip products that fail to load
        }
      }

      setState(() {
        _favorites = loaded;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar favoritos';
        _isLoading = false;
      });
    }
  }

  Future<void> _removeFromFavorites(int productId) async {
    final newIds = _favoriteIds.where((id) => id != productId).toList();
    await StorageService.setFavorites(newIds);
    setState(() {
      _favoriteIds = newIds;
      _favorites.removeWhere((p) => p.id == productId);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Eliminado de favoritos'), backgroundColor: AppColors.primary),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mis favoritos'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _isLoading
          ? const LoadingShimmer()
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadFavorites,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _favorites.isEmpty
                  ? EmptyState(
                      icon: Icons.favorite_border,
                      title: 'Sin favoritos',
                      subtitle: 'Agrega productos a tus favoritos tocando el icono de corazón en cada producto.',
                      buttonText: 'Explorar productos',
                      onButtonPressed: () => Navigator.pushNamedAndRemoveUntil(context, '/home', (_) => false),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadFavorites,
                      child: GridView.builder(
                        padding: const EdgeInsets.all(12),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.65,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                        itemCount: _favorites.length,
                        itemBuilder: (context, index) {
                          final product = _favorites[index];
                          return Stack(
                            children: [
                              ProductCard(
                                product: product,
                                onTap: () {
                                  Navigator.pushNamed(context, '/product', arguments: product.id);
                                },
                                onAddToCart: () {
                                  context.read<CartProvider>().addProduct(product);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('${product.name} agregado al carrito'),
                                      backgroundColor: AppColors.primary,
                                      duration: const Duration(seconds: 2),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                },
                              ),
                              Positioned(
                                top: 4,
                                right: 4,
                                child: GestureDetector(
                                  onTap: () => _removeFromFavorites(product.id),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          blurRadius: 4,
                                          offset: const Offset(0, 2),
                                          color: Colors.black.withOpacity(0.15),
                                        ),
                                      ],
                                    ),
                                    padding: const EdgeInsets.all(4),
                                    child: const Icon(
                                      Icons.favorite,
                                      color: AppColors.error,
                                      size: 20,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
    );
  }
}
