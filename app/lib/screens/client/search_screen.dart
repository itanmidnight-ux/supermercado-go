import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/product.dart';
import '../../models/category.dart';
import '../../providers/product_provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/product_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/loading_shimmer.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  List<String> _recentSearches = [];
  int? _selectedCategoryId;
  int? _minPrice;
  int? _maxPrice;
  bool _onlyOffers = false;
  bool _hasSearched = false;
  bool _showFilters = false;

  @override
  void initState() {
    super.initState();
    _loadRecentSearches();
    _scrollController.addListener(_onScroll);
    final productProvider = Provider.of<ProductProvider>(context, listen: false);
    productProvider.loadCategories();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      final provider = context.read<ProductProvider>();
      if (provider.hasMore && !provider.isLoadingMore) {
        provider.loadMore();
      }
    }
  }

  Future<void> _loadRecentSearches() async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString('recent_searches');
    if (str != null && str.isNotEmpty) {
      try {
        final list = jsonDecode(str) as List;
        setState(() {
          _recentSearches = list.cast<String>();
        });
      } catch (_) {}
    }
  }

  Future<void> _saveRecentSearch(String query) async {
    if (query.trim().isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    _recentSearches.remove(query.trim());
    _recentSearches.insert(0, query.trim());
    if (_recentSearches.length > 10) {
      _recentSearches = _recentSearches.sublist(0, 10);
    }
    await prefs.setString('recent_searches', jsonEncode(_recentSearches));
    setState(() {});
  }

  Future<void> _clearRecentSearches() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('recent_searches');
    setState(() {
      _recentSearches = [];
    });
  }

  void _performSearch() {
    final query = _searchController.text.trim();
    if (query.isEmpty && _selectedCategoryId == null && !_onlyOffers) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa un término de búsqueda o selecciona un filtro')),
      );
      return;
    }
    _saveRecentSearch(query);
    setState(() {
      _hasSearched = true;
    });
    final provider = context.read<ProductProvider>();
    provider.loadProducts(
      search: query.isNotEmpty ? query : null,
      categoryId: _selectedCategoryId,
      offer: _onlyOffers ? true : null,
      refresh: true,
    );
    _focusNode.unfocus();
  }

  void _clearFilters() {
    setState(() {
      _selectedCategoryId = null;
      _minPrice = null;
      _maxPrice = null;
      _onlyOffers = false;
    });
  }

  void _applyPriceFilter(int? min, int? max) {
    setState(() {
      _minPrice = min;
      _maxPrice = max;
    });
  }

  List<Product> _applyLocalFilters(List<Product> products) {
    var filtered = products;
    if (_minPrice != null) {
      filtered = filtered.where((p) => p.effectivePrice >= _minPrice!).toList();
    }
    if (_maxPrice != null) {
      filtered = filtered.where((p) => p.effectivePrice <= _maxPrice!).toList();
    }
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        title: TextField(
          controller: _searchController,
          focusNode: _focusNode,
          autofocus: true,
          style: const TextStyle(color: Colors.white, fontSize: 16),
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _performSearch(),
          decoration: InputDecoration(
            hintText: 'Buscar productos...',
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.7)),
            border: InputBorder.none,
            filled: false,
            suffixIcon: _searchController.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear, color: Colors.white, size: 20),
                    onPressed: () {
                      _searchController.clear();
                      setState(() {});
                    },
                  )
                : null,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(_showFilters ? Icons.filter_list_off : Icons.filter_list),
            onPressed: () {
              setState(() {
                _showFilters = !_showFilters;
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: _performSearch,
          ),
        ],
      ),
      body: Column(
        children: [
          if (_showFilters) _buildFilterChips(),
          if (_hasSearched || _selectedCategoryId != null || _onlyOffers)
            Expanded(child: _buildSearchResults())
          else
            Expanded(child: _buildRecentSearches()),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Filtros:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const Spacer(),
              if (_selectedCategoryId != null ||
                  _minPrice != null ||
                  _maxPrice != null ||
                  _onlyOffers)
                GestureDetector(
                  onTap: _clearFilters,
                  child: const Text(
                    'Limpiar',
                    style: TextStyle(color: AppColors.accent, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Consumer<ProductProvider>(
            builder: (_, provider, __) {
              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildChip(
                      label: 'Solo ofertas',
                      selected: _onlyOffers,
                      onSelected: () {
                        setState(() => _onlyOffers = !_onlyOffers);
                      },
                      color: AppColors.accent,
                    ),
                    const SizedBox(width: 6),
                    _buildChip(
                      label: 'Hasta ${formatCOP(10000)}',
                      selected: _maxPrice == 10000,
                      onSelected: () {
                        _applyPriceFilter(null, _maxPrice == 10000 ? null : 10000);
                      },
                    ),
                    const SizedBox(width: 6),
                    _buildChip(
                      label: 'Hasta ${formatCOP(25000)}',
                      selected: _maxPrice == 25000,
                      onSelected: () {
                        _applyPriceFilter(null, _maxPrice == 25000 ? null : 25000);
                      },
                    ),
                    const SizedBox(width: 6),
                    _buildChip(
                      label: 'Hasta ${formatCOP(50000)}',
                      selected: _maxPrice == 50000,
                      onSelected: () {
                        _applyPriceFilter(null, _maxPrice == 50000 ? null : 50000);
                      },
                    ),
                    const SizedBox(width: 6),
                    _buildChip(
                      label: '${formatCOP(50000)}+',
                      selected: _minPrice == 50000,
                      onSelected: () {
                        _applyPriceFilter(_minPrice == 50000 ? null : 50000, null);
                      },
                    ),
                    const SizedBox(width: 6),
                    ...provider.categories.map((cat) => Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: _buildChip(
                        label: cat.name,
                        selected: _selectedCategoryId == cat.id,
                        onSelected: () {
                          setState(() {
                            _selectedCategoryId =
                                _selectedCategoryId == cat.id ? null : cat.id;
                          });
                        },
                        color: AppColors.primaryDark,
                      ),
                    )),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required String label,
    required bool selected,
    required VoidCallback onSelected,
    Color? color,
  }) {
    final chipColor = color ?? AppColors.primary;
    return FilterChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: selected ? Colors.white : AppColors.textSecondary)),
      selected: selected,
      onSelected: (_) => onSelected(),
      backgroundColor: AppColors.lightGray,
      selectedColor: chipColor,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      side: BorderSide(color: selected ? chipColor : AppColors.lightGray),
    );
  }

  Widget _buildRecentSearches() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_recentSearches.isNotEmpty) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Búsquedas recientes',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
              TextButton(
                onPressed: _clearRecentSearches,
                child: const Text('Limpiar'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ..._recentSearches.map((search) => ListTile(
                leading: const Icon(Icons.history, color: AppColors.gray),
                title: Text(search),
                trailing: const Icon(Icons.north_west, size: 16, color: AppColors.gray),
                onTap: () {
                  _searchController.text = search;
                  setState(() {});
                  _performSearch();
                },
              )),
          const Divider(height: 32),
        ],
        const Text(
          'Busca entre cientos de productos',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            'Frutas', 'Verduras', 'Lácteos', 'Carnes', 'Bebidas',
            'Aseo', 'Snacks', 'Panadería', 'Despensa', 'Congelados'
          ].map((suggestion) => ActionChip(
            label: Text(suggestion),
            onPressed: () {
              _searchController.text = suggestion;
              setState(() {});
              _performSearch();
            },
          )).toList(),
        ),
      ],
    );
  }

  Widget _buildSearchResults() {
    return Consumer<ProductProvider>(
      builder: (_, provider, __) {
        if (provider.isLoading) {
          return const LoadingShimmer();
        }

        if (provider.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                Text(provider.error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _performSearch,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          );
        }

        final filtered = _applyLocalFilters(provider.products);

        if (filtered.isEmpty) {
          return EmptyState(
            icon: Icons.search_off,
            title: 'Sin resultados',
            subtitle: 'No encontramos productos con esa búsqueda. Intenta con otros términos.',
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            await provider.refresh();
          },
          child: GridView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.65,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: filtered.length + (provider.isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index >= filtered.length) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                );
              }
              final product = filtered[index];
              return ProductCard(
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
              );
            },
          ),
        );
      },
    );
  }
}
