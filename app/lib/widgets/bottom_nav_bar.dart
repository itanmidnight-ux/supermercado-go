import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';

class BottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const BottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final role = context.watch<AuthProvider>().userRole;
    final cartCount = context.watch<CartProvider>().itemCount;

    final items = switch (role) {
      'admin' => _adminItems(),
      'worker' => _workerItems(),
      _ => _clientItems(cartCount),
    };

    return BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: onTap,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: AppColors.gray,
      type: BottomNavigationBarType.fixed,
      showSelectedLabels: true,
      showUnselectedLabels: true,
      items: items,
    );
  }

  List<BottomNavigationBarItem> _clientItems(int cartCount) {
    return [
      const BottomNavigationBarItem(
        icon: Icon(Icons.home_outlined),
        activeIcon: Icon(Icons.home),
        label: 'Inicio',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.category_outlined),
        activeIcon: Icon(Icons.category),
        label: 'Categorías',
      ),
      BottomNavigationBarItem(
        icon: Badge(
          isLabelVisible: cartCount > 0,
          label: Text(cartCount.toString()),
          child: const Icon(Icons.shopping_cart_outlined),
        ),
        activeIcon: Badge(
          isLabelVisible: cartCount > 0,
          label: Text(cartCount.toString()),
          child: const Icon(Icons.shopping_cart),
        ),
        label: 'Carrito',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.receipt_long_outlined),
        activeIcon: Icon(Icons.receipt_long),
        label: 'Pedidos',
      ),
    ];
  }

  List<BottomNavigationBarItem> _workerItems() {
    return const [
      BottomNavigationBarItem(
        icon: Icon(Icons.home_outlined),
        activeIcon: Icon(Icons.home),
        label: 'Inicio',
      ),
      BottomNavigationBarItem(
        icon: Icon(Icons.list_outlined),
        activeIcon: Icon(Icons.list),
        label: 'Pedidos',
      ),
      BottomNavigationBarItem(
        icon: Icon(Icons.delivery_dining_outlined),
        activeIcon: Icon(Icons.delivery_dining),
        label: 'Entrega',
      ),
    ];
  }

  List<BottomNavigationBarItem> _adminItems() {
    return const [
      BottomNavigationBarItem(
        icon: Icon(Icons.dashboard_outlined),
        activeIcon: Icon(Icons.dashboard),
        label: 'Dashboard',
      ),
      BottomNavigationBarItem(
        icon: Icon(Icons.inventory_2_outlined),
        activeIcon: Icon(Icons.inventory_2),
        label: 'Productos',
      ),
      BottomNavigationBarItem(
        icon: Icon(Icons.local_shipping_outlined),
        activeIcon: Icon(Icons.local_shipping),
        label: 'Pedidos',
      ),
    ];
  }
}