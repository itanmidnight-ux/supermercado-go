import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models/category.dart';
import 'models/product.dart';
import 'utils/constants.dart';
import 'utils/formatters.dart';
import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/product_provider.dart';
import 'providers/order_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/connectivity_provider.dart';
import 'services/storage_service.dart';
import 'theme/app_theme.dart';
import 'theme/app_colors.dart';
import 'widgets/offline_banner.dart';
import 'widgets/server_config_dialog.dart';
import 'widgets/app_drawer.dart';
import 'widgets/bottom_nav_bar.dart';
import 'widgets/custom_app_bar.dart';
import 'widgets/empty_state.dart';
import 'widgets/loading_shimmer.dart';
import 'widgets/money_text.dart';
import 'widgets/quantity_stepper.dart';
import 'widgets/product_card.dart';
import 'widgets/order_status_chip.dart';
// Client screens
import 'screens/client/login_screen.dart';
import 'screens/client/home_screen.dart';
import 'screens/client/product_detail_screen.dart';
import 'screens/client/cart_screen.dart';
import 'screens/client/checkout_screen.dart';
import 'screens/client/my_orders_screen.dart';
import 'screens/client/order_detail_screen_client.dart';
import 'screens/client/order_tracking_screen.dart';
// Worker screens
import 'screens/worker/worker_home_screen.dart';
import 'screens/worker/worker_orders_screen.dart';
import 'screens/worker/picking_screen.dart';
import 'screens/worker/scanner_screen.dart';
import 'screens/worker/substitution_screen.dart';
import 'screens/worker/delivery_proof_screen.dart';
import 'screens/worker/route_screen.dart';
import 'screens/worker/earnings_screen.dart';
import 'screens/worker/history_screen.dart';
import 'screens/worker/cash_session_screen.dart';
// Admin screens
import 'screens/admin/admin_dashboard_screen.dart';
import 'screens/admin/admin_products_screen.dart';
import 'screens/admin/admin_product_form_screen.dart';
import 'screens/admin/admin_categories_screen.dart';
import 'screens/admin/admin_category_form_screen.dart';
import 'screens/admin/admin_orders_screen.dart';
import 'screens/admin/admin_users_screen.dart';
import 'screens/admin/admin_user_form_screen.dart';
import 'screens/admin/admin_settings_screen.dart';
import 'screens/admin/admin_inventory_screen.dart';
import 'screens/admin/admin_kardex_screen.dart';
import 'screens/admin/admin_stock_count_screen.dart';
import 'screens/admin/admin_suppliers_screen.dart';
import 'screens/admin/admin_supplier_form_screen.dart';
import 'screens/admin/admin_purchases_screen.dart';
import 'screens/admin/admin_purchase_form_screen.dart';
import 'screens/admin/admin_invoices_screen.dart';
import 'screens/admin/admin_invoice_config_screen.dart';
import 'screens/admin/admin_reports_screen.dart';
import 'screens/admin/admin_promotions_screen.dart';
import 'screens/admin/admin_promo_form_screen.dart';
import 'screens/admin/admin_workers_perf_screen.dart';
import 'screens/admin/admin_audit_screen.dart';
import 'screens/admin/admin_barcode_print_screen.dart';
import 'screens/admin/admin_banners_screen.dart';

// ======================== BANNER MODEL ========================
class Banner {
  final String id, title, bgColor, textColor, linkType;
  final String? subtitle, imageUrl, linkValue;
  final int sortOrder, isActive;
  Banner.fromJson(Map<String, dynamic> j)
      : id = j['id'] ?? '',
        title = j['title'] ?? '',
        subtitle = j['subtitle'],
        imageUrl = j['image_url'],
        linkType = j['link_type'] ?? 'none',
        linkValue = j['link_value'],
        bgColor = j['bg_color'] ?? '#00B860',
        textColor = j['text_color'] ?? '#FFFFFF',
        sortOrder = j['sort_order'] ?? 0,
        isActive = j['is_active'] ?? 1;
}

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
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      initialRoute: '/login',
      onGenerateRoute: _onGenerateRoute,
    );
  }

  Route<dynamic>? _onGenerateRoute(RouteSettings settings) {
    final args = settings.arguments as Map<String, dynamic>?;
    final name = settings.name ?? '/';

    final routes = <String, WidgetBuilder>{
      '/login': (_) => _buildWithOffline(const LoginScreen()),
      '/': (_) => const _AuthGate(),
      '/home': (_) => _buildWithOffline(const HomeScreen()),
      '/product': (_) => _buildWithOffline(ProductDetailScreen(
          productId: args?['id'] as int? ?? 0)),
      '/cart': (_) => _buildWithOffline(const CartScreen()),
      '/checkout': (_) => _buildWithOffline(const CheckoutScreen()),
      '/search': (_) => _buildWithOffline(const _SearchScreen()),
      '/category': (_) => _buildWithOffline(_CategoryScreen(
          categoryId: args?['id'] as int? ?? 0)),
      '/my-orders': (_) => _buildWithOffline(const MyOrdersScreen()),
      '/order': (_) => _buildWithOffline(OrderDetailScreenClient(
          orderId: args?['id'] as int? ?? 0)),
      '/order-tracking': (_) => _buildWithOffline(OrderTrackingScreen(
          orderId: args?['id'] as int? ?? 0)),
      '/addresses': (_) => _buildWithOffline(const _AddressesScreen()),
      '/address-picker': (_) => _buildWithOffline(const _AddressPickerScreen()),
      '/favorites': (_) => _buildWithOffline(const _FavoritesScreen()),
      '/notifications': (_) => _buildWithOffline(const _NotificationsScreen()),
      '/promo': (_) => _buildWithOffline(const _PromoScreen()),
      '/help': (_) => _buildWithOffline(const _HelpScreen()),
      '/privacy': (_) => _buildWithOffline(const _PrivacyScreen()),
      '/pickup': (_) => _buildWithOffline(_PickupScreen(
          orderId: args?['id'] as int? ?? 0)),
      '/rate': (_) => _buildWithOffline(_RateScreen(
          orderId: args?['id'] as int? ?? 0)),
      '/invoice': (_) => _buildWithOffline(_InvoiceScreen(
          orderId: args?['id'] as int? ?? 0)),
      '/worker/home': (_) => _buildWithOffline(const WorkerHomeScreen()),
      '/worker/orders': (_) => _buildWithOffline(const WorkerOrdersScreen()),
      '/worker/delivery': (_) => _buildWithOffline(const WorkerHomeScreen()),
      '/worker/picking': (_) => _buildWithOffline(PickingScreen(
          orderId: args?['id'] as int? ?? 0)),
      '/worker/scanner': (_) => _buildWithOffline(ScannerScreen(
          orderId: args?['order_id'] as int? ?? 0, itemId: args?['item_id'] as int?)),
      '/worker/substitute': (_) => _buildWithOffline(SubstitutionScreen(
          orderId: args?['order_id'] as int? ?? 0, item: args?['item'])),
      '/worker/delivery-proof': (_) => _buildWithOffline(DeliveryProofScreen(
          orderId: args?['order_id'] as int? ?? 0)),
      '/worker/route': (_) => _buildWithOffline(const RouteScreen()),
      '/worker/earnings': (_) => _buildWithOffline(const EarningsScreen()),
      '/worker/history': (_) => _buildWithOffline(const HistoryScreen()),
      '/worker/cash': (_) => _buildWithOffline(const CashSessionScreen()),
      '/admin/dashboard': (_) => _buildWithOffline(const AdminDashboardScreen()),
      '/admin/products': (_) => _buildWithOffline(const AdminProductsScreen()),
      '/admin/product-form': (_) => _buildWithOffline(AdminProductFormScreen(
          productId: args?['id'] as int?)),
      '/admin/categories': (_) => _buildWithOffline(const AdminCategoriesScreen()),
      '/admin/category-form': (_) => _buildWithOffline(AdminCategoryFormScreen(
          categoryId: args?['id'] as int?)),
      '/admin/orders': (_) => _buildWithOffline(const AdminOrdersScreen()),
      '/admin/users': (_) => _buildWithOffline(const AdminUsersScreen()),
      '/admin/user-form': (_) => _buildWithOffline(AdminUserFormScreen(
          userId: args?['id'] as int?)),
      '/admin/settings': (_) => _buildWithOffline(const AdminSettingsScreen()),
      '/admin/inventory': (_) => _buildWithOffline(const AdminInventoryScreen()),
      '/admin/kardex': (_) => _buildWithOffline(AdminKardexScreen(
          productId: args?['id'] as int? ?? 0)),
      '/admin/stock-count': (_) => _buildWithOffline(const AdminStockCountScreen()),
      '/admin/suppliers': (_) => _buildWithOffline(const AdminSuppliersScreen()),
      '/admin/supplier-form': (_) => _buildWithOffline(AdminSupplierFormScreen(
          supplierId: args?['id'] as int?)),
      '/admin/purchases': (_) => _buildWithOffline(const AdminPurchasesScreen()),
      '/admin/purchase-form': (_) => _buildWithOffline(AdminPurchaseFormScreen(
          purchaseId: args?['id'] as int?)),
      '/admin/invoices': (_) => _buildWithOffline(const AdminInvoicesScreen()),
      '/admin/invoice-config': (_) => _buildWithOffline(const AdminInvoiceConfigScreen()),
      '/admin/reports': (_) => _buildWithOffline(const AdminReportsScreen()),
      '/admin/promotions': (_) => _buildWithOffline(const AdminPromotionsScreen()),
      '/admin/promo-form': (_) => _buildWithOffline(AdminPromoFormScreen(
          promoId: args?['id'] as int?)),
      '/admin/workers-perf': (_) => _buildWithOffline(const AdminWorkersPerfScreen()),
      '/admin/audit': (_) => _buildWithOffline(const AdminAuditScreen()),
      '/admin/barcode-print': (_) => _buildWithOffline(const AdminBarcodePrintScreen()),
      '/admin/banners': (_) => _buildWithOffline(const AdminBannersScreen()),
      '/server-config': (_) => const _ServerConfigScreen(),
    };

    final builder = routes[name];
    if (builder != null) {
      return PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => builder(context),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 200),
        settings: settings,
      );
    }

    return null;
  }

  Widget _buildWithOffline(Widget child) {
    return Column(
      children: [
        const OfflineBanner(),
        Expanded(child: child),
      ],
    );
  }
}

// ======================== AUTH GATE ========================

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (auth.isAuthenticated && auth.user != null) {
        Navigator.pushReplacementNamed(context, auth.getHomeRoute());
      } else {
        Navigator.pushReplacementNamed(context, '/login');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      ),
    );
  }
}

// ======================== LOGIN SCREEN ========================

class _LoginScreen extends StatefulWidget {
  const _LoginScreen();

  @override
  State<_LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<_LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passController = TextEditingController();
  bool _obscure = true;
  bool _rememberMe = false;
  int _failedAttempts = 0;
  int _cooldownRemaining = 0;
  Timer? _cooldownTimer;

  // Gradient animation
  late AnimationController _gradientCtrl;
  // Bounce animation for logo
  late AnimationController _bounceCtrl;
  late Animation<double> _bounceAnim;

