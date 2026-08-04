import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class PickupModeScreen extends StatefulWidget {
  final Order order;

  const PickupModeScreen({super.key, required this.order});

  @override
  State<PickupModeScreen> createState() => _PickupModeScreenState();
}

class _PickupModeScreenState extends State<PickupModeScreen> {
  Timer? _timer;
  String _elapsedTime = '';
  DateTime? _readyAt;
  Order? _order;
  bool _isLoading = true;
  String? _error;

  static const List<String> _pickupStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up'];
  static const Map<String, String> _statusLabels = {
    'pending': 'Pendiente',
    'confirmed': 'Confirmado',
    'preparing': 'Preparando tu pedido',
    'ready': 'Listo para recoger',
    'picked_up': 'Recogido',
  };
  static const Map<String, IconData> _statusIcons = {
    'pending': Icons.schedule,
    'confirmed': Icons.check_circle_outline,
    'preparing': Icons.kitchen,
    'ready': Icons.shopping_bag,
    'picked_up': Icons.verified,
  };

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _isLoading = false;
    _parseReadyAt();
    _startTimer();
    _pollOrder();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _parseReadyAt() {
    if (_order?.pickupReadyAt != null && _order!.pickupReadyAt!.isNotEmpty) {
      _readyAt = DateTime.tryParse(_order!.pickupReadyAt!);
    }
  }

