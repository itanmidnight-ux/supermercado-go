import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class WorkersPerformanceScreen extends StatefulWidget {
  const WorkersPerformanceScreen({super.key});

  @override
  State<WorkersPerformanceScreen> createState() => _WorkersPerformanceScreenState();
}

class _WorkersPerformanceScreenState extends State<WorkersPerformanceScreen> {
  List<Map<String, dynamic>> _workers = [];
  bool _isLoading = true;
  String? _error;
  String _period = 'week';

  @override
  void initState() {
    super.initState();
    _loadWorkers();
  }

  Future<void> _loadWorkers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(
        ApiEndpoints.adminWorkersPerf,
        queryParams: {'period': _period},
      );
      final raw = response['data'] ?? response['workers'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _workers = list.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar rendimiento';
        _isLoading = false;
      });
    }
  }

  void _showWorkerDetail(Map<String, dynamic> worker) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, scrollController) => Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.gray.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    child: Text(
                      (worker['name'] as String? ?? 'R')[0].toUpperCase(),
                      style: const TextStyle(fontSize: 24, color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          worker['name'] as String? ?? 'Repartidor',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                        ),
                        if (worker['phone'] != null)
                          Text(worker['phone'].toString(), style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _buildDetailMetric('Total entregas', '${(worker['delivery_count'] ?? worker['total_deliveries'] ?? 0) as num}', Icons.local_shipping, AppColors.primary),
              const SizedBox(height: 10),
              _buildDetailMetric('Tiempo promedio', '${(worker['avg_time_minutes'] ?? 0) as num} min', Icons.timer, AppColors.accent),
              const SizedBox(height: 10),
              _buildDetailMetric('Calificación promedio', '${(worker['avg_rating'] ?? 0) as num}/5', Icons.star, AppColors.gold),
              const SizedBox(height: 10),
              _buildDetailMetric('Ganancias totales', formatCOP((worker['total_earnings'] ?? 0) as num? ?? 0), Icons.payments, AppColors.primaryDark),
              const SizedBox(height: 20),
              const Text('Historial reciente', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              Expanded(
                child: _buildEarningsChart(worker),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailMetric(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14))),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color)),
        ],
      ),
    );
  }

  Widget _buildEarningsChart(Map<String, dynamic> worker) {
    final raw = worker['daily_earnings'] as List? ?? worker['earnings_history'] as List? ?? [];
    if (raw.isEmpty) {
      return const Center(
        child: Text('Sin datos de ganancias', style: TextStyle(color: AppColors.gray)),
      );
    }
    final values = raw.map((e) {
      final v = e['amount'] ?? e['total'] ?? 0;
      return v is int ? v.toDouble() : (v as num).toDouble();
    }).toList();
    final maxVal = values.isEmpty ? 1.0 : values.reduce((a, b) => a > b ? a : b);
    return SizedBox(
      height: 120,
      width: double.infinity,
      child: CustomPaint(
        painter: _SimpleBarPainter(values: values, maxValue: maxVal),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Rendimiento repartidores'),
      body: Column(
        children: [
          _buildPeriodFilter(),
          Expanded(
            child: _isLoading
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
                              onPressed: _loadWorkers,
                              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                              child: const Text('Reintentar'),
                            ),
                          ],
                        ),
                      )
                    : _workers.isEmpty
                        ? EmptyState(
                            icon: Icons.people_outline,
                            title: 'Sin repartidores',
                            subtitle: 'No hay datos de rendimiento disponibles',
                          )
                        : RefreshIndicator(
                            onRefresh: _loadWorkers,
                            child: ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              itemCount: _workers.length,
                              itemBuilder: (context, index) => _buildWorkerCard(_workers[index]),
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodFilter() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: AppColors.surface,
      child: Row(
        children: [
          const Text('Período: ', style: TextStyle(fontWeight: FontWeight.w500)),
          const SizedBox(width: 8),
          _buildChip('Hoy', 'today'),
          const SizedBox(width: 6),
          _buildChip('Esta semana', 'week'),
          const SizedBox(width: 6),
          _buildChip('Este mes', 'month'),
        ],
      ),
    );
  }

  Widget _buildChip(String label, String period) {
    final isActive = _period == period;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isActive ? Colors.white : AppColors.textSecondary)),
      selected: isActive,
      onSelected: (_) {
        setState(() => _period = period);
        _loadWorkers();
      },
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.lightGray,
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildWorkerCard(Map<String, dynamic> worker) {
    final name = worker['name'] as String? ?? 'Repartidor';
    final deliveryCount = (worker['delivery_count'] ?? worker['total_deliveries'] ?? 0) as num;
    final avgTime = (worker['avg_time_minutes'] ?? 0) as num;
    final avgRating = (worker['avg_rating'] ?? 0) as num;
    final totalEarnings = (worker['total_earnings'] ?? 0) as num? ?? 0;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => _showWorkerDetail(worker),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primary.withOpacity(0.1),
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.local_shipping, size: 14, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        Text('$deliveryCount entregas', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(width: 12),
                        const Icon(Icons.timer, size: 14, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        Text('${avgTime.toStringAsFixed(0)} min promedio', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: List.generate(5, (i) {
                      return Icon(
                        i < avgRating.round() ? Icons.star : Icons.star_border,
                        size: 16,
                        color: AppColors.gold,
                      );
                    }),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatCOP(totalEarnings.toInt()),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, color: AppColors.gray),
            ],
          ),
        ),
      ),
    );
  }
}

class _SimpleBarPainter extends CustomPainter {
  final List<double> values;
  final double maxValue;

  _SimpleBarPainter({required this.values, required this.maxValue});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty || maxValue == 0) return;
    final barWidth = (size.width - (values.length - 1) * 3) / values.length;
    final paint = Paint()..style = PaintingStyle.fill;
    for (int i = 0; i < values.length; i++) {
      final barHeight = (values[i] / maxValue) * (size.height - 16);
      final x = i * (barWidth + 3);
      final y = size.height - 14 - barHeight;
      paint.color = AppColors.primary.withOpacity(0.4 + 0.6 * (i / values.length));
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(x, y, barWidth, barHeight),
          bottomLeft: const Radius.circular(3),
          bottomRight: const Radius.circular(3),
          topLeft: const Radius.circular(2),
          topRight: const Radius.circular(2),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SimpleBarPainter oldDelegate) =>
      values != oldDelegate.values || maxValue != oldDelegate.maxValue;
}