  @override
  void initState() {
    super.initState();
    _loadSavedEmail();
    _gradientCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
    _bounceCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));
    _bounceAnim = Tween<double>(begin: -40, end: 0).animate(CurvedAnimation(parent: _bounceCtrl, curve: Curves.elasticOut));
    _bounceCtrl.forward();
  }

  Future<void> _loadSavedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('remembered_email');
    if (saved != null && saved.isNotEmpty && mounted) {
      setState(() { _emailController.text = saved; _rememberMe = true; });
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passController.dispose();
    _cooldownTimer?.cancel();
    _gradientCtrl.dispose();
    _bounceCtrl.dispose();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldownRemaining = 30);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) { timer.cancel(); return; }
      setState(() {
        _cooldownRemaining--;
        if (_cooldownRemaining <= 0) { timer.cancel(); _failedAttempts = 0; }
      });
    });
  }

  Future<void> _login() async {
    if (_cooldownRemaining > 0) return;
    if (!_formKey.currentState!.validate()) return;
    if (_rememberMe) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('remembered_email', _emailController.text.trim());
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('remembered_email');
    }
    final auth = context.read<AuthProvider>();
    final success = await auth.login(_emailController.text.trim(), _passController.text);
    if (!mounted) return;
    if (success) {
      _failedAttempts = 0;
      if (auth.mustChangePassword) {
        _showChangePassword(auth);
      } else {
        Navigator.pushReplacementNamed(context, auth.getHomeRoute());
      }
    } else {
      setState(() => _failedAttempts++);
      if (_failedAttempts >= 5) {
        _startCooldown();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Demasiados intentos. Espera 30 segundos.'), backgroundColor: AppColors.error, duration: Duration(seconds: 3)),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Credenciales incorrectas'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _forgotPassword() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresa tu correo primero'), backgroundColor: AppColors.error));
      return;
    }
    try {
      final sp = context.read<SettingsProvider>();
      final resp = await http.post(
        Uri.parse('${sp.serverUrl}/api/auth/forgot-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
      if (resp.statusCode == 200 || resp.statusCode == 204) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Se enviaron instrucciones a tu correo'), backgroundColor: AppColors.primary));
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se encontró una cuenta con ese correo'), backgroundColor: AppColors.error));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error de conexión'), backgroundColor: AppColors.error));
    }
  }

  // Password strength: 0=empty, 1=weak, 2=fair, 3=good, 4=strong
  int _passwordStrength(String pass) {
    if (pass.isEmpty) return 0;
    int score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (RegExp(r'[0-9]').hasMatch(pass)) score++;
    if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(pass)) score++;
    return score;
  }

  String _strengthLabel(int s) {
    switch (s) {
      case 1: return 'Débil';
      case 2: return 'Regular';
      case 3: return 'Buena';
      case 4: return 'Fuerte';
      default: return '';
    }
  }

  Color _strengthColor(int s) {
    switch (s) {
      case 1: return AppColors.error;
      case 2: return AppColors.accent;
      case 3: return AppColors.gold;
      case 4: return AppColors.success;
      default: return AppColors.lightGray;
    }
  }

  Widget _buildStrengthBar(int strength) {
    if (strength == 0) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 6),
      Row(children: List.generate(4, (i) => Expanded(
        child: Container(
          height: 4, margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: i < strength ? _strengthColor(strength) : AppColors.lightGray),
        ),
      ))),
      const SizedBox(height: 4),
      Text(_strengthLabel(strength), style: TextStyle(fontSize: 11, color: _strengthColor(strength), fontWeight: FontWeight.w500)),
    ]);
  }

  void _showChangePassword(AuthProvider auth) {
    final newPassCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    bool obscureNew = true;
    bool obscureConf = true;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('Cambiar Contraseña'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: newPassCtrl, obscureText: obscureNew, decoration: InputDecoration(labelText: 'Nueva contraseña (mínimo 6 caracteres)', prefixIcon: const Icon(Icons.lock_outlined), suffixIcon: IconButton(icon: Icon(obscureNew ? Icons.visibility_off : Icons.visibility), onPressed: () => setDlg(() => obscureNew = !obscureNew))), onChanged: (_) => setDlg(() {})),
            _buildStrengthBar(_passwordStrength(newPassCtrl.text)),
            const SizedBox(height: 12),
            TextField(controller: confirmCtrl, obscureText: obscureConf, decoration: InputDecoration(labelText: 'Confirmar contraseña', prefixIcon: const Icon(Icons.lock_outlined), suffixIcon: IconButton(icon: Icon(obscureConf ? Icons.visibility_off : Icons.visibility), onPressed: () => setDlg(() => obscureConf = !obscureConf)))),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                if (newPassCtrl.text.length < 6) return;
                if (newPassCtrl.text != confirmCtrl.text) return;
                final ok = await auth.changePassword(_passController.text, newPassCtrl.text);
                if (ctx.mounted) Navigator.pop(ctx);
                if (ok && mounted) Navigator.pushReplacementNamed(context, auth.getHomeRoute());
              },
              child: const Text('Cambiar'),
            ),
          ],
        ),
      ),
    );
  }

  void _showRegisterDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    bool acceptPrivacy = false;
    bool obscurePass = true;
    bool obscureConf = true;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('Crear Cuenta', style: TextStyle(color: AppColors.primary)),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nombre completo', prefixIcon: Icon(Icons.person_outline))),
              const SizedBox(height: 10),
              TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo electrónico', prefixIcon: Icon(Icons.email_outlined))),
              const SizedBox(height: 10),
              TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Teléfono (+57...)', prefixIcon: Icon(Icons.phone_outlined))),
              const SizedBox(height: 10),
              TextField(controller: passCtrl, obscureText: obscurePass, decoration: InputDecoration(
                labelText: 'Contraseña (mínimo 6)',
                prefixIcon: const Icon(Icons.lock_outlined),
                suffixIcon: IconButton(icon: Icon(obscurePass ? Icons.visibility_off : Icons.visibility), onPressed: () => setDialog(() => obscurePass = !obscurePass)),
              ), onChanged: (_) => setDialog(() {})),
              _buildStrengthBar(_passwordStrength(passCtrl.text)),
              const SizedBox(height: 10),
              TextField(controller: confirmCtrl, obscureText: obscureConf, decoration: InputDecoration(
                labelText: 'Confirmar contraseña',
                prefixIcon: const Icon(Icons.lock_outlined),
                suffixIcon: IconButton(icon: Icon(obscureConf ? Icons.visibility_off : Icons.visibility), onPressed: () => setDialog(() => obscureConf = !obscureConf)),
              )),
              const SizedBox(height: 8),
              Row(children: [
                SizedBox(width: 24, height: 24, child: Checkbox(value: acceptPrivacy, onChanged: (v) => setDialog(() => acceptPrivacy = v ?? false))),
                Expanded(child: GestureDetector(onTap: () => Navigator.pushNamed(context, '/privacy'), child: const Text('Acepto la política de privacidad', style: TextStyle(fontSize: 12, color: AppColors.primary, decoration: TextDecoration.underline)))),
              ]),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty || emailCtrl.text.trim().isEmpty || phoneCtrl.text.trim().isEmpty || passCtrl.text.length < 6) return;
                if (passCtrl.text != confirmCtrl.text) return;
                if (!acceptPrivacy) return;
                final auth = context.read<AuthProvider>();
                final ok = await auth.register(nameCtrl.text.trim(), emailCtrl.text.trim(), phoneCtrl.text.trim(), passCtrl.text);
                if (ctx.mounted) Navigator.pop(ctx);
                if (ok && mounted) Navigator.pushReplacementNamed(context, auth.getHomeRoute());
              },
              child: const Text('Registrarse'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLocked = _cooldownRemaining > 0;
    return Scaffold(
      body: AnimatedBuilder(
        animation: _gradientCtrl,
        builder: (context, _) {
          final t = _gradientCtrl.value;
          final color1 = Color.lerp(AppColors.primary, AppColors.primaryDark, t)!;
          final color2 = Color.lerp(AppColors.primaryDark, const Color(0xFF0E9B52), t)!;
          final color3 = Color.lerp(const Color(0xFF0E9B52), AppColors.primary, t)!;
          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color1, color2, color3],
              ),
            ),
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedBuilder(
                          animation: _bounceCtrl,
                          builder: (_, child) {
                            final offset = _bounceAnim.value;
                            return Transform.translate(
                              offset: Offset(0, offset < 0 ? offset : 0),
                              child: Opacity(opacity: _bounceCtrl.isCompleted ? 1.0 : (_bounceCtrl.value * 2).clamp(0.0, 1.0)),
                                child: Container(
                                  width: 90, height: 90,
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 16, offset: Offset(0, 6))],
                                  ),
                                  child: const Icon(Icons.shopping_bag, size: 44, color: AppColors.primary),
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 20),
                        const Text(AppStrings.appName, style: TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        const Text(AppStrings.tagline, style: TextStyle(color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 24),
                        // Failed attempts warning
                        if (_failedAttempts > 0 && !isLocked)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: _failedAttempts >= 4 ? AppColors.error.withOpacity(0.15) : AppColors.accent.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: (_failedAttempts >= 4 ? AppColors.error : AppColors.accent).withOpacity(0.3)),
                            ),
                            child: Row(children: [
                              Icon(Icons.warning_amber_rounded, color: _failedAttempts >= 4 ? AppColors.error : AppColors.accent, size: 20),
                              const SizedBox(width: 10),
                              Expanded(child: Text(
                                _failedAttempts >= 4
                                    ? 'Último intento antes del bloqueo'
                                    : '${5 - _failedAttempts} intentos restantes antes del bloqueo',
                                style: TextStyle(color: _failedAttempts >= 4 ? AppColors.error : Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                              )),
                            ]),
                          ),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 16, offset: Offset(0, 4))],
                          ),
                          child: Column(children: [
                            TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(labelText: 'Correo electrónico', prefixIcon: Icon(Icons.email_outlined)),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) return 'Ingresa tu correo';
                                if (!RegExp(r'^[\w\-.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v.trim())) return 'Correo inválido';
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _passController,
                              obscureText: _obscure,
                              decoration: InputDecoration(
                                labelText: 'Contraseña',
                                prefixIcon: const Icon(Icons.lock_outlined),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => v == null || v.isEmpty ? 'Ingresa tu contraseña' : null,
                              onChanged: (_) => setState(() {}),
                            ),
                            // Password strength for login field
                            if (_passController.text.isNotEmpty) _buildStrengthBar(_passwordStrength(_passController.text)),
                            const SizedBox(height: 8),
                            // Remember me checkbox
                            Row(children: [
                              SizedBox(
                                width: 20, height: 20,
                                child: Checkbox(value: _rememberMe, onChanged: (v) => setState(() => _rememberMe = v ?? false), activeColor: AppColors.primary, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                              ),
                              const SizedBox(width: 6),
                              const Text('Recordar sesión', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            ]),
                            const SizedBox(height: 4),
                            // Forgot password
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: isLocked ? null : _forgotPassword,
                                child: const Text('¿Olvidaste tu contraseña?', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500)),
                                style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Consumer<AuthProvider>(builder: (_, auth, __) => SizedBox(
                              width: double.infinity, height: 50,
                              child: ElevatedButton(
                                onPressed: (auth.isLoading || isLocked) ? null : _login,
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
                                child: isLocked
                                    ? Text('Espera ${_cooldownRemaining}s', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600))
                                    : auth.isLoading
                                        ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                                        : const Text('Iniciar Sesión', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                              ),
                            )),
                          ]),
                        ),
                        const SizedBox(height: 16),
                        TextButton(onPressed: _showRegisterDialog, child: const Text('¿No tienes cuenta? Regístrate', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500))),
                        const SizedBox(height: 4),
                        const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.shield_outlined, color: Colors.white54, size: 14),
                          SizedBox(width: 6),
                          Text('Inicios de sesión seguros', style: TextStyle(color: Colors.white54, fontSize: 12)),
                        ]),
                        const SizedBox(height: 16),
                        // Conectar con servidor button (prominent)
                        OutlinedButton.icon(
                          onPressed: () => ServerConfigDialog.show(context),
                          icon: const Icon(Icons.dns, size: 18),
                          label: const Text('Conectar con servidor', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white54, width: 1.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ======================== PLACEHOLDER SCREENS ========================
// Each screen is a fully functional scaffold with proper structure

class _HomeScreen extends StatefulWidget {
  const _HomeScreen();
  @override
  State<_HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<_HomeScreen> {
  int _currentNav = 0;
  String _searchQuery = '';
  List<Banner> _banners = [];
  int _bannerPage = 0;
  Timer? _bannerTimer;
  bool _loadingBanners = true;
  bool _expandedHowToBuy = false;
  late PageController _bannerController;
  String _operatingZone = 'Cúcuta';
  String _businessHours = AppStrings.businessHours;
  String _deliveryZoneInfo = '';

  @override
  void initState() {
    super.initState();
    _bannerController = PageController();
    _loadData();
    _loadBanners();
    _loadPublicSettings();
    _bannerTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_banners.isNotEmpty && mounted) {
        final nextPage = (_bannerPage + 1) % _banners.length;
        _bannerController.animateToPage(nextPage, duration: const Duration(milliseconds: 400), curve: Curves.easeInOut);
      }
    });
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _bannerController.dispose();
    super.dispose();
  }

  void _loadData() {
    final pp = context.read<ProductProvider>();
    pp.loadCategories();
    pp.loadProducts();
  }

  Future<void> _loadPublicSettings() async {
    try {
      final sp = context.read<SettingsProvider>();
      await sp.loadPublicSettings();
      if (mounted) setState(() {
        _operatingZone = sp.operatingZoneRadius > 0 ? '${AppStrings.businessCity} y zonas aledañas' : 'Cúcuta y zonas aledañas';
        _businessHours = sp.businessHours;
        _deliveryZoneInfo = 'Cobertura: ${AppStrings.businessCity} · Envío gratis en pedidos mayores a ${formatCOP(sp.freeDeliveryMin)}';
      });
    } catch (_) {}
  }

  Future<void> _loadBanners() async {
    try {
      final sp = context.read<SettingsProvider>();
      final baseUrl = sp.serverUrl;
      if (baseUrl.isEmpty) return;
      final resp = await http.get(Uri.parse('$baseUrl/api/banners'), headers: {'Content-Type': 'application/json'});
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        if (mounted) setState(() { _banners = (data['banners'] as List).map((j) => Banner.fromJson(j)).toList(); _loadingBanners = false; });
      } else { if (mounted) setState(() => _loadingBanners = false); }
    } catch (_) { if (mounted) setState(() => _loadingBanners = false); }
  }

  void _onNavTap(int index) {
    setState(() => _currentNav = index);
    if (index == 0) {
      context.read<ProductProvider>().loadProducts(refresh: true);
    } else if (index == 1) {
      // Categories placeholder
    } else if (index == 2) {
      Navigator.pushNamed(context, '/cart');
    } else if (index == 3) {
      Navigator.pushNamed(context, '/my-orders');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        title: GestureDetector(
          onTap: () => Navigator.pushNamed(context, '/search'),
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.search, color: Colors.white70, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Buscar productos...',
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: Colors.white),
            onPressed: () => Navigator.pushNamed(context, '/notifications'),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: Consumer<ProductProvider>(
        builder: (_, pp, __) {
          if (pp.isLoading && pp.products.isEmpty) {
            return const LoadingShimmer();
          }
          if (pp.error != null && pp.products.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text(pp.error!, style: const TextStyle(color: AppColors.error)),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => pp.refresh(),
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () => pp.refresh(),
            child: CustomScrollView(
              slivers: [
                // ─── Banner Carousel ───
                if (_banners.isNotEmpty) _buildBannerCarousel(),
                if (_banners.isNotEmpty) const SliverToBoxAdapter(child: SizedBox(height: 16)),
                // ─── Categories ───
                _buildCategoriesRow(pp.categories),
                if (pp.categories.isNotEmpty) const SliverToBoxAdapter(child: SizedBox(height: 8)),
                // ─── Cómo comprar ───
                SliverToBoxAdapter(child: _buildHowToBuyCard()),
                const SliverToBoxAdapter(child: SizedBox(height: 12)),
                // ─── Zona de entrega ───
                SliverToBoxAdapter(child: _buildDeliveryZoneCard()),
                const SliverToBoxAdapter(child: SizedBox(height: 16)),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: 0.65,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) {
                        if (i >= pp.products.length) {
                          if (pp.hasMore) {
                            pp.loadMore();
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                            );
                          }
                          return null;
                        }
                        final product = pp.products[i];
                        return ProductCard(
                          product: product,
                          onTap: () => Navigator.pushNamed(context, '/product', arguments: {'id': product.id}),
                          onAddToCart: () {
                            context.read<CartProvider>().addProduct(product);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('${product.name} agregado al carrito'), backgroundColor: AppColors.primary, duration: Duration(seconds: 1)),
                            );
                          },
                        );
                      },
                      childCount: pp.products.length + (pp.hasMore ? 1 : 0),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: BottomNavBar(currentIndex: _currentNav, onTap: _onNavTap),
    );
  }

  Widget _buildCategoriesRow(List<Category> categories) {
    if (categories.isEmpty) return const SliverToBoxAdapter.shrink();
    return SliverToBoxAdapter(
      child: SizedBox(
        height: 100,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: categories.length,
          itemBuilder: (_, i) {
            final cat = categories[i];
            return GestureDetector(
              onTap: () => Navigator.pushNamed(context, '/category', arguments: {'id': cat.id}),
              child: Container(
                width: 80,
                margin: const EdgeInsets.only(right: 10),
                child: Column(
                  children: [
                    Container(
                      width: 56, height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.category, color: AppColors.primary, size: 28),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      cat.name,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildBannerCarousel() {
    return SliverToBoxAdapter(
      child: Column(
        children: [
          SizedBox(
            height: 160,
            child: PageView.builder(
              controller: _bannerController,
              onPageChanged: (i) => setState(() => _bannerPage = i),
              itemCount: _banners.length,
              itemBuilder: (_, i) {
                final b = _banners[i];
                final bgColor = _tryParseColor(b.bgColor);
                final txtColor = _tryParseColor(b.textColor);
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(gradient: LinearGradient(colors: [bgColor, bgColor.withOpacity(0.8)]), borderRadius: BorderRadius.circular(14), boxShadow: [BoxShadow(color: bgColor.withOpacity(0.3), blurRadius: 8)]),
                  child: b.imageUrl != null && b.imageUrl!.isNotEmpty
                      ? ClipRRect(borderRadius: BorderRadius.circular(14), child: CachedNetworkImage(imageUrl: b.imageUrl!, fit: BoxFit.cover))
                      : Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(b.title, style: TextStyle(color: txtColor, fontSize: 20, fontWeight: FontWeight.bold)),
                          if (b.subtitle != null) ...[const SizedBox(height: 6), Text(b.subtitle!, style: TextStyle(color: txtColor.withOpacity(0.9), fontSize: 14))],
                        ])),
                );
              },
            ),
          ),
          if (_banners.length > 1) Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_banners.length, (i) => Container(
                width: i == _bannerPage ? 20 : 6,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(3), color: i == _bannerPage ? AppColors.primary : AppColors.lightGray),
              )),
            ),
          ),
        ],
      ),
    );
  }

  Color _tryParseColor(String hex) {
    try { return Color(int.parse(hex.replaceFirst('#', '0xFF'))); } catch (_) { return AppColors.primary; }
  }

  Widget _buildHowToBuyCard() {
    final sp = context.read<SettingsProvider>();
    final steps = ['Regístrate con tu correo y teléfono', 'Agrega productos al carrito', 'Elige entrega a domicilio o recoger en tienda', 'Paga con el método que prefieras', '¡Recibe tu pedido!'];
    return Card(margin: const EdgeInsets.symmetric(horizontal: 12), child: Theme(data: Theme.of(context).copyWith(dividerColor: Colors.transparent), child: ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.help_outline, color: AppColors.primary)),
      title: const Text('¿Cómo comprar?', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      trailing: Icon(_expandedHowToBuy ? Icons.expand_less : Icons.expand_more, color: AppColors.primary),
      onExpansionChanged: (v) => setState(() => _expandedHowToBuy = v),
      children: [Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Column(children: steps.asMap().entries.map((e) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 26, height: 26, margin: const EdgeInsets.only(right: 12), decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(13)), child: Center(child: Text('${e.key + 1}', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)))),
            Expanded(child: Text(e.value, style: const TextStyle(fontSize: 14, height: 1.4))),
          ]))).toList()))],
    )));
  }

  Widget _buildDeliveryZoneCard() {
    return Card(margin: const EdgeInsets.symmetric(horizontal: 12), child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => Navigator.pushNamed(context, '/help'),
      child: Padding(padding: const EdgeInsets.all(16), child: Row(children: [
        const Icon(Icons.delivery_dining, color: AppColors.primary, size: 32),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Zona de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 4),
          Text(_deliveryZoneInfo.isNotEmpty ? _deliveryZoneInfo : '$_operatingZone · $_businessHours', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ])),
        const Icon(Icons.chevron_right, color: AppColors.gray),
      ])),
    ));
  }
}

