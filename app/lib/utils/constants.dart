import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF00B860);
  static const Color primaryDark = Color(0xFF1a7a3a);
  static const Color accent = Color(0xFFFF8C00);
  static const Color gold = Color(0xFFFFD93D);
  static const Color white = Color(0xFFFFFFFF);
  static const Color black = Color(0xFF000000);
  static const Color gray = Color(0xFF6B7280);
  static const Color lightGray = Color(0xFFF3F4F6);
  static const Color error = Color(0xFFEF4444);
  static const Color success = Color(0xFF00B860);
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
}

class AppStrings {
  static const String appName = 'Supermercados Go';
  static const String tagline = 'Tu supermercado a la puerta de tu casa';
  static const String currencySymbol = r'$';

  static const List<String> deliveryTypes = ['domicilio', 'recogida'];
  static const List<String> deliveryTypeLabels = ['Domicilio', 'Recogida en tienda'];

  static const Map<String, String> orderStatuses = {
    'pending': 'Pendiente',
    'confirmed': 'Confirmado',
    'preparing': 'Preparando',
    'ready': 'Listo',
    'assigned': 'Asignado',
    'in_transit': 'En camino',
    'delivered': 'Entregado',
    'cancelled': 'Cancelado',
    'picked_up': 'Recogido',
  };

  static const Map<String, String> paymentMethods = {
    'cash': 'Efectivo',
    'nequi': 'Nequi',
    'daviplata': 'Daviplata',
    'card': 'Tarjeta',
    'transfer': 'Transferencia',
  };

  static const String businessName = 'Supermercados Go';
  static const String businessCity = 'Cúcuta';
  static const String businessPhone = '+573044016277';
  static const String businessEmail = 'admin@supermercado.go';
  static const String businessAddress = 'KDX 1-2B Los Mangos';
  static const String businessHours = '6:00 AM - 6:00 PM';
}

class ApiEndpoints {
  static String baseUrl = 'http://10.0.2.2:3777';

  static String get auth => '/auth';
  static String get login => '/auth/login';
  static String get register => '/auth/register';
  static String get me => '/auth/me';
  static String get changePassword => '/auth/change-password';
  static String get forgotPassword => '/auth/forgot-password';

  static String get products => '/products';
  static String product(String id) => '/products/$id';
  static String get categories => '/categories';
  static String category(String id) => '/categories/$id';

  static String get orders => '/orders';
  static String order(String id) => '/orders/$id';
  static String orderCancel(String id) => '/orders/$id/cancel';
  static String orderRate(String id) => '/orders/$id/rate';
  static String orderInvoice(String id) => '/orders/$id/invoice';

  static String get workerOrders => '/worker/orders';
  static String workerAccept(String id) => '/worker/orders/$id/accept';
  static String workerStartDelivery(String id) => '/worker/orders/$id/start-delivery';
  static String workerCompleteDelivery(String id) => '/worker/orders/$id/complete';
  static String workerConfirmPickup(String id) => '/worker/orders/$id/confirm-pickup';
  static String workerSubstitute(String orderId, String itemId) => '/worker/orders/$orderId/items/$itemId/substitute';
  static String workerMarkMissing(String orderId, String itemId) => '/worker/orders/$orderId/items/$itemId/missing';
  static String get workerEarnings => '/worker/earnings';
  static String get workerCash => '/worker/cash';

  static String get addresses => '/addresses';
  static String address(String id) => '/addresses/$id';

  static String get favorites => '/favorites';
  static String favorite(String productId) => '/favorites/$productId';

  static String get cart => '/cart';

  static String get promotions => '/promotions';
  static String get validatePromo => '/promotions/validate';

  static String get notifications => '/notifications';
  static String notificationMarkRead(String id) => '/notifications/$id/read';

  static String get settings => '/settings';
  static String get publicSettings => '/settings/public';

  static String get adminDashboard => '/admin/dashboard';
  static String get adminUsers => '/admin/users';
  static String adminUser(String id) => '/admin/users/$id';
  static String get adminCategories => '/admin/categories';
  static String adminCategory(String id) => '/admin/categories/$id';
  static String get adminOrders => '/admin/orders';
  static String adminOrder(String id) => '/admin/orders/$id';
  static String get adminInventory => '/admin/inventory';
  static String get adminKardex => '/admin/kardex';
  static String get adminStockCount => '/admin/stock-count';
  static String get adminSuppliers => '/admin/suppliers';
  static String adminSupplier(String id) => '/admin/suppliers/$id';
  static String get adminPurchases => '/admin/purchases';
  static String adminPurchase(String id) => '/admin/purchases/$id';
  static String get adminInvoices => '/admin/invoices';
  static String get adminInvoiceConfig => '/admin/invoice-config';
  static String get adminReports => '/admin/reports';
  static String get adminPromotions => '/admin/promotions';
  static String adminPromotion(String id) => '/admin/promotions/$id';
  static String get adminWorkersPerf => '/admin/workers-performance';
  static String get adminAudit => '/admin/audit';
  static String get adminBarcodePrint => '/admin/barcode-print';

  static String get uploadImage => '/upload';
}
