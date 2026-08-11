import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'constants.dart';

String formatCOP(int amount) {
  final formatted = NumberFormat.currency(
    locale: 'es_CO',
    symbol: AppStrings.currencySymbol,
    decimalDigits: 0,
  ).format(amount);
  return formatted;
}

String formatDate(String dateStr) {
  if (dateStr.isEmpty) return '';
  try {
    final dt = DateTime.parse(dateStr).toLocal();
    return DateFormat('dd/MM/yyyy').format(dt);
  } catch (_) {
    return dateStr;
  }
}

String formatTime(String dateStr) {
  if (dateStr.isEmpty) return '';
  try {
    final dt = DateTime.parse(dateStr).toLocal();
    return DateFormat('hh:mm a').format(dt);
  } catch (_) {
    return dateStr;
  }
}

String formatRelative(String dateStr) {
  if (dateStr.isEmpty) return '';
  try {
    final dt = DateTime.parse(dateStr).toLocal();
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inSeconds < 60) return 'hace un momento';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} minutos';
    if (diff.inHours < 24) return 'hace ${diff.inHours} horas';
    if (diff.inDays < 7) return 'hace ${diff.inDays} días';
    if (diff.inDays < 30) return 'hace ${diff.inDays ~/ 7} semanas';
    if (diff.inDays < 365) return 'hace ${diff.inDays ~/ 30} meses';
    return 'hace ${diff.inDays ~/ 365} años';
  } catch (_) {
    return dateStr;
  }
}

String getDeliveryStatusLabel(String status) {
  return AppStrings.orderStatuses[status] ?? status;
}

String getPaymentStatusLabel(String status) {
  const map = {
    'pending': 'Pendiente',
    'paid': 'Pagado',
    'partial': 'Parcial',
    'refunded': 'Reembolsado',
    'failed': 'Fallido',
  };
  return map[status] ?? status;
}

Color getOrderStatusColor(String status) {
  const map = {
    'pending': AppColors.accent,
    'confirmed': Colors.blue,
    'preparing': Colors.purple,
    'ready': AppColors.success,
    'assigned': Colors.teal,
    'in_transit': Colors.blue,
    'delivered': AppColors.success,
    'cancelled': AppColors.error,
    'picked_up': AppColors.success,
  };
  return map[status] ?? AppColors.gray;
}
