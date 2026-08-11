import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../utils/constants.dart';
import '../providers/auth_provider.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final role = user?.role ?? 'client';

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, user, role),
            const Divider(height: 1),
            Expanded(child: _buildMenuItems(context, role)),
            const Divider(height: 1),
            _buildLogout(context, auth),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, user, String role) {
    final roleLabel = switch (role) {
      'admin' => 'Administrador',
      'worker' => 'Repartidor',
      _ => 'Cliente',
    };
    final roleColor = switch (role) {
      'admin' => AppColors.error,
      'worker' => Colors.blue,
      _ => AppColors.primary,
    };

    return Container(
      padding: const EdgeInsets.all(16),
      color: AppColors.primary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: Colors.white24,
                child: user?.avatar != null && user!.avatar!.isNotEmpty
                    ? ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: user.avatar!,
                          width: 56,
                          height: 56,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Icon(Icons.person, size: 28, color: Colors.white),
                        ),
                      )
                    : const Icon(Icons.person, size: 28, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.name ?? 'Usuario',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: roleColor,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        roleLabel,
                        style: const TextStyle(color: Colors.white, fontSize: 11),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          if (user?.phone != null && user!.phone!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.phone, color: Colors.white70, size: 14),
                const SizedBox(width: 6),
                Text(
                  user.phone!,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMenuItems(BuildContext context, String role) {
    final items = switch (role) {
      'admin' => _adminItems(context),
      'worker' => _workerItems(context),
      _ => _clientItems(context),
    };

    return ListView(
      padding: EdgeInsets.zero,
      children: items,
    );
  }

  List<Widget> _clientItems(BuildContext context) {
    return [
      _drawerItem(context, icon: Icons.home, label: 'Inicio', route: '/home'),
      _drawerItem(context, icon: Icons.receipt_long, label: 'Mis Pedidos', route: '/my-orders'),
      _drawerItem(context, icon: Icons.location_on, label: 'Direcciones', route: '/addresses'),
      _drawerItem(context, icon: Icons.favorite, label: 'Favoritos', route: '/favorites'),
      _drawerItem(context, icon: Icons.notifications, label: 'Notificaciones', route: '/notifications'),
      _drawerItem(context, icon: Icons.local_offer, label: 'Promociones', route: '/promo'),
      _drawerItem(context, icon: Icons.help, label: 'Ayuda', route: '/help'),
      _drawerItem(context, icon: Icons.privacy_tip, label: 'Privacidad', route: '/privacy'),
      _drawerItem(context, icon: Icons.settings_ethernet, label: 'Configurar Servidor', route: '/server-config'),
    ];
  }

  List<Widget> _workerItems(BuildContext context) {
    return [
      _drawerItem(context, icon: Icons.home, label: 'Inicio', route: '/worker/home'),
      _drawerItem(context, icon: Icons.list, label: 'Pedidos Disponibles', route: '/worker/orders'),
      _drawerItem(context, icon: Icons.delivery_dining, label: 'Entrega Activa', route: '/worker/route'),
      _drawerItem(context, icon: Icons.attach_money, label: 'Ganancias', route: '/worker/earnings'),
      _drawerItem(context, icon: Icons.history, label: 'Historial', route: '/worker/history'),
      _drawerItem(context, icon: Icons.point_of_sale, label: 'Caja', route: '/worker/cash'),
    ];
  }

  List<Widget> _adminItems(BuildContext context) {
    return [
      _drawerItem(context, icon: Icons.dashboard, label: 'Dashboard', route: '/admin/dashboard'),
      _drawerItem(context, icon: Icons.inventory_2, label: 'Productos', route: '/admin/products'),
      _drawerItem(context, icon: Icons.category, label: 'Categorías', route: '/admin/categories'),
      _drawerItem(context, icon: Icons.local_shipping, label: 'Pedidos', route: '/admin/orders'),
      _drawerItem(context, icon: Icons.people, label: 'Usuarios', route: '/admin/users'),
      _drawerItem(context, icon: Icons.warehouse, label: 'Inventario', route: '/admin/inventory'),
      _drawerItem(context, icon: Icons.shopping_cart, label: 'Compras', route: '/admin/purchases'),
      _drawerItem(context, icon: Icons.receipt, label: 'Facturación', route: '/admin/invoices'),
      _drawerItem(context, icon: Icons.bar_chart, label: 'Reportes', route: '/admin/reports'),
      _drawerItem(context, icon: Icons.local_offer, label: 'Promociones', route: '/admin/promotions'),
      _drawerItem(context, icon: Icons.image, label: 'Banners / Carrusel', route: '/admin/banners'),
      _drawerItem(context, icon: Icons.verified_user, label: 'Auditoría', route: '/admin/audit'),
      _drawerItem(context, icon: Icons.settings_ethernet, label: 'Configurar Servidor', route: '/server-config'),
    ];
  }

  Widget _drawerItem(BuildContext context, {required IconData icon, required String label, required String route}) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary, size: 22),
      title: Text(label, style: const TextStyle(fontSize: 14)),
      onTap: () {
        Navigator.pop(context);
        Navigator.pushNamedAndRemoveUntil(context, route, (r) => r.isFirst);
      },
    );
  }

  Widget _buildLogout(BuildContext context, AuthProvider auth) {
    return ListTile(
      leading: const Icon(Icons.logout, color: AppColors.error, size: 22),
      title: const Text(
        'Cerrar Sesión',
        style: TextStyle(color: AppColors.error, fontSize: 14, fontWeight: FontWeight.w500),
      ),
      onTap: () {
        auth.logout();
        Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
      },
    );
  }
}
