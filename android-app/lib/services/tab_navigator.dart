import 'package:flutter/foundation.dart';

/// Señal ligera para pedirle a ClientHomeScreen que cambie de pestaña desde
/// una pantalla empujada (ej. el ícono de carrito en la página de producto).
class TabNavigator {
  TabNavigator._();
  static final ValueNotifier<int?> requestedTab = ValueNotifier<int?>(null);
  static void goToCart() => requestedTab.value = 1;
}
