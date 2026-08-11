import 'dart:async';
import 'package:flutter/material.dart';
import '../models/product.dart';
import '../models/category.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class ProductProvider extends ChangeNotifier {
  List<Product> _products = [];
  List<Category> _categories = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  String? _searchQuery;
  int _currentPage = 1;
  int _totalPages = 1;
  int? _currentCategoryId;
  bool _onlyOffers = false;
  Product? _selectedProduct;
  bool _isLoadingDetail = false;

  List<Product> get products => _products;
  List<Category> get categories => _categories;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  String? get error => _error;
  String? get searchQuery => _searchQuery;
  Product? get selectedProduct => _selectedProduct;
  bool get isLoadingDetail => _isLoadingDetail;
  bool get hasMore => _currentPage < _totalPages;

  Future<void> loadCategories() async {
    try {
      final response = await apiService.get(ApiEndpoints.categories);
      final data = response['data'] ?? response['categories'] ?? (response is List ? response : [response]);
      if (data is List) {
        _categories = data.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map) {
        final items = data['items'] ?? data['data'] ?? data['categories'];
        if (items is List) {
          _categories = items.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
      notifyListeners();
    } catch (e) {
      // Silently fail for categories
    }
  }

  Future<void> loadProducts({
    int? categoryId,
    String? search,
    bool? offer,
    int page = 1,
    bool refresh = false,
  }) async {
    if (refresh) {
      _products = [];
      _currentPage = 1;
    }

    if (page == 1) {
      _isLoading = true;
      _error = null;
      _searchQuery = search;
      _currentCategoryId = categoryId;
      _onlyOffers = offer ?? false;
      notifyListeners();
    } else {
      _isLoadingMore = true;
      notifyListeners();
    }

    try {
      final queryParams = <String, String>{};
      queryParams['page'] = page.toString();
      if (categoryId != null) queryParams['category_id'] = categoryId.toString();
      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (offer == true) queryParams['offer'] = 'true';

      final response = await apiService.get(ApiEndpoints.products, queryParams: queryParams);

      List<Product> parsed = [];
      final data = response['data'] ?? response;
      if (data is List) {
        parsed = data.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map) {
        final items = data['items'] ?? data['products'] ?? data['data'];
        if (items is List) {
          parsed = items.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
        }
        final meta = data['meta'] ?? data['pagination'];
        if (meta is Map) {
          _totalPages = meta['total_pages'] ?? meta['last_page'] ?? 1;
        }
      }

      _currentPage = page;
      if (page == 1) {
        _products = parsed;
      } else {
        _products.addAll(parsed);
      }
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Error al cargar productos';
    } finally {
      _isLoading = false;
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    if (_isLoadingMore || !hasMore) return;
    await loadProducts(
      categoryId: _currentCategoryId,
      search: _searchQuery,
      offer: _onlyOffers ? true : null,
      page: _currentPage + 1,
    );
  }

  Future<void> loadProduct(int id) async {
    _isLoadingDetail = true;
    _selectedProduct = null;
    notifyListeners();

    try {
      final response = await apiService.get(ApiEndpoints.product(id.toString()));
      final data = response['data'] ?? response['product'] ?? response;
      _selectedProduct = Product.fromJson(data as Map<String, dynamic>);
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Error al cargar producto';
    } finally {
      _isLoadingDetail = false;
      notifyListeners();
    }
  }

  Future<void> searchProducts(String query) async {
    await loadProducts(search: query);
  }

  Future<void> refresh() async {
    await loadProducts(
      categoryId: _currentCategoryId,
      search: _searchQuery,
      offer: _onlyOffers ? true : null,
      refresh: true,
    );
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