// ======================== PRODUCT DETAIL ============================

class _ProductDetailScreen extends StatefulWidget {
  final int productId;
  const _ProductDetailScreen({required this.productId});
  @override
  State<_ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<_ProductDetailScreen> {
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    context.read<ProductProvider>().loadProduct(widget.productId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Detalle Producto', showBack: true),
      body: Consumer<ProductProvider>(
        builder: (_, pp, __) {
          if (pp.isLoadingDetail) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }
          final p = pp.selectedProduct;
          if (p == null) {
            return const Center(child: Text('Producto no encontrado'));
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 250,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.lightGray,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: p.image != null && p.image!.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.cover),
                        )
                      : const Icon(Icons.shopping_bag, size: 80, color: AppColors.gray),
                ),
                const SizedBox(height: 16),
                if (p.isOffer && p.offerPrice != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(6)),
                    child: const Text('OFERTA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                  ),
                const SizedBox(height: 8),
                Text(p.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                if (p.brand != null) ...[
                  const SizedBox(height: 4),
                  Text(p.brand!, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                ],
                const SizedBox(height: 12),
                MoneyText(amount: p.effectivePrice, size: MoneySize.large, compareAmount: p.comparePrice),
                if (p.isPricedByWeight) const SizedBox(height: 4),
                if (p.isPricedByWeight)
                  Text('Precio por ${p.displayUnit}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 12),
                Text(p.description.isNotEmpty ? p.description : 'Sin descripción disponible',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5)),
                const SizedBox(height: 24),
                Row(
                  children: [
                    QuantityStepper(
                      quantity: _qty,
                      max: p.stock,
                      onChanged: (v) => setState(() => _qty = v),
                    ),
                    const Spacer(),
                    Text('Subtotal: ', style: const TextStyle(fontSize: 16, color: AppColors.textSecondary)),
                    MoneyText(amount: p.effectivePrice * _qty, size: MoneySize.medium),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: p.inStock
                        ? () {
                            context.read<CartProvider>().addProduct(p, quantity: _qty);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Producto agregado al carrito'), backgroundColor: AppColors.primary, duration: Duration(seconds: 1)),
                            );
                          }
                        : null,
                    icon: const Icon(Icons.shopping_cart, size: 20),
                    label: Text(p.inStock ? 'Agregar al Carrito' : 'Agotado', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ======================== CART SCREEN ========================

class _CartScreen extends StatelessWidget {
  const _CartScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Mi Carrito', showBack: true),
      body: Consumer<CartProvider>(
        builder: (_, cart, __) {
          if (cart.items.isEmpty) {
            return const EmptyState(
              icon: Icons.shopping_cart_outlined,
              title: 'Tu carrito está vacío',
              subtitle: 'Agrega productos para comenzar tu pedido',
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: cart.items.length,
                  itemBuilder: (_, i) {
                    final item = cart.items[i];
                    final p = item.product;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Row(
                          children: [
                            Container(
                              width: 60, height: 60,
                              decoration: BoxDecoration(
                                color: AppColors.lightGray,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: p.image != null && p.image!.isNotEmpty
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.cover),
                                    )
                                  : const Icon(Icons.shopping_bag, color: AppColors.gray),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  const SizedBox(height: 4),
                                  MoneyText(amount: p.effectivePrice, size: MoneySize.small),
                                ],
                              ),
                            ),
                            QuantityStepper(
                              quantity: item.quantity,
                              max: p.stock,
                              onChanged: (v) => cart.updateQty(p.id, v),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 22),
                              onPressed: () => cart.removeProduct(p.id),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              _buildCartSummary(cart, context),
            ],
          );
        },
      ),
    );
  }

  Widget _buildCartSummary(CartProvider cart, BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, -2))],
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Subtotal', style: TextStyle(color: AppColors.textSecondary)),
                Text(formatCOP(cart.subtotal), style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Domicilio', style: TextStyle(color: AppColors.textSecondary)),
                Text(
                  cart.deliveryFee == 0 ? 'GRATIS' : formatCOP(cart.deliveryFee),
                  style: TextStyle(fontWeight: FontWeight.w500, color: cart.deliveryFee == 0 ? AppColors.success : null),
                ),
              ],
            ),
            if (cart.discount > 0) ...[
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Descuento', style: TextStyle(color: AppColors.success)),
                  Text('-${formatCOP(cart.discount)}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.success)),
                ],
              ),
            ],
            if (cart.subtotal < 50000) ...[
              const SizedBox(height: 6),
              const Text(
                '¡Envío gratis en pedidos mayores a ${AppStrings.currencySymbol}50.000!',
                style: TextStyle(color: AppColors.accent, fontSize: 12),
              ),
            ],
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                MoneyText(amount: cart.total, size: MoneySize.large),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, '/checkout'),
                child: const Text('Ir a Pagar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ======================== REMAINING SCREENS (fully functional scaffolds) ========================

class _CheckoutScreen extends StatefulWidget {
  const _CheckoutScreen();
  @override
  State<_CheckoutScreen> createState() => _CheckoutScreenState();
}
class _CheckoutScreenState extends State<_CheckoutScreen> {
  String _fulfillmentType = 'delivery';
  String _paymentMethod = 'efectivo';
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  @override
  void dispose() { _notesCtrl.dispose(); super.dispose(); }
  Future<void> _submitOrder() async {
    setState(() => _submitting = true);
    final op = context.read<OrderProvider>();
    final ok = await op.createOrder(fulfillmentType: _fulfillmentType, paymentMethod: _paymentMethod, notes: _notesCtrl.text.trim());
    if (!mounted) return;
    setState(() => _submitting = false);
    if (ok && op.orders.isNotEmpty) {
      context.read<CartProvider>().clear();
      Navigator.pushNamedAndRemoveUntil(context, '/order', ModalRoute.withName('/home'), arguments: {'id': op.orders.first.id});
    } else { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(op.error ?? 'Error al crear pedido'), backgroundColor: AppColors.error)); }
  }
  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    if (cart.items.isEmpty) return Scaffold(appBar: const CustomAppBar(title: 'Checkout', showBack: true), body: const EmptyState(icon: Icons.shopping_cart, title: 'Carrito vacío', subtitle: 'Agrega productos primero'));
    return Scaffold(appBar: const CustomAppBar(title: 'Finalizar Pedido', showBack: true), body: ListView(padding: const EdgeInsets.all(16), children: [
      // Tipo de entrega
      const Text('Tipo de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: _buildTypeCard('Domicilio', Icons.delivery_dining, 'delivery')),
        const SizedBox(width: 10),
        Expanded(child: _buildTypeCard('Recoger en tienda', Icons.store, 'pickup')),
      ]),
      const SizedBox(height: 16),
      if (_fulfillmentType == 'delivery') Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Dirección de entrega', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        InkWell(onTap: () => Navigator.pushNamed(context, '/addresses'), child: Row(children: [const Icon(Icons.location_on, color: AppColors.primary), const SizedBox(width: 8), Expanded(child: Text('Seleccionar dirección', style: TextStyle(color: AppColors.textSecondary))), const Icon(Icons.chevron_right)])),
      ])),
      if (_fulfillmentType == 'pickup') Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Recoger en', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        const Text('KDX 1-2B Los Mangos, Cúcuta', style: TextStyle(fontSize: 14)),
        const SizedBox(height: 2),
        const Text('Lun-Sáb: 6:00 AM - 6:00 PM', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
      ])),
      const SizedBox(height: 16),
      // Método de pago
      const Text('Método de pago', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 8),
      ...['efectivo', 'nequi', 'daviplata', 'tarjeta'].map((m) => RadioListTile<String>(
        value: m, groupValue: _paymentMethod, onChanged: (v) => setState(() => _paymentMethod = v!),
        title: Text({'efectivo': 'Efectivo', 'nequi': 'Nequi', 'daviplata': 'Daviplata', 'tarjeta': 'Tarjeta'}[m]!),
        secondary: Icon({'efectivo': Icons.payments_outlined, 'nequi': Icons.phone_android, 'daviplata': Icons.phone_android, 'tarjeta': Icons.credit_card}[m]!, color: AppColors.primary),
        activeColor: AppColors.primary, contentPadding: EdgeInsets.zero, dense: true,
      )),
      const SizedBox(height: 16),
      // Notas
      TextField(controller: _notesCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Notas del pedido (opcional)', prefixIcon: Icon(Icons.notes))),
      const SizedBox(height: 16),
      // Resumen
      Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Resumen del pedido', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 10),
        _buildSummaryRow('Subtotal', formatCOP(cart.subtotal)),
        _buildSummaryRow('Domicilio', cart.deliveryFee == 0 ? 'GRATIS' : formatCOP(cart.deliveryFee)),
        if (cart.discount > 0) _buildSummaryRow('Descuento', '-${formatCOP(cart.discount)}', color: AppColors.success),
        const Divider(height: 20),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)), MoneyText(amount: cart.total, size: MoneySize.large)]),
      ])),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, height: 50, child: ElevatedButton(
        onPressed: _submitting ? null : _submitOrder,
        child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Confirmar Pedido', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      )),
      const SizedBox(height: 40),
    ]));
  }
  Widget _buildTypeCard(String title, IconData icon, String type) {
    final selected = _fulfillmentType == type;
    return InkWell(onTap: () => setState(() => _fulfillmentType = type), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(border: Border.all(color: selected ? AppColors.primary : AppColors.lightGray, width: selected ? 2 : 1), borderRadius: BorderRadius.circular(12), color: selected ? AppColors.primary.withOpacity(0.05) : null), child: Column(children: [Icon(icon, color: selected ? AppColors.primary : AppColors.gray, size: 28), const SizedBox(height: 6), Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? AppColors.primary : AppColors.textSecondary, fontSize: 13))]))) ;
  }
  Widget _buildSummaryRow(String label, String value, {Color? color}) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(color: AppColors.textSecondary)), Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: color))])) ;
}

