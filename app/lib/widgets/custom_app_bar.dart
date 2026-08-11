import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../utils/constants.dart';
import '../providers/cart_provider.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final bool showBack;
  final bool showCart;
  final bool showNotifications;
  final List<Widget>? actions;
  final VoidCallback? onCartTap;
  final VoidCallback? onNotificationTap;
  final int notificationCount;

  const CustomAppBar({
    super.key,
    required this.title,
    this.showBack = false,
    this.showCart = false,
    this.showNotifications = false,
    this.actions,
    this.onCartTap,
    this.onNotificationTap,
    this.notificationCount = 0,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    List<Widget>? trailing = actions;
    if (trailing == null) {
      trailing = [];
      if (showNotifications) {
        trailing.add(
          IconButton(
            icon: Badge(
              isLabelVisible: notificationCount > 0,
              label: Text(notificationCount.toString()),
              child: const Icon(Icons.notifications_outlined, color: Colors.white),
            ),
            onPressed: onNotificationTap ?? () => Navigator.pushNamed(context, '/notifications'),
          ),
        );
      }
      if (showCart) {
        trailing.add(
          Consumer<CartProvider>(
            builder: (_, cart, __) {
              return IconButton(
                icon: Badge(
                  isLabelVisible: cart.itemCount > 0,
                  label: Text(cart.itemCount.toString()),
                  child: const Icon(Icons.shopping_cart_outlined, color: Colors.white),
                ),
                onPressed: onCartTap ?? () => Navigator.pushNamed(context, '/cart'),
              );
            },
          ),
        );
      }
    }

    return AppBar(
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 0,
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      centerTitle: false,
      leading: showBack
          ? IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
              onPressed: () => Navigator.maybePop(context),
            )
          : null,
      actions: trailing,
    );
  }
}
