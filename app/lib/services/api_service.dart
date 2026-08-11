import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

class ApiService {
  String _baseUrl;

  ApiService([String? baseUrl]) : _baseUrl = baseUrl ?? ApiEndpoints.baseUrl;

  String get baseUrl => _baseUrl;

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url;
    ApiEndpoints.baseUrl = url;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('base_url', url);
  }

  Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('base_url');
    if (saved != null && saved.isNotEmpty) {
      _baseUrl = saved;
      ApiEndpoints.baseUrl = saved;
    }
    return _baseUrl;
  }

  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? queryParams}) async {
    await getBaseUrl();
    Uri uri;
    if (queryParams != null && queryParams.isNotEmpty) {
      uri = Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
    } else {
      uri = Uri.parse('$_baseUrl$path');
    }

    try {
      final headers = await _getHeaders();
      final response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 30));
      return _processResponse(response);
    } on FormatException {
      throw ApiException('Error de formato en la respuesta del servidor');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('No se pudo conectar al servidor. Verifica tu conexión.');
    }
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    await getBaseUrl();
    final uri = Uri.parse('$_baseUrl$path');

    try {
      final headers = await _getHeaders();
      final response = await http
          .post(uri, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 30));
      return _processResponse(response);
    } on FormatException {
      throw ApiException('Error de formato en la respuesta del servidor');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('No se pudo conectar al servidor. Verifica tu conexión.');
    }
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    await getBaseUrl();
    final uri = Uri.parse('$_baseUrl$path');

    try {
      final headers = await _getHeaders();
      final response = await http
          .put(uri, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 30));
      return _processResponse(response);
    } on FormatException {
      throw ApiException('Error de formato en la respuesta del servidor');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('No se pudo conectar al servidor. Verifica tu conexión.');
    }
  }

  Future<Map<String, dynamic>> delete(String path) async {
    await getBaseUrl();
    final uri = Uri.parse('$_baseUrl$path');

    try {
      final headers = await _getHeaders();
      final response = await http.delete(uri, headers: headers).timeout(const Duration(seconds: 30));
      return _processResponse(response);
    } on FormatException {
      throw ApiException('Error de formato en la respuesta del servidor');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('No se pudo conectar al servidor. Verifica tu conexión.');
    }
  }

  Future<Map<String, dynamic>> postMultipart(String path, Map<String, String> fields, String filePath) async {
    await getBaseUrl();
    final uri = Uri.parse('$_baseUrl$path');
    final request = http.MultipartRequest('POST', uri);

    final headers = await _getHeaders();
    request.headers.addAll(headers);

    fields.forEach((key, value) {
      request.fields[key] = value;
    });

    request.files.add(await http.MultipartFile.fromPath('file', filePath));

    try {
      final streamedResponse = await request.send().timeout(const Duration(seconds: 60));
      final response = await http.Response.fromStream(streamedResponse);
      return _processResponse(response);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Error al subir archivo. Verifica tu conexión.');
    }
  }

  Map<String, dynamic> _processResponse(http.Response response) {
    final statusCode = response.statusCode;

    if (statusCode == 401) {
      _handleUnauthorized();
      throw ApiException('Sesión expirada. Inicia sesión nuevamente.', statusCode: statusCode);
    }

    if (statusCode == 204 || response.body.isEmpty) {
      return {'success': true};
    }

    try {
      final decoded = jsonDecode(response.body);

      if (statusCode >= 200 && statusCode < 300) {
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
        return {'data': decoded};
      }

      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'] ?? decoded['error'] ?? decoded['msg'];
        if (message is String && message.isNotEmpty) {
          throw ApiException(message, statusCode: statusCode);
        }
        final errors = decoded['errors'];
        if (errors is Map) {
          final firstError = errors.values.first;
          if (firstError is List && firstError.isNotEmpty) {
            throw ApiException(firstError.first.toString(), statusCode: statusCode);
          }
          throw ApiException(firstError.toString(), statusCode: statusCode);
        }
      }

      throw ApiException('Error del servidor ($statusCode)', statusCode: statusCode);
    } on ApiException {
      rethrow;
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Error al procesar la respuesta del servidor', statusCode: statusCode);
    }
  }

  void _handleUnauthorized() {
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove('auth_token');
      prefs.remove('user_data');
    });
  }
}

final apiService = ApiService();