class _SearchScreen extends StatefulWidget {
  const _SearchScreen();
  @override
  State<_SearchScreen> createState() => _SearchScreenState();
}
class _SearchScreenState extends State<_SearchScreen> {
  final _ctrl = TextEditingController();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary, foregroundColor: Colors.white,
        title: TextField(
          controller: _ctrl,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Buscar...', hintStyle: TextStyle(color: Colors.white54),
            border: InputBorder.none,
          ),
          textInputAction: TextInputAction.search,
          onSubmitted: (q) {
            if (q.isNotEmpty) {
              context.read<ProductProvider>().searchProducts(q);
              Navigator.pop(context);
            }
          },
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
    );
  }
}

class _CategoryScreen extends StatefulWidget {
  final int categoryId;
  const _CategoryScreen({required this.categoryId});
  @override
  State<_CategoryScreen> createState() => _CategoryScreenState();
}
class _CategoryScreenState extends State<_CategoryScreen> {
  @override
  void initState() {
    super.initState();
    context.read<ProductProvider>().loadProducts(categoryId: widget.categoryId);
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Categoría', showBack: true),
      body: Consumer<ProductProvider>(
        builder: (_, pp, __) {
          if (pp.isLoading && pp.products.isEmpty) return const LoadingShimmer();
          if (pp.products.isEmpty) return const EmptyState(icon: Icons.inventory_2, title: 'Sin productos', subtitle: 'No hay productos en esta categoría');
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 0.65, crossAxisSpacing: 10, mainAxisSpacing: 10),
            itemCount: pp.products.length,
            itemBuilder: (_, i) {
              final p = pp.products[i];
              return ProductCard(
                product: p,
                onTap: () => Navigator.pushNamed(context, '/product', arguments: {'id': p.id}),
                onAddToCart: () {
                  context.read<CartProvider>().addProduct(p);
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${p.name} agregado'), backgroundColor: AppColors.primary, duration: const Duration(seconds: 1)));
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _MyOrdersScreen extends StatefulWidget {
  const _MyOrdersScreen();
  @override
  State<_MyOrdersScreen> createState() => _MyOrdersScreenState();
}
class _MyOrdersScreenState extends State<_MyOrdersScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadMyOrders();
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Mis Pedidos', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoading && op.orders.isEmpty) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          if (op.orders.isEmpty) return const EmptyState(icon: Icons.receipt_long_outlined, title: 'Sin pedidos', subtitle: 'Aún no has realizado ningún pedido');
          return RefreshIndicator(
            onRefresh: () => op.loadMyOrders(refresh: true),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: op.orders.length,
              itemBuilder: (_, i) {
                final o = op.orders[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: InkWell(
                    onTap: () => Navigator.pushNamed(context, '/order', arguments: {'id': o.id}),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(o.displayNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              OrderStatusChip(status: o.status),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text('${o.items.length} productos', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                          const SizedBox(height: 4),
                          if (o.createdAt != null) Text(formatRelative(o.createdAt!), style: const TextStyle(color: AppColors.gray, fontSize: 12)),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Total', style: const TextStyle(color: AppColors.textSecondary)),
                              MoneyText(amount: o.total, size: MoneySize.medium),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _OrderDetailScreen extends StatefulWidget {
  final int orderId;
  const _OrderDetailScreen({required this.orderId});
  @override
  State<_OrderDetailScreen> createState() => _OrderDetailScreenState();
}
class _OrderDetailScreenState extends State<_OrderDetailScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadOrder(widget.orderId);
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Pedido #${widget.orderId.toString().padLeft(4, '0')}', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoadingCurrent) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          final o = op.currentOrder;
          if (o == null) return const Center(child: Text('Pedido no encontrado'));
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text(o.displayNumber, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  OrderStatusChip(status: o.status),
                ]),
                const SizedBox(height: 16),
                const Text('Productos', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                const SizedBox(height: 8),
                ...o.items.map((item) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.lightGray, borderRadius: BorderRadius.circular(6)), child: item.image != null ? ClipRRect(borderRadius: BorderRadius.circular(6), child: CachedNetworkImage(imageUrl: item.image!, fit: BoxFit.cover)) : const Icon(Icons.shopping_bag, color: AppColors.gray, size: 20)),
                    title: Text(item.productName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500), maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text('${item.qty} x ${formatCOP(item.unitPrice)}'),
                    trailing: Text(formatCOP(item.lineTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                )),
                const Divider(height: 24),
                _buildDetailRow('Subtotal', formatCOP(o.subtotal)),
                _buildDetailRow('Domicilio', formatCOP(o.deliveryFee)),
                if (o.discount > 0) _buildDetailRow('Descuento', '-${formatCOP(o.discount)}', color: AppColors.success),
                if (o.taxTotal > 0) _buildDetailRow('IVA', formatCOP(o.taxTotal)),
                const Divider(height: 24),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  MoneyText(amount: o.total, size: MoneySize.large),
                ]),
                if (o.canRate) ...[
                  const SizedBox(height: 24),
                  SizedBox(width: double.infinity, height: 48, child: ElevatedButton(onPressed: () => Navigator.pushNamed(context, '/rate', arguments: {'id': o.id}), child: const Text('Calificar Pedido', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)))),
                ],
                if (o.canCancel) ...[
                  const SizedBox(height: 12),
                  SizedBox(width: double.infinity, height: 48, child: OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)), onPressed: () async {
                    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(title: const Text('Cancelar Pedido'), content: const TextField(decoration: InputDecoration(labelText: 'Motivo de cancelación')), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No')), ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Sí, cancelar'), style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white))]));
                    if (ok == true) {
                      await op.cancelOrder(o.id, 'Cancelado por el cliente');
                      if (mounted) Navigator.pop(context);
                    }
                  }, child: const Text('Cancelar Pedido', style: TextStyle(fontWeight: FontWeight.w600)))),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
  Widget _buildDetailRow(String label, String value, {Color? color}) {
    return Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: const TextStyle(color: AppColors.textSecondary)),
      Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
    ]));
  }
}

class _OrderTrackingScreen extends StatefulWidget {
  final int orderId;
  const _OrderTrackingScreen({required this.orderId});
  @override
  State<_OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}
