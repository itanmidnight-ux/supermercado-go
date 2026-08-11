import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';

class LineChartPainter extends CustomPainter {
  final List<double> values;
  final double maxValue;
  final Color lineColor;
  final Color fillColor;

  LineChartPainter({
    required this.values,
    required this.maxValue,
    this.lineColor = AppColors.primary,
    this.fillColor = const Color(0x1A00B860),
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty || maxValue == 0) return;

    final padding = 8.0;
    final chartWidth = size.width - padding * 2;
    final chartHeight = size.height - padding * 2;

    final points = <Offset>[];
    for (int i = 0; i < values.length; i++) {
      final x = padding + (i / (values.length - 1)) * chartWidth;
      final y = padding + chartHeight - (values[i] / maxValue) * chartHeight;
      points.add(Offset(x, y));
    }

    final fillPaint = Paint()
      ..style = PaintingStyle.fill
      ..color = fillColor;
    final linePaint = Paint()
      ..style = PaintingStyle.stroke
      ..color = lineColor
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillPath = Path()
      ..moveTo(padding, size.height - padding)
      ..lineTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      final prev = points[i - 1];
      final curr = points[i];
      final cpx = (prev.dx + curr.dx) / 2;
      fillPath.cubicTo(cpx, prev.dy, cpx, curr.dy, curr.dx, curr.dy);
    }
    fillPath.lineTo(size.width - padding, size.height - padding);
    fillPath.close();
    canvas.drawPath(fillPath, fillPaint);

    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      final prev = points[i - 1];
      final curr = points[i];
      final cpx = (prev.dx + curr.dx) / 2;
      linePath.cubicTo(cpx, prev.dy, cpx, curr.dy, curr.dx, curr.dy);
    }
    canvas.drawPath(linePath, linePaint);

    for (final point in points) {
      canvas.drawCircle(point, 4, linePaint);
      canvas.drawCircle(point, 2, Paint()..color = AppColors.surface);
    }
  }

  @override
  bool shouldRepaint(covariant LineChartPainter oldDelegate) =>
      values != oldDelegate.values || maxValue != oldDelegate.maxValue;
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int _selectedTab = 0;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  bool _isLoading = false;
  String? _error;
  Map<String, dynamic> _salesData = {};
  List<Map<String, dynamic>> _productsData = [];
  List<Map<String, dynamic>> _workersData = [];

  @override
  void initState() {
    super.initState();
    _dateTo = DateTime.now();
    _dateFrom = DateTime.now().subtract(const Duration(days: 30));
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{};
      if (_dateFrom != null) queryParams['date_from'] = _dateFrom!.toIso8601String().split('T').first;
      if (_dateTo != null) queryParams['date_to'] = _dateTo!.toIso8601String().split('T').first;

      final tabParam = ['sales', 'products', 'workers'][_selectedTab];
      final response = await apiService.get(
        ApiEndpoints.adminReports,
        queryParams: {...queryParams, 'tab': tabParam},
      );
      final data = response['data'] ?? response;

      setState(() {
        if (_selectedTab == 0) {
          _salesData = data as Map<String, dynamic>;
        } else if (_selectedTab == 1) {
          final raw = data['products'] as List? ?? data as List? ?? [];
          _productsData = raw.map((e) => e as Map<String, dynamic>).toList();
        } else {
          final raw = data['workers'] as List? ?? data as List? ?? [];
          _workersData = raw.map((e) => e as Map<String, dynamic>).toList();
        }
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar reporte';
        _isLoading = false;
      });
    }
  }

  Future<void> _pickDateRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _dateFrom != null && _dateTo != null
          ? DateTimeRange(start: _dateFrom!, end: _dateTo!)
          : null,
      locale: const Locale('es', 'CO'),
    );
    if (picked != null) {
      setState(() {
        _dateFrom = picked.start;
        _dateTo = picked.end;
      });
      _loadReport();
    }
  }

  Future<void> _exportCSV(String type) async {
    try {
      final queryParams = <String, String>{'type': type};
      if (_dateFrom != null) queryParams['date_from'] = _dateFrom!.toIso8601String().split('T').first;
      if (_dateTo != null) queryParams['date_to'] = _dateTo!.toIso8601String().split('T').first;
      final response = await apiService.get('/api/analytics/export', queryParams: queryParams);
      final url = response['url'] as String? ?? response['data'] as String?;
      if (url != null && url.isNotEmpty) {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No se pudo generar la exportación'), backgroundColor: AppColors.accent),
          );
        }
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _switchTab(int index) {
    if (index == _selectedTab) return;
    setState(() => _selectedTab = index);
    _loadReport();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Reportes'),
      body: Column(
        children: [
          _buildTabBar(),
          _buildDateSelector(),
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
                              onPressed: _loadReport,
                              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                              child: const Text('Reintentar'),
                            ),
                          ],
                        ),
                      )
                    : [_buildSalesTab, _buildProductsTab, _buildWorkersTab][_selectedTab](),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: AppColors.surface,
      child: Row(
        children: [
          _buildTab('Ventas', 0),
          const SizedBox(width: 8),
          _buildTab('Productos', 1),
          const SizedBox(width: 8),
          _buildTab('Repartidores', 2),
        ],
      ),
    );
  }

  Widget _buildTab(String label, int index) {
    final isActive = _selectedTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => _switchTab(index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : AppColors.lightGray,
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
      ),
    );
  }

  Widget _buildDateSelector() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _pickDateRange,
              icon: const Icon(Icons.calendar_today, size: 16),
              label: Text(
                _dateFrom != null
                    ? '${formatDate(_dateFrom!.toIso8601String())} - ${formatDate(_dateTo!.toIso8601String())}'
                    : 'Seleccionar rango',
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: () => _exportCSV(['sales', 'products', 'workers'][_selectedTab]),
            icon: const Icon(Icons.download, size: 16),
            label: const Text('CSV', style: TextStyle(fontSize: 12)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryDark,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesTab() {
    final totalSales = (_salesData['total_sales'] as num?)?.toInt() ?? 0;
    final orderCount = (_salesData['order_count'] as num?)?.toInt() ?? 0;
    final avgTicket = (_salesData['average_ticket'] as num?)?.toInt() ?? 0;
    final dailyRaw = _salesData['daily_revenue'] as List? ?? [];
    final dailyValues = dailyRaw.map((e) {
      final v = e['total'] ?? e['revenue'] ?? e['amount'] ?? 0;
      return v is int ? v.toDouble() : (v as num).toDouble();
    }).toList();
    final maxVal = dailyValues.isEmpty ? 1.0 : dailyValues.reduce((a, b) => a > b ? a : b);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        Row(
          children: [
            Expanded(child: _buildStatCard('Ventas totales', formatCOP(totalSales), AppColors.primary)),
            const SizedBox(width: 10),
            Expanded(child: _buildStatCard('Pedidos', '$orderCount', AppColors.accent)),
            const SizedBox(width: 10),
            Expanded(child: _buildStatCard('Ticket promedio', formatCOP(avgTicket), AppColors.gold)),
          ],
        ),
        const SizedBox(height: 16),
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Ingresos diarios', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                SizedBox(
                  height: 180,
                  width: double.infinity,
                  child: dailyValues.isEmpty
                      ? const Center(child: Text('Sin datos', style: TextStyle(color: AppColors.gray)))
                      : CustomPaint(
                          painter: LineChartPainter(values: dailyValues, maxValue: maxVal),
                        ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProductsTab() {
    if (_productsData.isEmpty) {
      return const Center(
        child: Text('Sin datos de productos', style: TextStyle(color: AppColors.gray)),
      );
    }
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        const Text('Top 10 productos', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columnSpacing: 12,
              headingRowHeight: 40,
              dataRowHeight: 44,
              columns: const [
                DataColumn(label: Text('#', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                DataColumn(label: Text('Producto', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                DataColumn(label: Text('Vendidos', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                DataColumn(label: Text('Ingresos', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                DataColumn(label: Text('Margen %', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ],
              rows: _productsData.take(10).toList().asMap().entries.map((entry) {
                final idx = entry.key;
                final p = entry.value;
                final sold = (p['qty_sold'] ?? p['total_qty'] ?? 0) as num;
                final revenue = (p['revenue'] ?? p['total'] ?? 0) as num;
                final margin = (p['margin_percent'] ?? p['margin'] ?? 0) as num;
                return DataRow(
                  cells: [
                    DataCell(Text('${idx + 1}', style: const TextStyle(fontSize: 12, color: AppColors.gray))),
                    DataCell(
                      Text(p['name'] ?? '-', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12)),
                    ),
                    DataCell(Text('${sold.toInt()}', style: const TextStyle(fontSize: 12))),
                    DataCell(Text(formatCOP(revenue.toInt()), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                    DataCell(Text(
                      '${margin.toStringAsFixed(1)}%',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: margin >= 30 ? AppColors.success : margin >= 15 ? AppColors.accent : AppColors.error,
                      ),
                    )),
                  ],
                );
              }).toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWorkersTab() {
    if (_workersData.isEmpty) {
      return const Center(
        child: Text('Sin datos de repartidores', style: TextStyle(color: AppColors.gray)),
      );
    }
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      children: [
        const Text('Rendimiento de repartidores', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ..._workersData.map((w) {
          final name = w['name'] as String? ?? 'Repartidor';
          final deliveryCount = (w['delivery_count'] ?? w['deliveries'] ?? 0) as num;
          final avgTime = w['avg_time_minutes'] as num? ?? 0;
          final avgRating = (w['avg_rating'] ?? 0) as num;
          return Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        Text('$deliveryCount entregas', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
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
                        avgTime > 0 ? '${avgTime.toStringAsFixed(0)} min promedio' : '-',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color)),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}
