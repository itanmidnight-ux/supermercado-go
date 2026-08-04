import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../utils/constants.dart';

typedef LocationUpdateCallback = void Function(double lat, double lng, int? workerId);
typedef OrderUpdateCallback = void Function(Map<String, dynamic> data);

class WsService {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  String? _token;
  bool _isConnected = false;

  final List<LocationUpdateCallback> _locationListeners = [];
  final List<OrderUpdateCallback> _orderListeners = [];

  bool get isConnected => _isConnected;

  Future<void> connect(String token) async {
    _token = token;
    _disconnectInternal();

    try {
      final wsUrl = ApiEndpoints.baseUrl
          .replaceFirst('http', 'ws')
          .replaceFirst('https', 'wss');
      final uri = Uri.parse('$wsUrl/ws?token=$token');

      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;

      _subscription = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );
    } catch (e) {
      _isConnected = false;
      rethrow;
    }
  }

  void _onMessage(dynamic message) {
    try {
      final data = jsonDecode(message as String) as Map<String, dynamic>;
      final type = data['type'] as String?;

      switch (type) {
        case 'order_status_changed':
          _notifyOrderUpdate(data);
          break;
        case 'worker_location':
          final payload = data['data'] as Map<String, dynamic>? ?? data;
          final lat = (payload['lat'] as num?)?.toDouble() ?? 0.0;
          final lng = (payload['lng'] as num?)?.toDouble() ?? 0.0;
          final workerId = payload['worker_id'] as int?;
          for (final cb in _locationListeners) {
            cb(lat, lng, workerId);
          }
          break;
        case 'new_order':
          _notifyOrderUpdate(data);
          break;
        default:
          break;
      }
    } catch (_) {
      // Malformed message, ignore
    }
  }

  void _onError(Object error) {
    _isConnected = false;
  }

  void _onDone() {
    _isConnected = false;
  }

  void _notifyOrderUpdate(Map<String, dynamic> data) {
    for (final cb in _orderListeners) {
      cb(data);
    }
  }

  void disconnect() {
    _disconnectInternal();
    _locationListeners.clear();
    _orderListeners.clear();
  }

  void _disconnectInternal() {
    _subscription?.cancel();
    _subscription = null;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    _isConnected = false;
  }

  void sendLocation(double lat, double lng) {
    if (_channel != null && _isConnected) {
      _channel!.sink.add(jsonEncode({
        'type': 'worker_location',
        'lat': lat,
        'lng': lng,
      }));
    }
  }

  void onLocationUpdate(LocationUpdateCallback callback) {
    _locationListeners.add(callback);
  }

  void onOrderUpdate(OrderUpdateCallback callback) {
    _orderListeners.add(callback);
  }

  void removeLocationListener(LocationUpdateCallback callback) {
    _locationListeners.remove(callback);
  }

  void removeOrderListener(OrderUpdateCallback callback) {
    _orderListeners.remove(callback);
  }
}

final wsService = WsService();