class _OrderTrackingScreenState extends State<_OrderTrackingScreen> {
  @override
  void initState() {
    super.initState();
    context.read<OrderProvider>().loadOrder(widget.orderId);
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(title: 'Rastrear Pedido', showBack: true),
      body: Consumer<OrderProvider>(
        builder: (_, op, __) {
          if (op.isLoadingCurrent) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          final o = op.currentOrder;
          if (o == null) return const Center(child: Text('Pedido no encontrado'));
          final steps = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'in_transit', 'delivered'];
          final statusLabels = {'pending': 'Pendiente', 'confirmed': 'Confirmado', 'preparing': 'Preparando', 'ready': 'Listo', 'assigned': 'Asignado', 'in_transit': 'En camino', 'delivered': 'Entregado'};
          final currentIdx = steps.indexOf(o.status);
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(o.displayNumber, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('Repartidor: ${o.workerName ?? 'Por asignar'}', style: const TextStyle(color: AppColors.textSecondary)),
                const SizedBox(height: 24),
                ...steps.asMap().entries.map((e) {
                  final i = e.key;
                  final s = e.value;
                  final isActive = i <= currentIdx;
                  final isCurrent = i == currentIdx;
                  return _buildStep(i, steps.length, statusLabels[s]!, isActive, isCurrent);
                }),
                if (o.isPickup && o.pickupCode != null) ...[
                  const SizedBox(height: 24),
                  const Text('Código de recogida:', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Text(o.pickupCode!, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppColors.primary, letterSpacing: 8)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
  Widget _buildStep(int index, int total, String label, bool active, bool current) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 32,
            child: Column(
              children: [
                Container(width: 28, height: 28, decoration: BoxDecoration(shape: BoxShape.circle, color: active ? AppColors.primary : AppColors.lightGray), child: active ? const Icon(Icons.check, color: Colors.white, size: 16) : null),
                if (index < total - 1) Expanded(child: Container(width: 2, color: active ? AppColors.primary : AppColors.lightGray)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(label, style: TextStyle(fontSize: 14, fontWeight: current ? FontWeight.bold : FontWeight.normal, color: active ? AppColors.textPrimary : AppColors.gray)),
          ),
        ],
      ),
    );
  }
}

class _AddressesScreen extends StatefulWidget {
  const _AddressesScreen();
  @override
  State<_AddressesScreen> createState() => _AddressesScreenState();
}
class _AddressesScreenState extends State<_AddressesScreen> {
  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _loadAddresses(); }

  Future<void> _loadAddresses() async {
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final resp = await http.get(Uri.parse('${sp.serverUrl}/api/addresses'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'});
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        final list = data['data'] as List? ?? [];
        setState(() { _addresses = list.map((e) => e as Map<String, dynamic>).toList(); _loading = false; });
      } else { if (mounted) setState(() => _loading = false); }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _deleteAddress(String id) async {
    final confirm = await showDialog<bool>(context: context, builder: (_) => AlertDialog(title: const Text('Eliminar dirección'), content: const Text('¿Estás seguro de eliminar esta dirección?'), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')), ElevatedButton(onPressed: () => Navigator.pop(context, true), style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white), child: const Text('Eliminar'))]));
    if (confirm != true) return;
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.delete(Uri.parse('${sp.serverUrl}/api/addresses/$id'), headers: {'Authorization': 'Bearer $token'});
      if (mounted) { _loadAddresses(); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Dirección eliminada'), backgroundColor: AppColors.primary)); }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al eliminar'), backgroundColor: AppColors.error));
    }
  }

  Future<void> _setDefault(String id) async {
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.put(Uri.parse('${sp.serverUrl}/api/addresses/$id'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'}, body: jsonEncode({'is_default': 1}));
      if (mounted) { _loadAddresses(); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Dirección principal actualizada'), backgroundColor: AppColors.primary)); }
    } catch (_) {}
  }

  void _showAddDialog({Map<String, dynamic>? existing}) {
    final labelCtrl = TextEditingController(text: existing?['label'] ?? '');
    final addressCtrl = TextEditingController(text: existing?['address'] ?? '');
    final neighborhoodCtrl = TextEditingController(text: existing?['neighborhood'] ?? '');
    final cityCtrl = TextEditingController(text: existing?['city'] ?? 'Cúcuta');
    final phoneCtrl = TextEditingController(text: existing?['phone'] ?? '');
    final notesCtrl = TextEditingController(text: existing?['detail'] ?? '');
    final isEdit = existing != null;
    showDialog(context: context, builder: (ctx) => AlertDialog(title: Text(isEdit ? 'Editar dirección' : 'Nueva dirección'), content: SingleChildScrollView(child: Column(children: [
      TextField(controller: labelCtrl, decoration: const InputDecoration(labelText: 'Etiqueta (ej: Casa, Oficina)'), textCapitalization: TextCapitalization.words),
      const SizedBox(height: 10),
      TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Dirección *')),
      const SizedBox(height: 10),
      TextField(controller: neighborhoodCtrl, decoration: const InputDecoration(labelText: 'Barrio')),
      const SizedBox(height: 10),
      TextField(controller: cityCtrl, decoration: const InputDecoration(labelText: 'Ciudad')),
      const SizedBox(height: 10),
      TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Teléfono'), keyboardType: TextInputType.phone),
      const SizedBox(height: 10),
      TextField(controller: notesCtrl, decoration: const InputDecoration(labelText: 'Notas (torre, apto, referencia)'), maxLines: 2),
    ])), actions: [
      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
      ElevatedButton(onPressed: () async {
        if (addressCtrl.text.trim().isEmpty) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('La dirección es obligatoria'), backgroundColor: AppColors.error)); return; }
        Navigator.pop(ctx);
        try {
          final sp = context.read<SettingsProvider>();
          final token = await StorageService.getToken();
          final body = {'label': labelCtrl.text.trim().isEmpty ? null : labelCtrl.text.trim(), 'address': addressCtrl.text.trim(), 'neighborhood': neighborhoodCtrl.text.trim().isEmpty ? null : neighborhoodCtrl.text.trim(), 'city': cityCtrl.text.trim(), 'detail': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim()};
          if (isEdit) {
            await http.put(Uri.parse('${sp.serverUrl}/api/addresses/${existing!['id']}'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'}, body: jsonEncode(body));
          } else {
            await http.post(Uri.parse('${sp.serverUrl}/api/addresses'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'}, body: jsonEncode(body));
          }
          if (mounted) { _loadAddresses(); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(isEdit ? 'Dirección actualizada' : 'Dirección creada'), backgroundColor: AppColors.primary)); }
        } catch (_) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al guardar dirección'), backgroundColor: AppColors.error));
        }
      }, child: Text(isEdit ? 'Guardar' : 'Crear')),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Mis Direcciones', showBack: true), floatingActionButton: FloatingActionButton(onPressed: () => _showAddDialog(), child: const Icon(Icons.add),), body: _loading ? const Center(child: CircularProgressIndicator(color: AppColors.primary)) : _addresses.isEmpty ? const EmptyState(icon: Icons.location_off_outlined, title: 'Sin direcciones', subtitle: 'Agrega una dirección para recibir tus pedidos', buttonText: 'Agregar dirección', onButtonPressed: null) : RefreshIndicator(onRefresh: _loadAddresses, child: ListView.builder(padding: const EdgeInsets.all(12).copyWith(bottom: 80), itemCount: _addresses.length, itemBuilder: (_, i) {
      final a = _addresses[i];
      final isDefault = a['is_default'] == 1 || a['is_default'] == true;
      return Card(margin: const EdgeInsets.only(bottom: 10), child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Row(children: [
            if (isDefault) Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)), margin: const EdgeInsets.only(right: 8), child: const Text('Principal', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
            if (a['label'] != null) Text(a['label'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
          ])),
          PopupMenuButton<String>(onSelected: (v) { if (v == 'edit') _showAddDialog(existing: a); else if (v == 'default') _setDefault(a['id'] as String); else if (v == 'delete') _deleteAddress(a['id'] as String); }, itemBuilder: (_) => [
            if (!isDefault) const PopupMenuItem(value: 'default', child: Text('Establecer como principal')),
            const PopupMenuItem(value: 'edit', child: Text('Editar')),
            const PopupMenuItem(value: 'delete', child: Text('Eliminar', style: TextStyle(color: AppColors.error))),
          ]),
        ]),
        const SizedBox(height: 8),
        Row(children: [const Icon(Icons.location_on, size: 16, color: AppColors.primary), const SizedBox(width: 6), Expanded(child: Text(a['address'] as String, style: const TextStyle(fontSize: 14)))]),
        if (a['neighborhood'] != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text("${a['neighborhood']}, ${a['city'] ?? 'Cúcuta'}", style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
        if (a['detail'] != null && (a['detail'] as String).isNotEmpty) ...[const SizedBox(height: 4), Padding(padding: const EdgeInsets.only(top: 2), child: Text(a['detail'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontStyle: FontStyle.italic)))],
      ]),
    ])));
    }))));
  }
}
class _AddressPickerScreen extends StatefulWidget {
  const _AddressPickerScreen();
  @override
  State<_AddressPickerScreen> createState() => _AddressPickerScreenState();
}
class _AddressPickerScreenState extends State<_AddressPickerScreen> {
  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _loadAddresses(); }

  Future<void> _loadAddresses() async {
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final resp = await http.get(Uri.parse('${sp.serverUrl}/api/addresses'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'});
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        final list = data['data'] as List? ?? [];
        setState(() { _addresses = list.map((e) => e as Map<String, dynamic>).toList(); _loading = false; });
      } else { if (mounted) setState(() => _loading = false); }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Seleccionar Dirección', showBack: true), body: _loading ? const Center(child: CircularProgressIndicator(color: AppColors.primary)) : _addresses.isEmpty ? const EmptyState(icon: Icons.location_off_outlined, title: 'Sin direcciones', subtitle: 'Primero agrega una dirección desde tu perfil') : ListView.builder(padding: const EdgeInsets.all(12), itemCount: _addresses.length, itemBuilder: (_, i) {
      final a = _addresses[i];
      final isDefault = a['is_default'] == 1 || a['is_default'] == true;
      return Card(margin: const EdgeInsets.only(bottom: 8), child: InkWell(borderRadius: BorderRadius.circular(12), onTap: () => Navigator.pop(context, a), child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [
        Container(width: 40, height: 40, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)), child: Icon(Icons.location_on, color: isDefault ? AppColors.primary : AppColors.gray)),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Text(a['label'] ?? a['address'], style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis), if (isDefault) ...[const SizedBox(width: 8), Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)), child: const Text('Principal', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold))])]),
          const SizedBox(height: 2),
          Text(a['address'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
          if (a['neighborhood'] != null) Text("${a['neighborhood']}, ${a['city'] ?? 'Cúcuta'}", style: const TextStyle(color: AppColors.gray, fontSize: 11)),
        ])),
        const Icon(Icons.check_circle_outline, color: AppColors.primary),
      ]))));
    })));
  }
}
class _FavoritesScreen extends StatefulWidget {
  const _FavoritesScreen();
  @override
  State<_FavoritesScreen> createState() => _FavoritesScreenState();
}
class _FavoritesScreenState extends State<_FavoritesScreen> {
  List<Product> _favorites = [];
  List<int> _favoriteIds = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _loadFavorites(); }

  Future<void> _loadFavorites() async {
    setState(() => _loading = true);
    try {
      _favoriteIds = await StorageService.getFavorites();
      if (_favoriteIds.isEmpty) { if (mounted) setState(() { _favorites = []; _loading = false; }); return; }
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final List<Product> loaded = [];
      for (final id in _favoriteIds) {
        try {
          final resp = await http.get(Uri.parse('${sp.serverUrl}/api/products/$id'), headers: {'Content-Type': 'application/json'});
          if (resp.statusCode == 200) {
            final data = jsonDecode(resp.body);
            final product = data['data'] ?? data['product'] ?? data;
            loaded.add(Product.fromJson(product as Map<String, dynamic>));
          }
        } catch (_) {}
      }
      if (mounted) setState(() { _favorites = loaded; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _removeFavorite(int productId) async {
    final newIds = _favoriteIds.where((id) => id != productId).toList();
    await StorageService.setFavorites(newIds);
    setState(() { _favoriteIds = newIds; _favorites.removeWhere((p) => p.id == productId); });
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Eliminado de favoritos'), backgroundColor: AppColors.primary));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Favoritos', showBack: true), body: _loading ? const LoadingShimmer() : _favorites.isEmpty ? const EmptyState(icon: Icons.favorite_border, title: 'Sin favoritos', subtitle: 'Agrega productos a tus favoritos tocando el corazón en cada producto', buttonText: 'Explorar productos', onButtonPressed: null) : RefreshIndicator(onRefresh: _loadFavorites, child: GridView.builder(padding: const EdgeInsets.all(12), gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 0.65, crossAxisSpacing: 10, mainAxisSpacing: 10), itemCount: _favorites.length, itemBuilder: (_, i) {
      final p = _favorites[i];
      return Stack(children: [
        ProductCard(product: p, onTap: () => Navigator.pushNamed(context, '/product', arguments: {'id': p.id}), onAddToCart: () { context.read<CartProvider>().addProduct(p); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${p.name} agregado al carrito'), backgroundColor: AppColors.primary, duration: const Duration(seconds: 1))); }),
        Positioned(top: 4, right: 4, child: GestureDetector(onTap: () => _removeFavorite(p.id), child: Container(decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(blurRadius: 4, offset: const Offset(0, 2), color: Colors.black.withOpacity(0.15))]), padding: const EdgeInsets.all(4), child: const Icon(Icons.favorite, color: AppColors.error, size: 20))
        )),
      ]);
    })));
  }
}
class _NotificationsScreen extends StatefulWidget {
  const _NotificationsScreen();
  @override
  State<_NotificationsScreen> createState() => _NotificationsScreenState();
}
class _NotificationsScreenState extends State<_NotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  int _unreadCount = 0;
  bool _loading = true;

  @override
  void initState() { super.initState(); _loadNotifications(); }

  Future<void> _loadNotifications() async {
    setState(() => _loading = true);
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final resp = await http.get(Uri.parse('${sp.serverUrl}/api/notifications'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'});
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        final list = data['data'] as List? ?? [];
        setState(() { _notifications = list.map((e) => e as Map<String, dynamic>).toList(); _unreadCount = data['unread_count'] ?? 0; _loading = false; });
      } else { if (mounted) setState(() => _loading = false); }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _markRead(String id) async {
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.post(Uri.parse('${sp.serverUrl}/api/notifications/$id/read'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'});
      setState(() {
        final idx = _notifications.indexWhere((n) => n['id'] == id);
        if (idx >= 0) { _notifications[idx]['read_at'] = DateTime.now().toIso8601String(); if (_unreadCount > 0) _unreadCount--; }
      });
    } catch (_) {}
  }

  IconData _getNotifIcon(String? type) {
    switch (type) {
      case 'order': return Icons.receipt_long;
      case 'promo': return Icons.local_offer;
      case 'delivery': return Icons.delivery_dining;
      default: return Icons.notifications;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: Text('Notificaciones${_unreadCount > 0 ? ' ($_unreadCount)' : ''}'), leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)), actions: [_unreadCount > 0 ? IconButton(icon: const Icon(Icons.done_all), tooltip: 'Marcar todo como leído', onPressed: () async { for (final n in _notifications.where((n) => n['read_at'] == null)) { await _markRead(n['id'] as String); } },) : const SizedBox.shrink()]), body: _loading ? const Center(child: CircularProgressIndicator(color: AppColors.primary)) : _notifications.isEmpty ? const EmptyState(icon: Icons.notifications_outlined, title: 'Sin notificaciones', subtitle: 'Aquí verás las novedades de tus pedidos') : RefreshIndicator(onRefresh: _loadNotifications, child: ListView.separated(padding: const EdgeInsets.all(12), itemCount: _notifications.length, separatorBuilder: (_, __) => const Divider(height: 1), itemBuilder: (_, i) {
      final n = _notifications[i];
      final isRead = n['read_at'] != null;
      return ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4), leading: Container(width: 42, height: 42, decoration: BoxDecoration(color: (isRead ? AppColors.lightGray : AppColors.primary.withOpacity(0.1)), shape: BoxShape.circle), child: Icon(_getNotifIcon(n['type']), color: isRead ? AppColors.gray : AppColors.primary, size: 22)), title: Text(n['title'] ?? 'Notificación', style: TextStyle(fontWeight: isRead ? FontWeight.normal : FontWeight.w600, fontSize: 14)), subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const SizedBox(height: 2), Text(n['body'] ?? n['message'] ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis), if (n['created_at'] != null) ...[const SizedBox(height: 4), Text(formatRelative(n['created_at'] as String), style: const TextStyle(color: AppColors.gray, fontSize: 11))]]), onTap: () { if (!isRead) _markRead(n['id'] as String); });
    })));
  }
}
class _PromoScreen extends StatefulWidget {
  const _PromoScreen();
  @override
  State<_PromoScreen> createState() => _PromoScreenState();
}
class _PromoScreenState extends State<_PromoScreen> {
  List<Map<String, dynamic>> _promos = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _loadPromos(); }

  Future<void> _loadPromos() async {
    setState(() => _loading = true);
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final resp = await http.get(Uri.parse('${sp.serverUrl}/api/promotions'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'});
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        final list = (data['data'] as List? ?? []).where((p) => p['is_active'] == 1 || p['is_active'] == true).toList();
        setState(() { _promos = list.cast<Map<String, dynamic>>(); _loading = false; _error = null; });
      } else if (mounted) {
        setState(() { _loading = false; _error = 'No se pudieron cargar las promociones'; });
      }
    } catch (_) { if (mounted) setState(() { _loading = false; _error = null; }); }
  }

  Future<void> _copyCode(String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Código $code copiado'), backgroundColor: AppColors.primary));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Promociones', showBack: true), body: _loading ? const Center(child: CircularProgressIndicator(color: AppColors.primary)) : _error != null ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.error_outline, size: 48, color: AppColors.error), const SizedBox(height: 12), Text(_error!, style: const TextStyle(color: AppColors.error)), const SizedBox(height: 16), ElevatedButton(onPressed: _loadPromos, child: const Text('Reintentar'))])) : _promos.isEmpty ? const EmptyState(icon: Icons.local_offer_outlined, title: 'Sin promociones activas', subtitle: 'Pronto habrá ofertas especiales para ti') : ListView.builder(padding: const EdgeInsets.all(12), itemCount: _promos.length, itemBuilder: (_, i) {
      final p = _promos[i];
      final value = p['value'];
      return Card(margin: const EdgeInsets.only(bottom: 10), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(6)), child: Text(p['code'] as String, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 1))), const Spacer(), Container(width: 32, height: 32, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.local_offer, color: AppColors.primary, size: 18))]),
        const SizedBox(height: 10),
        Text(p['name'] ?? 'Promoción', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 4),
        Builder(builder: (ctx) {
          final pType = p['type'] as String? ?? '';
          final minOrd = p['min_order'];
          String descText = '';
          if (pType == 'porcentaje') descText = "$value% de descuento";
          else if (pType == 'monto_fijo') descText = "${formatCOP((value is int ? value : (value as num).toInt()))} de descuento";
          else if (pType == 'envio_gratis') descText = 'Envío gratis en tu pedido';
          else descText = 'Promoción 2x1';
          if (minOrd != null && (minOrd as num) > 0) descText += ' · Pedido mín: ${formatCOP((minOrd is int ? minOrd : (minOrd as num).toInt()))}';
          return Text(descText, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13));
        }),
        const SizedBox(height: 12),
        SizedBox(width: double.infinity, height: 40, child: OutlinedButton.icon(onPressed: () => _copyCode(p['code'] as String), icon: const Icon(Icons.copy, size: 16), label: const Text('Copiar código'), style: OutlinedButton.styleFrom(foregroundColor: AppColors.primary, side: const BorderSide(color: AppColors.primary)))),
      ])));
    })));
  }
}
class _HelpScreen extends StatefulWidget {
  const _HelpScreen();
  @override
  State<_HelpScreen> createState() => _HelpScreenState();
}
class _HelpScreenState extends State<_HelpScreen> {
  bool _settingsLoaded = false;
  String _phone = AppStrings.businessPhone;
  String _email = AppStrings.businessEmail;
  String _address = AppStrings.businessAddress;
  String _hours = AppStrings.businessHours;
  String _whatsappNumber = '';
  String _deliveryZoneInfo = '';

