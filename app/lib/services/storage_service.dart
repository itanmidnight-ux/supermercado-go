import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';
import '../models/user.dart';
import '../models/cart_item.dart';

class StorageService {
  static SharedPreferences? _prefs;

  static Future<SharedPreferences> get _instance async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  static Future<String?> getToken() async {
    final prefs = await _instance;
    return prefs.getString('auth_token');
  }

  static Future<void> setToken(String token) async {
    final prefs = await _instance;
    await prefs.setString('auth_token', token);
  }

  static Future<void> removeToken() async {
    final prefs = await _instance;
    await prefs.remove('auth_token');
  }

  static Future<User?> getUser() async {
    final prefs = await _instance;
    final str = prefs.getString('user_data');
    if (str == null || str.isEmpty) return null;
    try {
      return User.fromJson(jsonDecode(str) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  static Future<void> setUser(User user) async {
    final prefs = await _instance;
    await prefs.setString('user_data', jsonEncode(user.toJson()));
  }

  static Future<void> removeUser() async {
    final prefs = await _instance;
    await prefs.remove('user_data');
  }

  static Future<String> getBaseUrl() async {
    final prefs = await _instance;
    return prefs.getString('base_url') ?? ApiEndpoints.baseUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await _instance;
    await prefs.setString('base_url', url);
  }

  static Future<List<CartItem>> getCart() async {
    final prefs = await _instance;
    final str = prefs.getString('cart_items');
    if (str == null || str.isEmpty) return [];
    try {
      final list = jsonDecode(str) as List;
      return list.map((e) => CartItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> setCart(List<CartItem> items) async {
    final prefs = await _instance;
    if (items.isEmpty) {
      await prefs.remove('cart_items');
    } else {
      await prefs.setString('cart_items', jsonEncode(items.map((e) => e.toJson()).toList()));
    }
  }

  static Future<void> clearCart() async {
    final prefs = await _instance;
    await prefs.remove('cart_items');
  }

  static Future<List<int>> getFavorites() async {
    final prefs = await _instance;
    final str = prefs.getString('favorites');
    if (str == null || str.isEmpty) return [];
    try {
      final list = jsonDecode(str) as List;
      return list.map((e) => e as int).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> setFavorites(List<int> ids) async {
    final prefs = await _instance;
    await prefs.setString('favorites', jsonEncode(ids));
  }

  static Future<void> clearAll() async {
    final prefs = await _instance;
    await prefs.clear();
  }
}
