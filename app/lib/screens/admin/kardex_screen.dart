import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class KardexScreen extends StatefulWidget {
  final int productId;

  const KardexScreen({super.key, required this.productId});

  @override
  State<KardexScreen> createState() => _KardexScreenState();
}

class _KardexScreenState extends State<KardexScreen> {
  Map<String, dynamic>? _productInfo;
  List<Map<String, dynamic>> _movements = [];
  bool _isLoading = true;
  String? _error;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  int _totalIn = 0;
  int _totalOut = 0;
  int _currentStock = 0;

  @override
  void initState() {
    super.initState();
    _loadKardex();
  }

  Future<void> _loadKardex() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{};
      if (_dateFrom != null) {
        queryParams['date_from'] = _dateFrom!.toIso8601String().split('T').first;
      }
      if (_dateTo != null) {
        queryParams['date_to'] = _dateTo!.toIso8601String().split('T').first;
      }
      final response = await apiService.get(
        '${ApiEndpoints.adminKardex}/${widget.productId}',
        queryParams: queryParams,
      );
      final data = response['data'] ?? response;
      setState(() {
        _productInfo = data['product'] ?? data['product_info'];
        _currentStock = (data['current_stock'] is int)
            ? data['current_stock'] as int
            : (data['current_stock'] as num?)?.toInt() ?? 0;
        _totalIn = (data['total_in'] is int)
            ? data['total_in'] as int
            : (data['total_in'] as num?)?.toInt() ?? 0;
        _totalOut = (data['total_out'] is int)
            ? data['total_out'] as int
            : (data['total_out'] as num?)?.toInt() ?? 0;
        final rawMovements = data['movements'] as List? ?? [];
        _movements = rawMovements.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar el kardex';
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
      _loadKardex();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Kardex', showBack: true),
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
                        onPressed: _loadKardex,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadKardex,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildProductHeader(),
                      const SizedBox(height: 12),
                      _buildSummaryCards(),
                      const SizedBox(height: 12),
                      _buildDateFilter(),
                      const SizedBox(height: 12),
                      if (_movements.isEmpty)
                        EmptyState(
                          icon: Icons.receipt_long_outlined,
                          title: 'Sin movimientos',
                          subtitle: 'No hay registros de movimientos para este producto',
                        )
                      else
                        _buildMovementsTable(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildProductHeader() {
    final info = _productInfo;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.inventory_2, color: AppColors.primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    info?['name'] ?? 'Producto #${widget.productId}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                  if (info?['sku'] != null)
                    Text(
                      'SKU: ${info!['sku']}',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('Stock actual', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                Text(
                  '$_currentStock',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22, color: AppColors.primaryDark),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Row(
      children: [
        Expanded(
          child: _buildSummaryItem('Entradas', '$_totalIn', AppColors.success, Icons.arrow_downward),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryItem('Salidas', '$_totalOut', AppColors.error, Icons.arrow_upward),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryItem(
            'Diferencia',
            '${_totalIn - _totalOut}',
            AppColors.primary,
            Icons.balance,
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryItem(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: color)),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildDateFilter() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: _pickDateRange,
            icon: const Icon(Icons.calendar_today, size: 16),
            label: Text(
              _dateFrom != null
                  ? '${formatDate(_dateFrom!.toIso8601String())} - ${formatDate(_dateTo!.toIso8601String())}'
                  : 'Filtrar por rango de fechas',
              style: const TextStyle(fontSize: 13),
            ),
          ),
        ),
        if (_dateFrom != null) ...[
          const SizedBox(width: 8),
          TextButton(
            onPressed: () {
              setState(() {
                _dateFrom = null;
                _dateTo = null;
              });
              _loadKardex();
            },
            child: const Text('Limpiar'),
          ),
        ],
      ],
    );
  }

  Widget _buildMovementsTable() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 12,
          headingRowHeight: 40,
          dataRowHeight: 48,
          columns: const [
            DataColumn(label: Text('Fecha', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
            DataColumn(label: Text('Tipo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
            DataColumn(label: Text('Cant.', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
            DataColumn(label: Text('Antes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
            DataColumn(label: Text('Después', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
            DataColumn(label: Text('Referencia', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
            DataColumn(label: Text('Usuario', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
          ],
          rows: _movements.map((m) {
            final isIn = m['type'] == 'in' || m['type'] == 'entry' || m['movement_type'] == 'in';
            final qty = (m['qty'] is int)
                ? m['qty'] as int
                : (m['qty'] as num).toInt();
            final stockBefore = (m['stock_before'] is int)
                ? m['stock_before'] as int
                : (m['stock_before'] as num?)?.toInt() ?? 0;
            final stockAfter = (m['stock_after'] is int)
                ? m['stock_after'] as int
                : (m['stock_after'] as num?)?.toInt() ?? 0;
            return DataRow(
              cells: [
                DataCell(
                  Text(
                    m['created_at'] != null ? formatDate(m['created_at'].toString()) : '-',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                DataCell(
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: isIn ? AppColors.success.withOpacity(0.12) : AppColors.error.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isIn ? 'Entrada' : 'Salida',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isIn ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ),
                ),
                DataCell(
                  Text(
                    (isIn ? '+' : '-') + qty.toString(),
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isIn ? AppColors.success : AppColors.error,
                    ),
                  ),
                ),
                DataCell(Text(stockBefore.toString(), style: const TextStyle(fontSize: 12))),
                DataCell(Text(stockAfter.toString(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                DataCell(
                  Text(
                    m['reference'] ?? m['ref'] ?? '-',
                    style: const TextStyle(fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                DataCell(
                  Text(
                    m['user_name'] ?? m['user'] ?? '-',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}
