import 'package:flutter/material.dart';

class ProductProvider extends ChangeNotifier {
  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _promotions = [];
  bool _isLoading = false;

  List<Map<String, dynamic>> get products => _products;
  List<Map<String, dynamic>> get promotions => _promotions;
  bool get isLoading => _isLoading;

  Future<void> loadProducts() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Simulación de carga - reemplazar con llamada API real
      await Future.delayed(const Duration(seconds: 1));
      
      _products = [
        {
          'id': 1,
          'name': 'Leche Entera 1L',
          'price': 3.50,
          'image_url': 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500',
          'stock': 50,
          'description': 'Leche fresca de alta calidad',
          'is_promotion': false,
        },
        {
          'id': 2,
          'name': 'Pan Integral',
          'price': 2.00,
          'image_url': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500',
          'stock': 30,
          'description': 'Pan integral recién horneado',
          'is_promotion': true,
          'promo_type': 'percentage',
          'promo_value': 15,
        },
        {
          'id': 3,
          'name': 'Huevos Docena',
          'price': 4.50,
          'image_url': 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500',
          'stock': 100,
          'description': 'Huevos frescos de granja',
          'is_promotion': true,
          'promo_type': 'buy_x_get_y',
          'promo_value': 2, // 2x1
        },
      ];

      _promotions = _products.where((p) => p['is_promotion'] == true).toList();
    } catch (e) {
      print('Error loading products: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Map<String, dynamic>? getProductById(int id) {
    try {
      return _products.firstWhere((product) => product['id'] == id);
    } catch (e) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> searchProducts(String query) async {
    if (query.isEmpty) {
      return _products;
    }
    
    final lowercaseQuery = query.toLowerCase();
    return _products.where((product) {
      final name = product['name'].toString().toLowerCase();
      return name.contains(lowercaseQuery);
    }).toList();
  }

  // Filtrar productos que necesitan atención (poco stock o pocas ventas)
  List<Map<String, dynamic>> getProductsNeedingAttention() {
    return _products.where((product) {
      final stock = product['stock'] as int? ?? 0;
      return stock < 10; // Productos con menos de 10 unidades
    }).toList();
  }

  // Productos más vendidos (simulado)
  List<Map<String, dynamic>> getBestSellingProducts() {
    // En producción, esto vendría del backend basado en estadísticas reales
    return _products.take(3).toList();
  }
}