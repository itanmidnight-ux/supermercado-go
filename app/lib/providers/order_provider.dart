import 'dart:async';
import 'package:flutter/material.dart';
import '../models/order.dart';
import '../services/api_service.dart';

class OrderProvider extends ChangeNotifier {
  List<Order> _orders = [];
  Order? _currentOrder;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;
  String? _currentStatusFilter;
  bool _isLoadingCurrent = false;

  List<Order> get orders => _orders;
  Order? get currentOrder => _currentOrder;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  String? get error => _error;
  bool get isLoadingCurrent => _isLoadingCurrent;
  bool get hasMore => _currentPage < _totalPages;

  Future<void> loadMyOrders({String? status, int page = 1, bool refresh = false}) async {
    if (refresh) {
      _orders = [];
      _currentPage = 1;
    }

    if (page == 1) {
      _isLoading = true;
      _error = null;
      _currentStatusFilter = status;
      notifyListeners();
    } else {
      _isLoadingMore = true;
      notifyListeners();
    }

    try {
      final queryParams = <String, String>{};
      queryParams['page'] = page.toString();
      if (status != null && status.isNotEmpty) queryParams['status'] = status;

      final response = await apiService.get(ApiEndpoints.orders, queryParams: queryParams);
      List<Order> parsed = [];

      final data = response['data'] ?? response;
      if (data is List) {
        parsed = data.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map) {
        final items = data['items'] ?? data['orders'] ?? data['data'];
        if (items is List) {
          parsed = items.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
        }
        final meta = data['meta'] ?? data['pagination'];
        if (meta is Map) {
          _totalPages = (meta['total_pages'] ?? meta['last_page'] ?? 1) as int;
        }
      }

      _currentPage = page;
      if (page == 1) {
        _orders = parsed;
      } else {
        _orders.addAll(parsed);
      }
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Error al cargar pedidos';
    } finally {
      _isLoading = false;
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreOrders() async {
    if (_isLoadingMore || !hasMore) return;
    await loadMyOrders(status: _currentStatusFilter, page: _currentPage + 1);
  }

  Future<void> loadOrder(int id) async {
    _isLoadingCurrent = true;
    notifyListeners();

    try {
      final response = await apiService.get(ApiEndpoints.order(id.toString()));
      final data = response['data'] ?? response['order'] ?? response;
      _currentOrder = Order.fromJson(data as Map<String, dynamic>);
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Error al cargar pedido';
    } finally {
      _isLoadingCurrent = false;
      notifyListeners();
    }
  }

  Future<bool> createOrder({
    required List<Map<String, dynamic>> items,
    required Map<String, dynamic> address,
    String fulfillmentType = 'domicilio',
    String? notes,
    String? promoCode,
    String? scheduledFor,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final body = <String, dynamic>{
        'items': items,
        'fulfillment_type': fulfillmentType,
        'notes': notes,
        'promo_code': promoCode,
        'scheduled_for': scheduledFor,
      };

      if (fulfillmentType == 'domicilio' || fulfillmentType == 'delivery') {
        body['delivery_address'] = address['address'];
        body['delivery_lat'] = address['lat'];
        body['delivery_lng'] = address['lng'];
        body['delivery_neighborhood'] = address['neighborhood'];
        body['delivery_detail'] = address['detail'];
      }

      final response = await apiService.post(ApiEndpoints.orders, body);
      final data = response['data'] ?? response['order'] ?? response;
      _currentOrder = Order.fromJson(data as Map<String, dynamic>);
      _error = null;
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al crear pedido';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> cancelOrder(int id, String reason) async {
    try {
      await apiService.post(ApiEndpoints.orderCancel(id.toString()), {
        'reason': reason,
      });
      _orders = _orders.map((o) {
        if (o.id == id) {
          return Order.fromJson({...o.toJson(), 'status': 'cancelled', 'cancelled_reason': reason});
        }
        return o;
      }).toList();
      if (_currentOrder?.id == id) {
        _currentOrder = Order.fromJson({
          ..._currentOrder!.toJson(),
          'status': 'cancelled',
          'cancelled_reason': reason,
        });
      }
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al cancelar pedido';
      return false;
    }
  }

  Future<bool> rateOrder(int id, int rating, String comment) async {
    try {
      await apiService.post(ApiEndpoints.orderRate(id.toString()), {
        'rating': rating,
        'comment': comment,
      });
      _orders = _orders.map((o) {
        if (o.id == id) {
          return Order.fromJson({
            ...o.toJson(),
            'rating': rating,
            'rating_comment': comment,
          });
        }
        return o;
      }).toList();
      if (_currentOrder?.id == id) {
        _currentOrder = Order.fromJson({
          ..._currentOrder!.toJson(),
          'rating': rating,
          'rating_comment': comment,
        });
      }
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al calificar pedido';
      return false;
    }
  }

  // Worker methods
  Future<void> loadAvailableOrders() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await apiService.get(ApiEndpoints.workerOrders, queryParams: {'status': 'ready'});
      List<Order> parsed = [];
      final data = response['data'] ?? response;
      if (data is List) {
        parsed = data.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map) {
        final items = data['items'] ?? data['orders'];
        if (items is List) {
          parsed = items.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
      _orders = parsed;
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Error al cargar pedidos disponibles';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadActiveDelivery() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await apiService.get(ApiEndpoints.workerOrders, queryParams: {'status': 'active'});
      final data = response['data'] ?? response;
      if (data is Map) {
        _currentOrder = Order.fromJson(data);
      } else if (data is List && data.isNotEmpty) {
        _currentOrder = Order.fromJson(data.first as Map<String, dynamic>);
      } else {
        _currentOrder = null;
      }
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Error al cargar entrega activa';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> acceptOrder(int id) async {
    try {
      await apiService.post(ApiEndpoints.workerAccept(id.toString()), {});
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al aceptar pedido';
      return false;
    } finally {
      notifyListeners();
    }
  }

  Future<bool> startDelivery(int id) async {
    try {
      await apiService.post(ApiEndpoints.workerStartDelivery(id.toString()), {});
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al iniciar entrega';
      return false;
    }
  }

  Future<bool> completeDelivery(int id) async {
    try {
      await apiService.post(ApiEndpoints.workerCompleteDelivery(id.toString()), {});
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al completar entrega';
      return false;
    }
  }

  Future<bool> confirmPickup(int id, String code) async {
    try {
      await apiService.post(ApiEndpoints.workerConfirmPickup(id.toString()), {
        'pickup_code': code,
      });
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al confirmar recogida';
      return false;
    }
  }

  Future<bool> substituteItem(int orderId, int itemId, int productId, double qty) async {
    try {
      await apiService.post(
        ApiEndpoints.workerSubstitute(orderId.toString(), itemId.toString()),
        {'substitute_product_id': productId, 'qty': qty},
      );
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al sustituir producto';
      return false;
    }
  }

  Future<bool> markItemMissing(int orderId, int itemId) async {
    try {
      await apiService.post(
        ApiEndpoints.workerMarkMissing(orderId.toString(), itemId.toString()),
        {},
      );
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Error al marcar producto faltante';
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}