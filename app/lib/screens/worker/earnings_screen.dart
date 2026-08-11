import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class EarningsPainter extends CustomPainter {
  final List<double> values;
  final double maxValue;

  EarningsPainter({required this.values, required this.maxValue});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty || maxValue == 0) return;

    final barWidth = (size.width - (values.length - 1) * 4) / values.length;
    final paint = Paint()..style = PaintingStyle.fill;

    for (int i = 0; i < values.length; i++) {
      final barHeight = (values[i] / maxValue) * (size.height - 24);
      final x = i * (barWidth + 4);
      final y = size.height - 20 - barHeight;

      paint.color = i == values.length - 1 ? AppColors.accent : AppColors.primary;
      final rrect = RRect.fromRectAndCorners(
        Rect.fromLTWH(x, y, barWidth, barHeight),
        bottomLeft: const Radius.circular(4),
        bottomRight: const Radius.circular(4),
        topLeft: const Radius.circular(2),
        topRight: const Radius.circular(2),
      );
      canvas.drawRRect(rrect, paint);

      final labelPainter = TextPainter(
        text: TextSpan(
          text: '${i + 1}',
          style: const TextStyle(fontSize: 9, color: AppColors.textSecondary),
        ),
        textDirection: TextDirection.ltr,
      );
      labelPainter.layout();
      labelPainter.paint(
        canvas,
        Offset(x + (barWidth - labelPainter.width) / 2, size.height - 14),
      );
    }
  }

  @override
  bool shouldRepaint(covariant EarningsPainter oldDelegate) =>
      values != oldDelegate.values || maxValue != oldDelegate.maxValue;
}

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  int _selectedTab = 0;
  bool _isLoading = true;
  String? _error;
  int _totalEarned = 0;
  int _deliveriesCompleted = 0;
  int _averagePerDelivery = 0;
  List<Map<String, dynamic>> _deliveries = [];
  List<double> _chartValues = [];
  List<String> _chartLabels = [];

  @override
  void initState() {
    super.initState();
    _loadEarnings();
  }

  Future<void> _loadEarnings() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final period = _selectedTab == 0 ? 'today' : 'week';
      final response = await apiService.get(
        ApiEndpoints.workerEarnings,
        queryParams: {'period': period},
      );
      final data = response['data'] ?? response;
      setState(() {
        _totalEarned = (data['total_earned'] is int)
            ? data['total_earned'] as int
            : (data['total_earned'] as num?)?.toInt() ?? 0;
        _deliveriesCompleted = (data['deliveries_count'] is int)
            ? data['deliveries_count'] as int
            : (data['deliveries_count'] as num?)?.toInt() ?? 0;
        _averagePerDelivery = (data['average_per_delivery'] is int)
            ? data['average_per_delivery'] as int
            : (data['average_per_delivery'] as num?)?.toInt() ?? 0;

        final rawDeliveries = data['deliveries'] as List? ?? [];
        _deliveries = rawDeliveries.map((e) => e as Map<String, dynamic>).toList();

        final rawChart = data['daily_earnings'] as List? ?? [];
        _chartValues = rawChart.map((e) {
          final amount = e['amount'] ?? e['total'] ?? 0;
          return amount is int ? amount.toDouble() : (amount as num).toDouble();
        }).toList();
        _chartLabels = rawChart.map((e) {
          final label = e['label'] ?? e['date'] ?? '';
          return label.toString();
        }).toList();

        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar ganancias';
        _isLoading = false;
      });
    }
  }

  void _switchTab(int index) {
    if (index == _selectedTab) return;
    setState(() => _selectedTab = index);
    _loadEarnings();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mis ganancias'),
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
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadEarnings,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadEarnings,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildTabSelector(),
                      const SizedBox(height: 16),
                      _buildSummaryCards(),
                      const SizedBox(height: 20),
                      _buildChart(),
                      const SizedBox(height: 20),
                      const Text(
                        'Historial de entregas',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 10),
                      _buildDeliveriesList(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildTabSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.lightGray,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildTab('Hoy', 0),
          ),
          Expanded(
            child: _buildTab('Esta semana', 1),
          ),
        ],
      ),
    );
  }

  Widget _buildTab(String label, int index) {
    final isActive = _selectedTab == index;
    return GestureDetector(
      onTap: () => _switchTab(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: isActive ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Row(
      children: [
        Expanded(
          child: _buildSummaryCard(
            'Total ganado',
            formatCOP(_totalEarned),
            Icons.payments,
            AppColors.primary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryCard(
            'Entregas',
            '$_deliveriesCompleted',
            Icons.local_shipping,
            AppColors.accent,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryCard(
            'Promedio',
            formatCOP(_averagePerDelivery),
            Icons.trending_up,
            AppColors.gold,
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 15,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildChart() {
    if (_chartValues.isEmpty) {
      return Container(
        height: 160,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: Text('Sin datos para el gráfico', style: TextStyle(color: AppColors.gray)),
        ),
      );
    }
    final maxVal = _chartValues.reduce((a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ganancias diarias',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 140,
            width: double.infinity,
            child: CustomPaint(
              painter: EarningsPainter(values: _chartValues, maxValue: maxVal),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeliveriesList() {
    if (_deliveries.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text('Sin entregas en este período', style: TextStyle(color: AppColors.gray)),
        ),
      );
    }
    return Column(
      children: _deliveries.map((delivery) {
        final orderId = delivery['order_id'] ?? delivery['id'] ?? 0;
        final earning = delivery['earning'] ?? delivery['amount'] ?? 0;
        final clientName = delivery['client_name'] ?? 'Cliente';
        final date = delivery['date'] ?? delivery['created_at'] ?? '';
        final earnedInt = earning is int ? earning : (earning as num).toInt();

        return Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          elevation: 0,
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            leading: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.receipt_long, color: AppColors.primary, size: 20),
            ),
            title: Text(
              '#${orderId.toString().padLeft(4, '0')} - $clientName',
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
            ),
            subtitle: Text(
              date.isNotEmpty ? formatDate(date.toString()) : '',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            trailing: Text(
              '+${formatCOP(earnedInt)}',
              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 15),
            ),
          ),
        );
      }).toList(),
    );
  }
}
