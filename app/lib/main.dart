import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/connectivity_provider.dart';
import 'providers/order_provider.dart';
import 'providers/product_provider.dart';
import 'providers/settings_provider.dart';
import 'screens/admin/admin_barcode_print_screen.dart';
import 'screens/admin/admin_banners_screen.dart';
import 'screens/admin/admin_categories_screen.dart';
import 'screens/admin/admin_category_form_screen.dart';
import 'screens/admin/admin_dashboard_screen.dart';
import 'screens/admin/admin_inventory_screen.dart';
import 'screens/admin/admin_invoice_config_screen.dart';
import 'screens/admin/admin_invoices_screen.dart';
import 'screens/admin/admin_kardex_screen.dart';
import 'screens/admin/admin_orders_screen.dart';
import 'screens/admin/admin_product_form_screen.dart';
import 'screens/admin/admin_products_screen.dart';
import 'screens/admin/admin_promo_form_screen.dart';
import 'screens/admin/admin_promotions_screen.dart';
import 'screens/admin/admin_purchase_form_screen.dart';
import 'screens/admin/admin_purchases_screen.dart';
import 'screens/admin/admin_reports_screen.dart';
import 'screens/admin/admin_settings_screen.dart';
import 'screens/admin/admin_stock_count_screen.dart';
import 'screens/admin/admin_supplier_form_screen.dart';
import 'screens/admin/admin_suppliers_screen.dart';
import 'screens/admin/admin_user_form_screen.dart';
import 'screens/admin/admin_users_screen.dart';
import 'screens/admin/admin_workers_perf_screen.dart';
import 'screens/admin/audit_log_screen.dart';
import 'screens/admin/categories_screen.dart';
import 'screens/admin/inventory_screen.dart';
import 'screens/admin/invoice_config_screen.dart';
import 'screens/admin/invoices_screen.dart';
import 'screens/admin/kardex_screen.dart';
import 'screens/admin/promotions_screen.dart';
import 'screens/admin/purchases_screen.dart';
import 'screens/admin/reports_screen.dart';
import 'screens/admin/stock_count_screen.dart';
import 'screens/admin/suppliers_screen.dart';
import 'screens/admin/workers_performance_screen.dart';
import 'screens/client/cart_screen.dart';
import 'screens/client/checkout_screen.dart';
import 'screens/client/home_screen.dart';
import 'screens/client/login_screen.dart';
import 'screens/client/my_orders_screen.dart';
import 'screens/client/order_detail_screen_client.dart';
import 'screens/client/order_tracking_screen.dart';
import 'screens/client/product_detail_screen.dart';
import 'screens/worker/cash_session_screen.dart';
import 'screens/worker/delivery_proof_screen.dart';
import 'screens/worker/earnings_screen.dart';
import 'screens/worker/history_screen.dart';
import 'screens/worker/picking_screen.dart';
import 'screens/worker/route_screen.dart';
import 'screens/worker/scanner_screen.dart';
import 'screens/worker/substitution_screen.dart';
import 'screens/worker/worker_home_screen.dart';
import 'screens/worker/worker_orders_screen.dart';
import 'widgets/offline_banner.dart';
import 'theme/app_theme.dart';
import 'utils/constants.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
        ChangeNotifierProvider(create: (_) => ConnectivityProvider()..startListening()),
      ],
      child: const SupermercadosGoApp(),
    ),
  );
}

class SupermercadosGoApp extends StatelessWidget {
  const SupermercadosGoApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: AppStrings.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,
        initialRoute: '/login',
        onGenerateRoute: _route,
      );

  Route<dynamic>? _route(RouteSettings settings) {
    final args = settings.arguments as Map<String, dynamic>? ?? const {};
    final id = args['id'] as int? ?? 0;
    final orderId = args['order_id'] as int? ?? id;
    final screen = switch (settings.name) {
      '/login' => const LoginScreen(),
      '/' || '/home' => const HomeScreen(),
      '/product' => ProductDetailScreen(productId: id),
      '/cart' => const CartScreen(),
      '/checkout' => const CheckoutScreen(),
      '/my-orders' => const MyOrdersScreen(),
      '/order' => OrderDetailScreenClient(orderId: id),
      '/order-tracking' => OrderTrackingScreen(orderId: id),
      '/worker/home' => const WorkerHomeScreen(),
      '/worker/orders' => const WorkerOrdersScreen(),
      '/worker/picking' => PickingScreen(orderId: orderId),
      '/worker/scanner' => ScannerScreen(orderId: orderId, itemId: args['item_id'] as int?),
      '/worker/substitute' => SubstitutionScreen(orderId: orderId, item: args['item']),
      '/worker/delivery-proof' => DeliveryProofScreen(orderId: orderId),
      '/worker/route' => const RouteScreen(),
      '/worker/earnings' => const EarningsScreen(),
      '/worker/history' => const HistoryScreen(),
      '/worker/cash' => const CashSessionScreen(),
      '/admin/dashboard' => const AdminDashboardScreen(),
      '/admin/products' => const AdminProductsScreen(),
      '/admin/product-form' => AdminProductFormScreen(productId: args['id'] as int?),
      '/admin/categories' => const CategoriesScreen(),
      '/admin/category-form' => AdminCategoryFormScreen(categoryId: args['id'] as int?),
      '/admin/orders' => const AdminOrdersScreen(),
      '/admin/users' => const AdminUsersScreen(),
      '/admin/user-form' => AdminUserFormScreen(userId: args['id'] as int?),
      '/admin/settings' => const AdminSettingsScreen(),
      '/admin/inventory' => const InventoryScreen(),
      '/admin/kardex' => KardexScreen(productId: id),
      '/admin/stock-count' => const StockCountScreen(),
      '/admin/suppliers' => const SuppliersScreen(),
      '/admin/supplier-form' => AdminSupplierFormScreen(supplierId: args['id'] as int?),
      '/admin/purchases' => const PurchasesScreen(),
      '/admin/purchase-form' => AdminPurchaseFormScreen(purchaseId: args['id'] as int?),
      '/admin/invoices' => const InvoicesScreen(),
      '/admin/invoice-config' => const InvoiceConfigScreen(),
      '/admin/reports' => const ReportsScreen(),
      '/admin/promotions' => const PromotionsScreen(),
      '/admin/promo-form' => AdminPromoFormScreen(promoId: args['id'] as int?),
      '/admin/workers-perf' => const WorkersPerformanceScreen(),
      '/admin/audit' => const AuditLogScreen(),
      '/admin/barcode-print' => const AdminBarcodePrintScreen(),
      '/admin/banners' => const AdminBannersScreen(),
      _ => null,
    };
    if (screen == null) return null;
    return MaterialPageRoute(builder: (_) => _withOffline(screen), settings: settings);
  }

  Widget _withOffline(Widget child) => Column(
        children: [const OfflineBanner(), Expanded(child: child)],
      );
}
