import 'package:flutter/material.dart';

class CartProvider extends ChangeNotifier {
  final List<Map<String, dynamic>> _items = [];
  String? _deliveryType; // 'location' o 'address'
  String? _deliveryAddress;
  double? _lat;
  double? _lng;
  String? _paymentMethod;

  List<Map<String, dynamic>> get items => _items;
  String? get deliveryType => _deliveryType;
  String? get deliveryAddress => _deliveryAddress;
  double? get lat => _lat;
  double? get lng => _lng;
  String? get paymentMethod => _paymentMethod;

  double get total {
    return _items.fold(0, (sum, item) {
      return sum + (item['price'] * item['quantity']);
    });
  }

  int get itemCount {
    return _items.fold(0, (sum, item) => sum + item['quantity']);
  }

  void addItem(Map<String, dynamic> product, {int quantity = 1}) {
    final existingIndex = _items.indexWhere(
      (item) => item['id'] == product['id'],
    );

    if (existingIndex != -1) {
      _items[existingIndex]['quantity'] += quantity;
    } else {
      _items.add({
        ...product,
        'quantity': quantity,
      });
    }
    
    notifyListeners();
  }

  void removeItem(int productId) {
    _items.removeWhere((item) => item['id'] == productId);
    notifyListeners();
  }

  void updateQuantity(int productId, int quantity) {
    final index = _items.indexWhere((item) => item['id'] == productId);
    if (index != -1) {
      if (quantity <= 0) {
        removeItem(productId);
      } else {
        _items[index]['quantity'] = quantity;
        notifyListeners();
      }
    }
  }

  void clearCart() {
    _items.clear();
    _deliveryType = null;
    _deliveryAddress = null;
    _lat = null;
    _lng = null;
    _paymentMethod = null;
    notifyListeners();
  }

  void setDeliveryInfo({
    required String type,
    String? address,
    double? lat,
    double? lng,
  }) {
    _deliveryType = type;
    _deliveryAddress = address;
    _lat = lat;
    _lng = lng;
    notifyListeners();
  }

  void setPaymentMethod(String method) {
    _paymentMethod = method;
    notifyListeners();
  }

  bool get canUseCashOnDelivery {
    // Solo permitir pago contra entrega si se compartió ubicación en tiempo real
    return _deliveryType == 'location' && _lat != null && _lng != null;
  }
}