  void _startTimer() {
    _updateElapsedTime();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateElapsedTime();
    });
  }

  void _updateElapsedTime() {
    if (_readyAt == null) return;
    final diff = DateTime.now().difference(_readyAt!);
    final hours = diff.inHours;
    final minutes = diff.inMinutes % 60;
    final seconds = diff.inSeconds % 60;

    if (hours > 0) {
      setState(() => _elapsedTime = '${hours}h ${minutes}m ${seconds}s');
    } else if (minutes > 0) {
      setState(() => _elapsedTime = '${minutes}m ${seconds}s');
    } else {
      setState(() => _elapsedTime = '${seconds}s');
    }
  }

  Future<void> _pollOrder() async {
    while (mounted) {
      await Future.delayed(const Duration(seconds: 15));
      if (!mounted) break;
      try {
        final response = await apiService.get(ApiEndpoints.order(widget.order.id.toString()));
        final data = response['data'] ?? response['order'] ?? response;
        final updated = Order.fromJson(data as Map<String, dynamic>);
        if (updated.status != _order?.status) {
          setState(() => _order = updated);
          if (updated.status == 'ready') {
            _readyAt = DateTime.tryParse(updated.pickupReadyAt ?? DateTime.now().toIso8601String());
            _updateElapsedTime();
          }
          if (updated.status == 'picked_up') {
            _timer?.cancel();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Pedido recogido exitosamente.'),
                  backgroundColor: AppColors.success,
                ),
              );
            }
            break;
          }
        }
      } catch (_) {
        // Poll silently
      }
    }
  }

  void _copyCode() {
    if (_order?.pickupCode == null) return;
    Clipboard.setData(ClipboardData(text: _order!.pickupCode!));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Código copiado al portapapeles'), backgroundColor: AppColors.primary),
    );
  }

  int _getCurrentStepIndex() {
    if (_order == null) return 0;
    final status = _order!.status;
    if (status == 'cancelled') return -1;
    final idx = _pickupStatuses.indexOf(status);
    return idx >= 0 ? idx : 0;
  }

  bool get _isReady => _order?.status == 'ready';
  bool get _isPickedUp => _order?.status == 'picked_up';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Recogida ${_order?.displayNumber ?? ''}'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
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
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    final response = await apiService.get(ApiEndpoints.order(widget.order.id.toString()));
                    final data = response['data'] ?? response['order'] ?? response;
                    setState(() => _order = Order.fromJson(data as Map<String, dynamic>));
                  },
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      if (_isPickedUp) _buildPickedUpView() else _buildActivePickupView(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildActivePickupView() {
    return Column(
      children: [
        // Status indicator
        _buildStatusIndicator(),
        const SizedBox(height: 28),
        // Pickup code
        _buildPickupCode(),
        const SizedBox(height: 24),
        // Ready message
        if (_isReady) _buildReadyMessage(),
        const SizedBox(height: 24),
        // Order summary
        _buildOrderSummary(),
      ],
    );
  }

  Widget _buildStatusIndicator() {
    final currentIdx = _getCurrentStepIndex();
    final status = _order?.status ?? 'pending';
    final color = getOrderStatusColor(status);
    final label = _statusLabels[status] ?? status;
    final icon = _statusIcons[status] ?? Icons.help;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: color, size: 32),
                const SizedBox(width: 12),
                Text(
                  label,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: List.generate(_pickupStatuses.length - 1, (index) {
                final isCompleted = index < currentIdx;
                final isCurrent = index == currentIdx;
                return Expanded(
                  child: Row(
                    children: [
                      Expanded(
                        child: Container(
                          height: 4,
                          decoration: BoxDecoration(
                            color: isCompleted || isCurrent ? AppColors.primary : AppColors.lightGray,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      if (index < _pickupStatuses.length - 2)
                        const SizedBox(width: 6),
                    ],
                  ),
                );
              }),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: _pickupStatuses.take(4).map((s) {
                final idx = _pickupStatuses.indexOf(s);
                final isActive = idx <= currentIdx;
                return Text(
                  _statusLabels[s]!,
                  style: TextStyle(
                    fontSize: 10,
                    color: isActive ? AppColors.textPrimary : AppColors.gray,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                  ),
                  textAlign: TextAlign.center,
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPickupCode() {
    final code = _order?.pickupCode ?? '------';
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Text(
              'Tu código de recogida',
              style: TextStyle(fontSize: 15, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            // QR-like visual
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                border: Border.all(color: _isReady ? AppColors.primary : AppColors.gray, width: 3),
                borderRadius: BorderRadius.circular(16),
                color: _isReady ? AppColors.primary.withOpacity(0.03) : AppColors.lightGray,
              ),
              child: Column(
                children: [
                  // Pseudo-QR grid
                  _buildPseudoQr(code),
                  const SizedBox(height: 16),
                  Text(
                    code,
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 8,
                      color: _isReady ? AppColors.primary : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: _copyCode,
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('Copiar código'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPseudoQr(String code) {
    // Generate a visual QR-like pattern from the code
    final cells = <Widget>[];
    final gridSize = 11;
    for (int row = 0; row < gridSize; row++) {
      for (int col = 0; col < gridSize; col++) {
        bool filled = false;
        // Corner markers
        if ((row < 3 && col < 3) || (row < 3 && col >= gridSize - 3) || (row >= gridSize - 3 && col < 3)) {
          final r = row < 3 ? row : row - (gridSize - 3);
          final c = col < 3 ? col : col - (gridSize - 3);
          filled = r == 0 || r == 2 || c == 0 || c == 2 || (r == 1 && c == 1);
        } else {
          // Data cells based on code characters
          final charIndex = (row * gridSize + col) % code.length;
          filled = code[charIndex].codeUnitAt(0) % 2 == 0;
        }
        cells.add(
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: filled ? AppColors.textPrimary : Colors.white,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        );
      }
    }

    return Wrap(
      spacing: 2,
      runSpacing: 2,
      children: cells,
    );
  }

  Widget _buildReadyMessage() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.success.withOpacity(0.08), AppColors.primary.withOpacity(0.08)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.success.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.check_circle, color: AppColors.success, size: 40),
          const SizedBox(height: 12),
          const Text(
            'Tu pedido está listo para recoger',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.success),
          ),
          const SizedBox(height: 8),
          const Text(
            'Presenta este código en la tienda',
            style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
          ),
          if (_elapsedTime.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.timer_outlined, size: 18, color: AppColors.primaryDark),
                const SizedBox(width: 6),
                Text(
                  'Listo hace: $_elapsedTime',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primaryDark),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildOrderSummary() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resumen del pedido',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const Divider(height: 16),
            _buildSummaryRow('Pedido', _order?.displayNumber ?? ''),
            _buildSummaryRow('Productos', '${_order?.items.length ?? 0} artículos'),
            _buildSummaryRow('Total', formatCOP(_order?.total ?? 0), highlight: true),
            if (_order?.paymentMethod != null)
              _buildSummaryRow('Pago', AppStrings.paymentMethods[_order!.paymentMethod] ?? _order!.paymentMethod!),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
          Text(
            value,
            style: TextStyle(
              fontWeight: highlight ? FontWeight.bold : FontWeight.w500,
              color: highlight ? AppColors.primary : AppColors.textPrimary,
              fontSize: highlight ? 16 : 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPickedUpView() {
    return Column(
      children: [
        const SizedBox(height: 60),
        Container(
          width: 100,
          height: 100,
          decoration: BoxDecoration(
            color: AppColors.success.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.verified, color: AppColors.success, size: 56),
        ),
        const SizedBox(height: 24),
        const Text(
          'Pedido recogido',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.success),
        ),
        const SizedBox(height: 8),
        Text(
          'Tu pedido ${_order?.displayNumber ?? ''} fue recogido exitosamente.',
          style: const TextStyle(fontSize: 15, color: AppColors.textSecondary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              Navigator.pushNamedAndRemoveUntil(context, '/home', (_) => false);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Volver al inicio', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }
}