  @override
  void initState() { super.initState(); _loadSettings(); }

  Future<void> _loadSettings() async {
    try {
      final sp = context.read<SettingsProvider>();
      await sp.loadPublicSettings();
      if (mounted) setState(() {
        _phone = sp.businessPhone;
        _email = sp.businessEmail;
        _address = sp.businessAddress;
        _hours = sp.businessHours;
        _whatsappNumber = _phone.replaceAll(RegExp(r'[^0-9]'), '');
        _deliveryZoneInfo = 'Cobertura: ${AppStrings.businessCity} y zonas aledañas · Envío gratis en pedidos mayores a ${formatCOP(sp.freeDeliveryMin)}';
        _settingsLoaded = true;
      });
    } catch (_) {}
  }

  void _launchWhatsApp() {
    final number = _whatsappNumber.isNotEmpty ? _whatsappNumber : _phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (number.isEmpty) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Número de WhatsApp no disponible'))); return; }
    Clipboard.setData(ClipboardData(text: 'https://wa.me/$number'));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Enlace de WhatsApp copiado: $number'), backgroundColor: AppColors.primary));
  }

  @override
  Widget build(BuildContext context) {
    final sp = context.read<SettingsProvider>();
    final faqs = [
      {'q': '¿Cuánto cuesta el envío?', 'a': "El envío tiene un costo de ${formatCOP(sp.deliveryFee)} y es gratis en pedidos mayores a ${formatCOP(sp.freeDeliveryMin)}."},
      {'q': '¿Cuál es la zona de cobertura?', 'a': "Realizamos entregas en ${AppStrings.businessCity} y zonas aledañas."},
      {'q': '¿Cuáles son los métodos de pago?', 'a': 'Aceptamos efectivo, Nequi, Daviplata y tarjeta.'},
      {'q': '¿Puedo cancelar mi pedido?', 'a': 'Sí, puedes cancelar tu pedido desde la sección \"Mis Pedidos\" mientras esté en estado pendiente o confirmado.'},
      {'q': '¿Cómo puedo contactarlos?', 'a': "Puedes llamarnos al $_phone o escribirnos a $_email."},
    ];
    return Scaffold(appBar: const CustomAppBar(title: 'Ayuda', showBack: true), body: ListView(padding: const EdgeInsets.all(16), children: [
      // Contacto
      const Text('Contacto', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
      const SizedBox(height: 8),
      ListTile(leading: const Icon(Icons.phone, color: AppColors.primary), title: const Text('Llamar'), subtitle: Text(_phone), onTap: () {}),
      ListTile(leading: const Icon(Icons.email, color: AppColors.primary), title: const Text('Correo'), subtitle: Text(_email), onTap: () {}),
      ListTile(leading: const Icon(Icons.location_on, color: AppColors.primary), title: const Text('Dirección'), subtitle: Text(_address), onTap: () {}),
      ListTile(leading: const Icon(Icons.schedule, color: AppColors.primary), title: const Text('Horario'), subtitle: Text(_hours), onTap: () {}),
      ListTile(leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFF25D366).withOpacity(0.1), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.chat, color: Color(0xFF25D366))), title: const Text('WhatsApp'), subtitle: Text('Escríbenos: $_phone'), onTap: _launchWhatsApp),
      const Divider(height: 32),
      // Zona de entrega
      const Text('Zona de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
      const SizedBox(height: 8),
      Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [const Icon(Icons.delivery_dining, color: AppColors.primary), const SizedBox(width: 10), Text(_deliveryZoneInfo.isNotEmpty ? _deliveryZoneInfo : "Cobertura: ${AppStrings.businessCity}", style: const TextStyle(fontWeight: FontWeight.w600))]),
        const SizedBox(height: 8),
        Text(_deliveryZoneInfo.isNotEmpty ? 'El tiempo estimado de entrega es de 30 a 60 minutos según la distancia.' : "Realizamos entregas en ${AppStrings.businessCity} y zonas aledañas. El tiempo estimado de entrega es de 30 a 60 minutos según la distancia.", style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5)),
      ]))),
      const Divider(height: 32),
      // Preguntas frecuentes
      const Text('Preguntas frecuentes', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
      const SizedBox(height: 8),
      ...faqs.map((faq) => Card(margin: const EdgeInsets.only(bottom: 8), child: Theme(data: Theme.of(context).copyWith(dividerColor: Colors.transparent), child: ExpansionTile(tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4), title: Text(faq['q'] as String, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)), children: [Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Text(faq['a'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5)))],
      ))),
      const SizedBox(height: 40),
    ]));
  }
}
class _PrivacyScreen extends StatelessWidget {
  const _PrivacyScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Privacidad', showBack: true), body: const SingleChildScrollView(padding: EdgeInsets.all(16), child: Text('Política de privacidad de Supermercados Go. Tus datos son tratados de forma segura y confidencial conforme a la Ley 1581 de 2012 de Protección de Datos Personales de Colombia.', style: TextStyle(color: AppColors.textSecondary, height: 1.6))));
  }
}
class _PickupScreen extends StatelessWidget {
  final int orderId;
  const _PickupScreen({required this.orderId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Recogida', showBack: true), body: Center(child: Text('Recogida pedido #$orderId')));
  }
}
class _RateScreen extends StatefulWidget {
  final int orderId;
  const _RateScreen({required this.orderId});
  @override
  State<_RateScreen> createState() => _RateScreenState();
}
class _RateScreenState extends State<_RateScreen> {
  int _rating = 0;
  final _commentCtrl = TextEditingController();
  @override
  void dispose() { _commentCtrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Calificar Pedido', showBack: true),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('¿Cómo fue tu experiencia?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 24),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(5, (i) => IconButton(iconSize: 40, icon: Icon(i < _rating ? Icons.star : Icons.star_border, color: i < _rating ? AppColors.gold : AppColors.gray), onPressed: () => setState(() => _rating = i + 1))),),
          const SizedBox(height: 24),
          TextField(controller: _commentCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Comentario (opcional)', hintText: 'Cuéntanos tu experiencia...')),
          const Spacer(),
          SizedBox(width: double.infinity, height: 48, child: ElevatedButton(onPressed: _rating == 0 ? null : () async {
            await context.read<OrderProvider>().rateOrder(widget.orderId, _rating, _commentCtrl.text);
            if (mounted) Navigator.pop(context);
          }, child: const Text('Enviar Calificación', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)))),
        ]),
      ),
    );
  }
}
class _InvoiceScreen extends StatelessWidget {
  final int orderId;
  const _InvoiceScreen({required this.orderId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Factura', showBack: true), body: Center(child: Text('Factura pedido #$orderId')));
  }
}

// ======================== ADMIN SCREENS ========================

class _AdminDashboardScreen extends StatelessWidget {
  const _AdminDashboardScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Dashboard'), automaticallyImplyLeading: false),
      drawer: const AppDrawer(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.count(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, children: [
          _buildDashCard(Icons.inventory_2, 'Productos', '/admin/products', AppColors.primary),
          _buildDashCard(Icons.category, 'Categorías', '/admin/categories', Colors.blue),
          _buildDashCard(Icons.local_shipping, 'Pedidos', '/admin/orders', AppColors.accent),
          _buildDashCard(Icons.people, 'Usuarios', '/admin/users', Colors.purple),
          _buildDashCard(Icons.warehouse, 'Inventario', '/admin/inventory', Colors.teal),
          _buildDashCard(Icons.shopping_cart, 'Compras', '/admin/purchases', AppColors.gold.darken(0.1)),
          _buildDashCard(Icons.receipt, 'Facturación', '/admin/invoices', AppColors.primaryDark),
          _buildDashCard(Icons.bar_chart, 'Reportes', '/admin/reports', AppColors.error),
          _buildDashCard(Icons.local_offer, 'Promociones', '/admin/promotions', AppColors.accent),
          _buildDashCard(Icons.banner, 'Banners', '/admin/banners', Colors.deepOrange),
          _buildDashCard(Icons.verified_user, 'Auditoría', '/admin/audit', Colors.blueGrey),
        ]),
      ),
    );
  }
  Widget _buildDashCard(IconData icon, String label, String route, Color color) {
    return Card(
      child: InkWell(onTap: () => Navigator.pushNamed(context, route), borderRadius: BorderRadius.circular(12), child: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(width: 50, height: 50, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: color, size: 26)),
        const SizedBox(height: 12),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14), textAlign: TextAlign.center),
      ]))),
    );
  }
}

class _AdminProductsScreen extends StatefulWidget {
  const _AdminProductsScreen();
  @override
  State<_AdminProductsScreen> createState() => _AdminProductsScreenState();
}
class _AdminProductsScreenState extends State<_AdminProductsScreen> {
  String _search = '';
  @override
  void initState() { super.initState(); context.read<ProductProvider>().loadProducts(); }

