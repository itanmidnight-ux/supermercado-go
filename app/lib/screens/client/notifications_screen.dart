import 'package:flutter/material.dart';
import '../../models/notification.dart';
import '../../services/api_service.dart';
import '../../widgets/empty_state.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> _notifications = [];
  bool _isLoading = true;
  String? _error;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.notifications);
      final data = response['data'] ?? response['notifications'] ?? response;
      List<AppNotification> parsed = [];
      if (data is List) {
        parsed = data.map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
      } else if (data is Map) {
        final items = data['items'] ?? data['notifications'] ?? data['data'];
        if (items is List) {
          parsed = items.map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
      setState(() {
        _notifications = parsed;
        _unreadCount = parsed.where((n) => !n.isRead).length;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar notificaciones';
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead(AppNotification notification) async {
    if (notification.isRead) return;
    try {
      await apiService.post(ApiEndpoints.notificationMarkRead(notification.id.toString()), {});
      setState(() {
        final idx = _notifications.indexWhere((n) => n.id == notification.id);
        if (idx >= 0) {
          _notifications[idx] = AppNotification(
            id: notification.id,
            userId: notification.userId,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            dataJson: notification.dataJson,
            readAt: DateTime.now().toIso8601String(),
            createdAt: notification.createdAt,
          );
        }
        _unreadCount = _notifications.where((n) => !n.isRead).length;
      });
    } catch (_) {
      // Silent fail for mark as read
    }
  }

  void _openNotification(AppNotification notification) {
    _markAsRead(notification);

    if (notification.dataJson != null) {
      final orderId = notification.dataJson!['order_id'];
      if (orderId != null) {
        Navigator.pushNamed(context, '/order-detail', arguments: int.tryParse(orderId.toString()) ?? 0);
        return;
      }
    }

    _showNotificationDetail(notification);
  }

  void _showNotificationDetail(AppNotification notification) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.gray.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                notification.title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                notification.body,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 8),
              Text(
                formatRelative(notification.createdAt),
                style: const TextStyle(fontSize: 12, color: AppColors.gray),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getNotificationIcon(String? type) {
    switch (type) {
      case 'order':
        return Icons.receipt_long;
      case 'promo':
        return Icons.local_offer;
      case 'system':
        return Icons.info;
      default:
        return Icons.notifications;
    }
  }

  Color _getNotificationColor(String? type) {
    switch (type) {
      case 'order':
        return AppColors.primary;
      case 'promo':
        return AppColors.accent;
      case 'system':
        return AppColors.primaryDark;
      default:
        return AppColors.gray;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notificaciones'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (_unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$_unreadCount nueva${_unreadCount > 1 ? 's' : ''}',
                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadNotifications,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _notifications.isEmpty
                  ? EmptyState(
                      icon: Icons.notifications_off_outlined,
                      title: 'Sin notificaciones',
                      subtitle: 'Aquí verás las actualizaciones de tus pedidos y novedades.',
                    )
                  : RefreshIndicator(
                      onRefresh: _loadNotifications,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _notifications.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, indent: 60),
                        itemBuilder: (context, index) {
                          final notification = _notifications[index];
                          return _buildNotificationTile(notification);
                        },
                      ),
                    ),
    );
  }

  Widget _buildNotificationTile(AppNotification notification) {
    final iconColor = _getNotificationColor(notification.type);
    final icon = _getNotificationIcon(notification.type);

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: iconColor, size: 22),
      ),
      title: Text(
        notification.title,
        style: TextStyle(
          fontWeight: notification.isRead ? FontWeight.normal : FontWeight.w600,
          fontSize: 14,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 2),
          Text(
            notification.body,
            style: TextStyle(
              fontSize: 13,
              color: notification.isRead ? AppColors.gray : AppColors.textSecondary,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            formatRelative(notification.createdAt),
            style: const TextStyle(fontSize: 11, color: AppColors.gray),
          ),
        ],
      ),
      trailing: notification.isRead
          ? null
          : Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
            ),
      onTap: () => _openNotification(notification),
    );
  }
}
