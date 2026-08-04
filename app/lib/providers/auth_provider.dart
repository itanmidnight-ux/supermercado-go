import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../utils/constants.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  bool _isLoading = false;
  bool _isAuthenticated = false;
  String? _error;
  bool _mustChangePassword = false;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get error => _error;
  bool get mustChangePassword => _mustChangePassword;
  String get userRole => _user?.role ?? 'client';

  AuthProvider() {
    loadUser();
  }

  Future<void> loadUser() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await StorageService.getToken();
      if (token == null || token.isEmpty) {
        _isAuthenticated = false;
        _isLoading = false;
        notifyListeners();
        return;
      }

      final response = await apiService.get(ApiEndpoints.me);
      final userData = response['user'] ?? response['data'] ?? response;
      _user = User.fromJson(userData as Map<String, dynamic>);
      await StorageService.setUser(_user!);
      _isAuthenticated = true;
      _mustChangePassword = _user!.mustChangePassword;
      _error = null;
    } catch (e) {
      _isAuthenticated = false;
      _user = null;
      _error = null;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await apiService.post(ApiEndpoints.login, {
        'email': email.trim(),
        'password': password,
      });

      final token = response['token'] as String;
      final userData = response['user'] ?? response;
      _user = User.fromJson(userData as Map<String, dynamic>);

      await StorageService.setToken(token);
      await StorageService.setUser(_user!);

      _isAuthenticated = true;
      _mustChangePassword = _user!.mustChangePassword;
      _error = null;
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isAuthenticated = false;
      return false;
    } catch (e) {
      _error = 'Error al iniciar sesión';
      _isAuthenticated = false;
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> register(String name, String email, String phone, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await apiService.post(ApiEndpoints.register, {
        'name': name.trim(),
        'email': email.trim(),
        'phone': phone.trim(),
        'password': password,
        'role': 'client',
      });

      final token = response['token'] as String?;
      if (token != null) {
        final userData = response['user'] ?? response;
        _user = User.fromJson(userData as Map<String, dynamic>);
        await StorageService.setToken(token);
        await StorageService.setUser(_user!);
        _isAuthenticated = true;
      }

      _error = null;
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al registrar';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _user = null;
    _isAuthenticated = false;
    _mustChangePassword = false;
    _error = null;
    await StorageService.removeToken();
    await StorageService.removeUser();
    await StorageService.clearCart();
    notifyListeners();
  }

  Future<bool> updateProfile(Map<String, dynamic> data) async {
    try {
      final response = await apiService.put(ApiEndpoints.me, data);
      final userData = response['user'] ?? response['data'] ?? response;
      _user = User.fromJson(userData as Map<String, dynamic>);
      await StorageService.setUser(_user!);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al actualizar perfil';
      return false;
    }
  }

  Future<bool> changePassword(String oldPassword, String newPassword) async {
    try {
      await apiService.post(ApiEndpoints.changePassword, {
        'old_password': oldPassword,
        'new_password': newPassword,
      });
      _mustChangePassword = false;
      if (_user != null) {
        _user = _user!.copyWith(mustChangePassword: false);
        await StorageService.setUser(_user!);
      }
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al cambiar contraseña';
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  String getHomeRoute() {
    switch (_user?.role) {
      case 'admin':
        return '/admin/dashboard';
      case 'worker':
        return '/worker/home';
      default:
        return '/home';
    }
  }
}