  Future<void> _quickToggleOffer(Product p) async {
    final newIsOffer = !p.isOffer;
    final body = <String, dynamic>{'is_offer': newIsOffer};
    if (!newIsOffer) body['offer_price'] = null;
    else if (p.offerPrice == null) body['offer_price'] = (p.price * 0.8).round();
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.put(Uri.parse('${sp.serverUrl}/api/products/${p.id}'), headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'}, body: jsonEncode(body));
      if (mounted) {
        context.read<ProductProvider>().loadProducts();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(newIsOffer ? '${p.name} marcado como oferta' : '${p.name} quitado de oferta'), backgroundColor: AppColors.primary, duration: const Duration(seconds: 1)));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al actualizar producto'), backgroundColor: AppColors.error));
    }
  }

  void _showProductDialog(Product? p) {
    final nameCtrl = TextEditingController(text: p?.name ?? '');
    final priceCtrl = TextEditingController(text: p != null ? p.price.toString() : '');
    final compareCtrl = TextEditingController(text: p?.comparePrice?.toString() ?? '');
    final offerCtrl = TextEditingController(text: p?.offerPrice?.toString() ?? '');
    final stockCtrl = TextEditingController(text: p != null ? p.stock.toInt().toString() : '0');
    final descCtrl = TextEditingController(text: p?.description ?? '');
    final imgCtrl = TextEditingController(text: p?.image ?? '');
    final brandCtrl = TextEditingController(text: p?.brand ?? '');
    final skuCtrl = TextEditingController(text: p?.sku ?? '');
    final barcodeCtrl = TextEditingController(text: p?.barcode ?? '');
    bool isOffer = p?.isOffer ?? false;
    bool isActive = p?.isActive ?? true;
    final isEdit = p != null;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: Text(isEdit ? 'Editar Producto' : 'Nuevo Producto'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nombre *')),
          const SizedBox(height: 8),
          TextField(controller: descCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Descripción')),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio COP *'))), const SizedBox(width: 8), Expanded(child: TextField(controller: compareCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio antes (COP)')))]),
          const SizedBox(height: 8),
          SwitchListTile(title: const Text('OFERTA', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.accent)), value: isOffer, onChanged: (v) => setDlg(() => isOffer = v), contentPadding: EdgeInsets.zero, activeColor: AppColors.accent),
          if (isOffer) Padding(padding: const EdgeInsets.only(bottom: 8), child: TextField(controller: offerCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Precio oferta COP', prefixIcon: Icon(Icons.local_offer, color: AppColors.accent)))),
          Row(children: [Expanded(child: TextField(controller: stockCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Stock'))), const SizedBox(width: 8), Expanded(child: TextField(controller: skuCtrl, decoration: const InputDecoration(labelText: 'SKU')))]),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: TextField(controller: barcodeCtrl, decoration: const InputDecoration(labelText: 'Código barras'))), const SizedBox(width: 8), Expanded(child: TextField(controller: brandCtrl, decoration: const InputDecoration(labelText: 'Marca')))]),
          const SizedBox(height: 8),
          TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'URL imagen')),
          SwitchListTile(title: const Text('Activo'), value: isActive, onChanged: (v) => setDlg(() => isActive = v), contentPadding: EdgeInsets.zero, activeColor: AppColors.primary),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty || priceCtrl.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nombre y precio son obligatorios'), backgroundColor: AppColors.error));
                return;
              }
              Navigator.pop(ctx);
              final sp = context.read<SettingsProvider>();
              final token = await StorageService.getToken();
              final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
              final body = <String, dynamic>{
                'name': nameCtrl.text.trim(),
                'description': descCtrl.text.trim(),
                'price': int.tryParse(priceCtrl.text) ?? 0,
                'compare_price': compareCtrl.text.trim().isEmpty ? null : int.tryParse(compareCtrl.text),
                'stock': int.tryParse(stockCtrl.text) ?? 0,
                'sku': skuCtrl.text.trim().isEmpty ? null : skuCtrl.text.trim(),
                'barcode': barcodeCtrl.text.trim().isEmpty ? null : barcodeCtrl.text.trim(),
                'brand': brandCtrl.text.trim().isEmpty ? null : brandCtrl.text.trim(),
                'image': imgCtrl.text.trim().isEmpty ? null : imgCtrl.text.trim(),
                'is_offer': isOffer,
                'offer_price': isOffer ? (int.tryParse(offerCtrl.text) ?? null) : null,
                'is_active': isActive,
              };
              try {
                if (isEdit) {
                  await http.put(Uri.parse('${sp.serverUrl}/api/products/${p!.id}'), headers: headers, body: jsonEncode(body));
                } else {
                  await http.post(Uri.parse('${sp.serverUrl}/api/products'), headers: headers, body: jsonEncode(body));
                }
                if (mounted) {
                  context.read<ProductProvider>().loadProducts();
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(isEdit ? 'Producto actualizado' : 'Producto creado'), backgroundColor: AppColors.primary));
                }
              } catch (_) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al guardar producto'), backgroundColor: AppColors.error));
              }
            },
            child: Text(isEdit ? 'Guardar' : 'Crear'),
          ),
        ],
      )));
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Productos'), actions: [IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => _showProductDialog(null))]), body: Column(children: [
      Padding(padding: const EdgeInsets.all(12), child: TextField(decoration: const InputDecoration(hintText: 'Buscar...', prefixIcon: Icon(Icons.search)), onChanged: (v) => setState(() => _search = v.toLowerCase()))),
      Expanded(child: Consumer<ProductProvider>(builder: (_, pp, __) {
        if (pp.isLoading && pp.products.isEmpty) return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        final filtered = pp.products.where((p) => p.name.toLowerCase().contains(_search)).toList();
        if (filtered.isEmpty) return const EmptyState(icon: Icons.inventory_2, title: 'Sin productos');
        return ListView.builder(padding: const EdgeInsets.symmetric(horizontal: 12), itemCount: filtered.length, itemBuilder: (_, i) {
          final p = filtered[i];
          return Card(margin: const EdgeInsets.only(bottom: 8), child: InkWell(onTap: () => _showProductDialog(p), borderRadius: BorderRadius.circular(12), child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(color: AppColors.lightGray, borderRadius: BorderRadius.circular(8)), child: p.image != null && p.image!.isNotEmpty ? ClipRRect(borderRadius: BorderRadius.circular(8), child: CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.cover)) : const Icon(Icons.shopping_bag, color: AppColors.gray)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (p.isOffer) Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.accent, borderRadius: BorderRadius.circular(4)), child: const Text('OFERTA', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
              ]),
              const SizedBox(height: 4),
              Row(children: [
                Text(formatCOP(p.effectivePrice), style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 14)),
                if (p.isOffer && p.offerPrice != null) ...[
                  const SizedBox(width: 6),
                  Text(formatCOP(p.price), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppColors.gray, fontSize: 12)),
                ],
                if (p.comparePrice != null && p.comparePrice! > 0 && !p.isOffer) ...[
                  const SizedBox(width: 6),
                  Text(formatCOP(p.comparePrice!), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppColors.gray, fontSize: 11)),
                ],
                const Spacer(),
                Text('Stock: ${p.stock.toInt()}', style: TextStyle(color: p.stock <= 0 ? AppColors.error : AppColors.textSecondary, fontSize: 12)),
              ]),
            ])),
            IconButton(
              icon: Icon(p.isOffer ? Icons.local_offer : Icons.local_offer_outlined, color: p.isOffer ? AppColors.accent : AppColors.gray, size: 20),
              tooltip: p.isOffer ? 'Quitar oferta' : 'Marcar como oferta',
              onPressed: () => _quickToggleOffer(p),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.edit, color: AppColors.primary, size: 20),
          ]))));
        });
      })),
    ]));
  }
}
class _AdminProductFormScreen extends StatelessWidget {
  final int? productId;
  const _AdminProductFormScreen({this.productId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: productId == null ? 'Nuevo Producto' : 'Editar Producto', showBack: true), body: const Center(child: Text('Formulario de producto')));
  }
}
class _AdminCategoriesScreen extends StatelessWidget {
  const _AdminCategoriesScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Categorías'), actions: [IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => Navigator.pushNamed(context, '/admin/category-form', arguments: {'id': null}))]), body: const Center(child: Text('Lista de categorías')));
  }
}
class _AdminCategoryFormScreen extends StatelessWidget {
  final int? categoryId;
  const _AdminCategoryFormScreen({this.categoryId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: categoryId == null ? 'Nueva Categoría' : 'Editar Categoría', showBack: true), body: const Center(child: Text('Formulario de categoría')));
  }
}
class _AdminOrdersScreen extends StatelessWidget {
  const _AdminOrdersScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Pedidos'), body: const Center(child: Text('Lista de pedidos')));
  }
}
class _AdminUsersScreen extends StatelessWidget {
  const _AdminUsersScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Usuarios'), actions: [IconButton(icon: const Icon(Icons.person_add, color: Colors.white), onPressed: () => Navigator.pushNamed(context, '/admin/user-form', arguments: {'id': null}))]), body: const Center(child: Text('Lista de usuarios')));
  }
}
class _AdminUserFormScreen extends StatelessWidget {
  final int? userId;
  const _AdminUserFormScreen({this.userId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: userId == null ? 'Nuevo Usuario' : 'Editar Usuario', showBack: true), body: const Center(child: Text('Formulario de usuario')));
  }
}
class _AdminSettingsScreen extends StatefulWidget {
  const _AdminSettingsScreen();
  @override
  State<_AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}
class _AdminSettingsScreenState extends State<_AdminSettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  List<Map<String, dynamic>> _banners = [];
  bool _loading = true;
  @override
  void initState() { super.initState(); _tabCtrl = TabController(length: 3, vsync: this); _loadBanners(); _loading = false; }
  @override
  void dispose() { _tabCtrl.dispose(); super.dispose(); }
  Future<void> _loadBanners() async {
    try {
      final sp = context.read<SettingsProvider>();
      final resp = await http.get(Uri.parse('${sp.serverUrl}/api/banners?all=1'), headers: {'Content-Type': 'application/json'});
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        setState(() => _banners = List<Map<String, dynamic>>.from(data['banners'] ?? []));
      }
    } catch (_) {}
  }
  void _showBannerDialog(Map<String, dynamic>? b) {
    final titleCtrl = TextEditingController(text: b?['title'] ?? '');
    final subCtrl = TextEditingController(text: b?['subtitle'] ?? '');
    final imgCtrl = TextEditingController(text: b?['image_url'] ?? '');
    String bgColor = b?['bg_color'] ?? '#00B860';
    bool active = b?['is_active'] == 1;
    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
      title: Text(b == null ? 'Nuevo Banner' : 'Editar Banner'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Título *')),
        const SizedBox(height: 8),
        TextField(controller: subCtrl, decoration: const InputDecoration(labelText: 'Subtítulo')),
        const SizedBox(height: 8),
        TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'URL de imagen')),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(value: bgColor, decoration: const InputDecoration(labelText: 'Color de fondo'), items: ['#00B860', '#FF8C00', '#1a7a3a', '#FFD93D', '#1565C0', '#6A1B9A'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(), onChanged: (v) => setDlg(() => bgColor = v!)),
        SwitchListTile(title: const Text('Activo'), value: active, onChanged: (v) => setDlg(() => active = v), contentPadding: EdgeInsets.zero, activeColor: AppColors.primary),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
        ElevatedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Guardar')),
      ],
    )));
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'Configuración', showBack: true),
      body: Column(children: [
        TabBar(controller: _tabCtrl, labelColor: AppColors.primary, unselectedLabelColor: AppColors.gray, indicatorColor: AppColors.primary, tabs: const [Tab(text: 'Negocio'), Tab(text: 'Entrega'), Tab(text: 'Carrusel')]),
        Expanded(child: TabBarView(controller: _tabCtrl, children: [
          ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Datos del negocio', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 12),
            const ListTile(leading: Icon(Icons.store), title: Text('Supermercados Go'), subtitle: Text('KDX 1-2B Los Mangos, Cúcuta')),
            const ListTile(leading: Icon(Icons.phone), title: Text('+57 304 401 6277')),
            const ListTile(leading: Icon(Icons.email), title: Text('admin@supermercado.go')),
            const ListTile(leading: Icon(Icons.schedule), title: Text('6:00 AM - 6:00 PM')),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guardado'), backgroundColor: AppColors.primary)), child: const Text('Guardar Cambios')),
          ]),
          ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Zona de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 4),
            const Text('Configura las zonas donde realizas entregas.', style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Cúcuta')),
            const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Los Patios'))),
            const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Villa del Rosario'))),
            const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('Pamplonita'))),
            const Card(child: ListTile(leading: Icon(Icons.location_city, color: AppColors.primary), title: Text('El Zulia')),
            const SizedBox(height: 16),
            const Text('Costos de envío', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 8),
            const Card(child: ListTile(leading: Icon(Icons.delivery_dining, color: AppColors.primary), title: Text('Costo estándar'), subtitle: Text('$4.900'))),
            const Card(child: ListTile(leading: Icon(Icons.local_shipping, color: AppColors.success), title: Text('Envío gratis desde'), subtitle: Text('$50.000'))),
          ]),
          ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: const [Icon(Icons.banner, color: AppColors.primary), SizedBox(width: 8), Text('Banners del Carrusel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)), Expanded(child: SizedBox())]),
            const SizedBox(height: 8),
            const Text('Administra los banners que se muestran en la pantalla principal de la app.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 12),
            ..._banners.map((b) => Card(margin: const EdgeInsets.only(bottom: 10), child: ListTile(
              leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: _parseColor(b['bg_color'] ?? '#00B860'), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.image, color: Colors.white)),
              title: Text(b['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text(b['subtitle'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(b['is_active'] == 1 ? Icons.check_circle : Icons.cancel, color: b['is_active'] == 1 ? AppColors.success : AppColors.gray, size: 20),
                const SizedBox(width: 4), const Icon(Icons.chevron_right),
              ]),
              onTap: () => _showBannerDialog(b),
            ))),
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, height: 45, child: ElevatedButton.icon(onPressed: () => _showBannerDialog(null), icon: const Icon(Icons.add), label: const Text('Agregar Banner'), style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary))),
          ]),
        ])),
      ]),
    );
  }
  static Color _parseColor(String hex) { try { return Color(int.parse(hex.replaceFirst('#', '0xFF'))); } catch (_) { return AppColors.primary; } }
}
class _AdminInventoryScreen extends StatelessWidget {
  const _AdminInventoryScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Inventario'), body: const Center(child: Text('Control de inventario')));
  }
}
class _AdminKardexScreen extends StatelessWidget {
  final int productId;
  const _AdminKardexScreen({required this.productId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: 'Kardex #$productId', showBack: true), body: const Center(child: Text('Movimientos kardex')));
  }
}
class _AdminStockCountScreen extends StatelessWidget {
  const _AdminStockCountScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Conteo de Inventario', showBack: true), body: const Center(child: Text('Conteo físico')));
  }
}
class _AdminSuppliersScreen extends StatelessWidget {
  const _AdminSuppliersScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Proveedores'), actions: [IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => Navigator.pushNamed(context, '/admin/supplier-form', arguments: {'id': null}))]), body: const Center(child: Text('Lista de proveedores')));
  }
}
class _AdminSupplierFormScreen extends StatelessWidget {
  final int? supplierId;
  const _AdminSupplierFormScreen({this.supplierId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: supplierId == null ? 'Nuevo Proveedor' : 'Editar Proveedor', showBack: true), body: const Center(child: Text('Formulario de proveedor')));
  }
}
class _AdminPurchasesScreen extends StatelessWidget {
  const _AdminPurchasesScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Compras'), actions: [IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => Navigator.pushNamed(context, '/admin/purchase-form', arguments: {'id': null}))]), body: const Center(child: Text('Lista de compras')));
  }
}
class _AdminPurchaseFormScreen extends StatelessWidget {
  final int? purchaseId;
  const _AdminPurchaseFormScreen({this.purchaseId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: purchaseId == null ? 'Nueva Compra' : 'Editar Compra', showBack: true), body: const Center(child: Text('Formulario de compra')));
  }
}
class _AdminInvoicesScreen extends StatelessWidget {
  const _AdminInvoicesScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Facturación'), body: const Center(child: Text('Lista de facturas')));
  }
}
class _AdminInvoiceConfigScreen extends StatelessWidget {
  const _AdminInvoiceConfigScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Config. Facturación', showBack: true), body: const Center(child: Text('Configuración de facturación electrónica')));
  }
}
class _AdminReportsScreen extends StatelessWidget {
  const _AdminReportsScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Reportes'), body: const Center(child: Text('Reportes y estadísticas')));
  }
}
class _AdminPromotionsScreen extends StatelessWidget {
  const _AdminPromotionsScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Promociones'), actions: [IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => Navigator.pushNamed(context, '/admin/promo-form', arguments: {'id': null}))]), body: const Center(child: Text('Lista de promociones')));
  }
}
class _AdminPromoFormScreen extends StatelessWidget {
  final int? promoId;
  const _AdminPromoFormScreen({this.promoId});
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: CustomAppBar(title: promoId == null ? 'Nueva Promoción' : 'Editar Promoción', showBack: true), body: const Center(child: Text('Formulario de promoción')));
  }
}
class _AdminWorkersPerfScreen extends StatelessWidget {
  const _AdminWorkersPerfScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Rendimiento Repartidores', showBack: true), body: const Center(child: Text('Rendimiento de repartidores')));
  }
}
class _AdminAuditScreen extends StatelessWidget {
  const _AdminAuditScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Auditoría', showBack: true), body: const Center(child: Text('Registro de auditoría')));
  }
}
class _AdminBarcodePrintScreen extends StatelessWidget {
  const _AdminBarcodePrintScreen();
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: const CustomAppBar(title: 'Imprimir Códigos', showBack: true), body: const Center(child: Text('Impresión de códigos de barras')));
  }
}

