import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cart_item.dart';
import 'api_service.dart';

/// Carrito de invitado -- solo para el sitio web (kIsWeb), antes de iniciar
/// sesión. Se guarda en shared_preferences (localStorage en web) en vez de
/// LocalDB/sqflite, que no existe en Flutter Web. Al iniciar sesión
/// exitosamente, [mergeIntoServerCart] envía cada línea al carrito real del
/// servidor y limpia el carrito de invitado.
class GuestCartService {
  static const _key = 'guest_cart_v1';

  static Future<List<CartItem>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((j) => CartItem.fromJson(j)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _save(List<CartItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(items
          .map((i) => {
                'product_id': i.productId,
                'product_name': i.productName,
                'price': i.price,
                'quantity': i.quantity,
              })
          .toList()),
    );
  }

  static Future<List<CartItem>> add(
      {required int productId,
      required String productName,
      required double price,
      int quantity = 1}) async {
    final items = await load();
    final existing = items.where((i) => i.productId == productId).toList();
    if (existing.isNotEmpty) {
      existing.first.quantity += quantity;
    } else {
      items.add(CartItem(
          productId: productId,
          productName: productName,
          price: price,
          quantity: quantity));
    }
    await _save(items);
    return items;
  }

  static Future<List<CartItem>> remove(int productId) async {
    final items = await load();
    items.removeWhere((i) => i.productId == productId);
    await _save(items);
    return items;
  }

  static Future<List<CartItem>> setQuantity(int productId, int quantity) async {
    final items = await load();
    if (quantity <= 0) {
      items.removeWhere((i) => i.productId == productId);
    } else {
      for (final i in items) {
        if (i.productId == productId) i.quantity = quantity;
      }
    }
    await _save(items);
    return items;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  /// Se llama justo después de un login exitoso: sincroniza cada línea del
  /// carrito de invitado con el carrito real del servidor y limpia el local.
  static Future<void> mergeIntoServerCart() async {
    final items = await load();
    for (final item in items) {
      try {
        await ApiService.addToCart(item.productId, item.quantity);
      } catch (_) {
        // Un producto individual fallando (ej. ya no existe) no debe
        // frenar la fusión del resto del carrito de invitado.
      }
    }
    await clear();
  }
}
