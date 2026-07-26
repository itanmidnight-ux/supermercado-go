import 'package:flutter/material.dart';

class AuthProvider extends ChangeNotifier {
  bool _isLoggedIn = false;
  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic>? _user;

  bool get isLoggedIn => _isLoggedIn;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic>? get user => _user;

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await Future.delayed(const Duration(seconds: 1));
      
      // Simulación de llamada API - reemplazar con llamada real
      // final response = await http.post(
      //   Uri.parse('http://your-server.com/login'),
      //   body: jsonEncode({'email': email, 'password': password}),
      // );

      _isLoggedIn = true;
      _user = {
        'email': email,
        'role': 'client', // Esto vendría del backend
        'name': 'Usuario',
      };
      
      return true;
    } catch (e) {
      _errorMessage = 'Error de conexión. Verifique su internet.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String name,
    required String phone,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Simulación de llamada API - reemplazar con llamada real
      await Future.delayed(const Duration(seconds: 1));
      
      _isLoggedIn = true;
      _user = {
        'email': email,
        'role': 'client',
        'name': name,
      };
      
      return true;
    } catch (e) {
      _errorMessage = 'Error al registrar. El correo puede estar en uso.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> requestPasswordRecovery(String email) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Llamada API para solicitar recuperación
      await Future.delayed(const Duration(seconds: 1));
      return true;
    } catch (e) {
      _errorMessage = 'Error al enviar código de recuperación.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> verifyRecoveryCode({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Verificar código y cambiar contraseña
      await Future.delayed(const Duration(seconds: 1));
      return true;
    } catch (e) {
      _errorMessage = 'Código inválido o expirado.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void logout() {
    _isLoggedIn = false;
    _user = null;
    notifyListeners();
  }
}