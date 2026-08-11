import 'dart:async';
import 'package:flutter/material.dart';
import '../models/product.dart';
import '../models/cart_item.dart';
import '../models/promotion.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class CartProvider extends ChangeNotifier {
  List<CartItem> _items = [];
  Promotion? _appliedPromo;
  int _deliveryFeeThreshold = 50000;
  int _deliveryFeeAmount = 4900;
  bool _isLoading = false;
  String? _promoError;

  List<CartItem> get items => _items;
  Promotion? get appliedPromo => _appliedPromo;
  bool get isLoading => _isLoading;
  String? get promoError => _promoError;

  int get itemCount {
    return _items.fold(0, (sum, item) => sum + item.quantity);
  }

  int get subtotal {
    return _items.fold(0, (sum, item) => sum + item.lineTotal);
  }

  int get deliveryFee {
    if (_items.isEmpty) return 0;
    return subtotal >= _deliveryFeeThreshold ? 0 : _deliveryFeeAmount;
  }

  int get discount {
    if (_appliedPromo == null) return 0;
    return _appliedPromo!.calculateDiscount(subtotal);
  }

  int get total {
    return subtotal + deliveryFee - discount;
  }

  CartProvider() {
    _loadCart();
  }

  Future<void> _loadCart() async {
    _items = await StorageService.getCart();
    notifyListeners();
  }

  Future<void> _saveCart() async {
    await StorageService.setCart(_items);
  }

  void addProduct(Product product, {int quantity = 1}) {
    if (!product.inStock) return;

    final existingIndex = _items.indexWhere((item) => item.product.id == product.id);
    if (existingIndex >= 0) {
      final existing = _items[existingIndex];
      final newQty = existing.quantity + quantity;
      if (newQty > product.stock) return;
      _items[existingIndex] = existing.copyWith(quantity: newQty);
    } else {
      if (quantity > product.stock) quantity = product.stock;
      _items.add(CartItem(product: product, quantity: quantity));
    }
    _saveCart();
    notifyListeners();
  }

  void removeProduct(int productId) {
    _items.removeWhere((item) => item.product.id == productId);
    _saveCart();
    notifyListeners();
  }

  void updateQty(int productId, int quantity) {
    final index = _items.indexWhere((item) => item.product.id == productId);
    if (index < 0) return;

    if (quantity <= 0) {
      _items.removeAt(index);
    } else {
      final item = _items[index];
      if (quantity > item.product.stock) quantity = item.product.stock;
      _items[index] = item.copyWith(quantity: quantity);
    }
    _saveCart();
    notifyListeners();
  }

  Future<void> clear() async {
    _items = [];
    _appliedPromo = null;
    _promoError = null;
    await StorageService.clearCart();
    notifyListeners();
  }

  Future<bool> applyPromo(String code) async {
    _promoError = null;
    _isLoading = true;
    notifyListeners();

    try {
      final response = await apiService.post(ApiEndpoints.validatePromo, {
        'code': code.trim(),
        'subtotal': subtotal,
      });

      final promoData = response['promotion'] ?? response['data'];
      _appliedPromo = Promotion.fromJson(promoData as Map<String, dynamic>);
      _promoError = null;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _promoError = e.message;
      _appliedPromo = null;
      notifyListeners();
      return false;
    } catch (e) {
      _promoError = 'Código de promoción inválido';
      _appliedPromo = null;
      notifyListeners();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void removePromo() {
    _appliedPromo = null;
    _promoError = null;
    notifyListeners();
  }

  void updateDeliverySettings({int? threshold, int? fee}) {
    if (threshold != null) _deliveryFeeThreshold = threshold;
    if (fee != null) _deliveryFeeAmount = fee;
    notifyListeners();
  }

  CartItem? getItem(int productId) {
    try {
      return _items.firstWhere((item) => item.product.id == productId);
    } catch (_) {
      return null;
    }
  }
}