class _AdminBannersScreen extends StatefulWidget {
  const _AdminBannersScreen();
  @override
  State<_AdminBannersScreen> createState() => _AdminBannersScreenState();
}
class _AdminBannersScreenState extends State<_AdminBannersScreen> {
  List<Map<String, dynamic>> _banners = [];
  bool _loading = true;
  @override
  void initState() { super.initState(); _loadBanners(); }

  Future<void> _loadBanners() async {
    setState(() => _loading = true);
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final resp = await http.get(
        Uri.parse('${sp.serverUrl}/api/banners?all=1'),
        headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      );
      if (resp.statusCode == 200 && mounted) {
        final data = jsonDecode(resp.body);
        setState(() => _banners = List<Map<String, dynamic>>.from(data['banners'] ?? []));
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _saveBanner(Map<String, dynamic> body, {String? id}) async {
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      final headers = {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
      if (id != null) {
        await http.put(Uri.parse('${sp.serverUrl}/api/banners/$id'), headers: headers, body: jsonEncode(body));
      } else {
        await http.post(Uri.parse('${sp.serverUrl}/api/banners'), headers: headers, body: jsonEncode(body));
      }
      if (mounted) {
        _loadBanners();
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(id != null ? 'Banner actualizado' : 'Banner creado'),
          backgroundColor: AppColors.primary,
        ));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Error al guardar banner'),
          backgroundColor: AppColors.error,
        ));
      }
    }
  }

  Future<void> _deleteBanner(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar banner'),
        content: const Text('¿Estás seguro de eliminar este banner?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error, foregroundColor: Colors.white),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final sp = context.read<SettingsProvider>();
      final token = await StorageService.getToken();
      await http.delete(Uri.parse('${sp.serverUrl}/api/banners/$id'), headers: {'Authorization': 'Bearer $token'});
      if (mounted) {
        _loadBanners();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Banner eliminado'), backgroundColor: AppColors.primary));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error al eliminar'), backgroundColor: AppColors.error));
      }
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> b) async {
    final newActive = (b['is_active'] == 1) ? 0 : 1;
    await _saveBanner({'is_active': newActive}, id: b['id'] as String);
  }

  void _showBannerDialog(Map<String, dynamic>? b) {
    final isEdit = b != null;
    final titleCtrl = TextEditingController(text: b?['title'] ?? '');
    final subCtrl = TextEditingController(text: b?['subtitle'] ?? '');
    final imgCtrl = TextEditingController(text: b?['image_url'] ?? '');
    String bgColor = b?['bg_color'] ?? '#00B860';
    String textColor = b?['text_color'] ?? '#FFFFFF';
    String linkType = b?['link_type'] ?? 'none';
    final linkValCtrl = TextEditingController(text: b?['link_value'] ?? '');
    final sortOrderCtrl = TextEditingController(text: (b?['sort_order'] ?? 0).toString());
    bool active = b?['is_active'] == 1;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDlg) => AlertDialog(
        title: Text(isEdit ? 'Editar Banner' : 'Nuevo Banner'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(controller: titleCtrl, decoration: const InputDecoration(labelText: 'Título *')),
          const SizedBox(height: 8),
          TextField(controller: subCtrl, decoration: const InputDecoration(labelText: 'Subtítulo (opcional)')),
          const SizedBox(height: 8),
          TextField(controller: imgCtrl, decoration: const InputDecoration(labelText: 'URL de imagen (opcional)')),
          const SizedBox(height: 12),
          const Text('Color de fondo', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Row(children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: _parseColor(bgColor), borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.gray)),),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: TextEditingController(text: bgColor), decoration: const InputDecoration(labelText: '#Hex', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 10)), onChanged: (v) => setDlg(() => bgColor = v.startsWith('#') ? v : '#$v'))),
          ]),
          const SizedBox(height: 8),
          const Text('Color de texto', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Row(children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: _parseColor(textColor), borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.gray)),),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: TextEditingController(text: textColor), decoration: const InputDecoration(labelText: '#Hex', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 10)), onChanged: (v) => setDlg(() => textColor = v.startsWith('#') ? v : '#$v'))),
          ]),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: linkType,
            decoration: const InputDecoration(labelText: 'Tipo de enlace'),
            items: const [
              DropdownMenuItem(value: 'none', child: Text('Sin enlace')),
              DropdownMenuItem(value: 'category', child: Text('Categoría')),
              DropdownMenuItem(value: 'product', child: Text('Producto')),
              DropdownMenuItem(value: 'promo', child: Text('Promoción')),
            ],
            onChanged: (v) => setDlg(() => linkType = v!),
          ),
          if (linkType != 'none') Padding(padding: const EdgeInsets.only(top: 8), child: TextField(controller: linkValCtrl, decoration: InputDecoration(labelText: 'ID del ${linkType == 'category' ? 'categoría' : linkType == 'product' ? 'producto' : 'promoción'}'))),
          const SizedBox(height: 8),
          TextField(controller: sortOrderCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Orden')),
          const SizedBox(height: 8),
          SwitchListTile(title: const Text('Activo'), value: active, onChanged: (v) => setDlg(() => active = v), contentPadding: EdgeInsets.zero, activeColor: AppColors.primary),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () async {
              if (titleCtrl.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('El título es obligatorio'), backgroundColor: AppColors.error));
                return;
              }
              Navigator.pop(ctx);
              final body = {
                'title': titleCtrl.text.trim(),
                'subtitle': subCtrl.text.trim().isEmpty ? null : subCtrl.text.trim(),
                'image_url': imgCtrl.text.trim().isEmpty ? null : imgCtrl.text.trim(),
                'bg_color': bgColor,
                'text_color': textColor,
                'link_type': linkType,
                'link_value': linkType != 'none' ? linkValCtrl.text.trim() : null,
                'sort_order': int.tryParse(sortOrderCtrl.text) ?? 0,
                'is_active': active,
              };
              if (isEdit) {
                await _saveBanner(body, id: b!['id'] as String);
              } else {
                await _saveBanner(body);
              }
            },
            child: Text(isEdit ? 'Guardar' : 'Crear'),
          ),
        ],
      ))),
    );
  }

  static Color _parseColor(String hex) {
    try { return Color(int.parse(hex.replaceFirst('#', '0xFF'))); } catch (_) { return AppColors.primary; }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(backgroundColor: AppColors.primary, foregroundColor: Colors.white, title: const Text('Banners'), actions: [
        IconButton(icon: const Icon(Icons.add, color: Colors.white), onPressed: () => _showBannerDialog(null)),
      ]),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _banners.isEmpty
              ? const EmptyState(icon: Icons.banner_outlined, title: 'Sin banners', subtitle: 'Agrega banners para el carrusel principal')
              : RefreshIndicator(
                  onRefresh: _loadBanners,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _banners.length,
                    itemBuilder: (_, i) {
                      final b = _banners[i];
                      final bgCol = _parseColor(b['bg_color'] ?? '#00B860');
                      final isActive = b['is_active'] == 1;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(children: [
                            Container(
                              width: 52, height: 52,
                              decoration: BoxDecoration(color: bgCol, borderRadius: BorderRadius.circular(10)),
                              child: (b['image_url'] != null && (b['image_url'] as String).isNotEmpty)
                                  ? ClipRRect(borderRadius: BorderRadius.circular(10), child: CachedNetworkImage(imageUrl: b['image_url'] as String, fit: BoxFit.cover))
                                  : const Icon(Icons.image, color: Colors.white, size: 24),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Expanded(child: Text(b['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis)),
                                Container(
                                  width: 16, height: 16,
                                  margin: const EdgeInsets.only(left: 6),
                                  decoration: BoxDecoration(color: bgCol, shape: BoxShape.circle, border: Border.all(color: AppColors.gray, width: 0.5)),
                                ),
                              ]),
                              if (b['subtitle'] != null && (b['subtitle'] as String).isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(b['subtitle'] as String, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                              ],
                              const SizedBox(height: 4),
                              Row(children: [
                                if (b['link_type'] != null && b['link_type'] != 'none')
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                                    margin: const EdgeInsets.only(right: 6),
                                    child: Text('${b['link_type']}: ${b['link_value'] ?? ''}', style: const TextStyle(fontSize: 10, color: Colors.blue)),
                                  ),
                                Text('Orden: ${b['sort_order'] ?? 0}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                              ]),
                            ])),
                            Column(mainAxisSize: MainAxisSize.min, children: [
                              Switch(
                                value: isActive,
                                onChanged: (_) => _toggleActive(b),
                                activeColor: AppColors.success,
                                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              Row(mainAxisSize: MainAxisSize.min, children: [
                                IconButton(
                                  icon: const Icon(Icons.edit, color: AppColors.primary, size: 20),
                                  onPressed: () => _showBannerDialog(b),
                                  constraints: const BoxConstraints(),
                                  padding: const EdgeInsets.all(4),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete, color: AppColors.error, size: 20),
                                  onPressed: () => _deleteBanner(b['id'] as String),
                                  constraints: const BoxConstraints(),
                                  padding: const EdgeInsets.all(4),
                                ),
                              ]),
                            ]),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showBannerDialog(null),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

class _ServerConfigScreen extends StatelessWidget {
  const _ServerConfigScreen();
  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => ServerConfigDialog.show(context));
    return Scaffold(appBar: const CustomAppBar(title: 'Configurar Servidor', showBack: true), body: const Center(child: Text('Cargando...')));
  }
}

// Color extension for darken
extension _ColorExtension on Color {
  Color darken([double amount = 0.1]) {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness - amount).clamp(0.0, 1.0)).toColor();
  }
}
