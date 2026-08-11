import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class SettingsProvider extends ChangeNotifier {
  String _businessName = 'Supermercados Go';
  String _businessPhone = '+573044016277';
  String _businessEmail = 'admin@supermercado.go';
  String _businessAddress = 'KDX 1-2B Los Mangos';
  String _businessHours = '6:00 AM - 6:00 PM';
  String _businessTagline = 'Tu supermercado a la puerta de tu casa';
  int _deliveryFee = 4900;
  int _freeDeliveryMin = 50000;
  double _operatingZoneRadius = 10.0;
  double _businessLat = 7.8939;
  double _businessLng = -72.5077;
  bool _isLoading = false;
  String? _error;

  String get businessName => _businessName;
  String get businessPhone => _businessPhone;
  String get businessEmail => _businessEmail;
  String get businessAddress => _businessAddress;
  String get businessHours => _businessHours;
  String get businessTagline => _businessTagline;
  int get deliveryFee => _deliveryFee;
  int get freeDeliveryMin => _freeDeliveryMin;
  double get operatingZoneRadius => _operatingZoneRadius;
  double get businessLat => _businessLat;
  double get businessLng => _businessLng;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get serverUrl => apiService.baseUrl;

  Future<void> loadPublicSettings() async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await apiService.get(ApiEndpoints.publicSettings);
      final data = response['data'] ?? response['settings'] ?? response;
      _parseSettings(data as Map<String, dynamic>);
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      // Use defaults
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _parseSettings(Map<String, dynamic> data) {
    if (data['business_name'] != null) _businessName = data['business_name'] as String;
    if (data['business_phone'] != null) _businessPhone = data['business_phone'] as String;
    if (data['business_email'] != null) _businessEmail = data['business_email'] as String;
    if (data['business_address'] != null) _businessAddress = data['business_address'] as String;
    if (data['business_hours'] != null) _businessHours = data['business_hours'] as String;
    if (data['business_tagline'] != null) _businessTagline = data['business_tagline'] as String;
    if (data['delivery_fee'] != null) {
      _deliveryFee = (data['delivery_fee'] is int) ? data['delivery_fee'] as int : (data['delivery_fee'] as num).toInt();
    }
    if (data['free_delivery_min'] != null) {
      _freeDeliveryMin = (data['free_delivery_min'] is int) ? data['free_delivery_min'] as int : (data['free_delivery_min'] as num).toInt();
    }
    if (data['operating_zone_radius'] != null) {
      _operatingZoneRadius = (data['operating_zone_radius'] as num).toDouble();
    }
    if (data['business_lat'] != null) {
      _businessLat = (data['business_lat'] as num).toDouble();
    }
    if (data['business_lng'] != null) {
      _businessLng = (data['business_lng'] as num).toDouble();
    }
  }
}
