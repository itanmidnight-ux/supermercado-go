import 'package:flutter/material.dart';
import '../../utils/constants.dart';
import '../../widgets/app_drawer.dart';

class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        title: const Text('Dashboard'),
        automaticallyImplyLeading: false,
      ),
      drawer: const AppDrawer(),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          children: [
            _buildDashCard(context, Icons.inventory_2, 'Productos', '/admin/products', AppColors.primary),
            _buildDashCard(context, Icons.category, 'Categorías', '/admin/categories', Colors.blue),
            _buildDashCard(context, Icons.local_shipping, 'Pedidos', '/admin/orders', AppColors.accent),
            _buildDashCard(context, Icons.people, 'Usuarios', '/admin/users', Colors.purple),
            _buildDashCard(context, Icons.warehouse, 'Inventario', '/admin/inventory', Colors.teal),
            _buildDashCard(context, Icons.shopping_cart, 'Compras', '/admin/purchases', AppColors.gold),
            _buildDashCard(context, Icons.receipt, 'Facturación', '/admin/invoices', AppColors.primaryDark),
            _buildDashCard(context, Icons.bar_chart, 'Reportes', '/admin/reports', AppColors.error),
            _buildDashCard(context, Icons.local_offer, 'Promociones', '/admin/promotions', AppColors.accent),
            _buildDashCard(context, Icons.banner, 'Banners', '/admin/banners', Colors.deepOrange),
            _buildDashCard(context, Icons.verified_user, 'Auditoría', '/admin/audit', Colors.blueGrey),
          ],
        ),
      ),
    );
  }

  Widget _buildDashCard(BuildContext context, IconData icon, String label, String route, Color color) {
    return Card(
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, route),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
