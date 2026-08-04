import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/order_status_chip.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Order> _orders = [];
  bool _isLoading = true;
  String? _error;
  DateTime? _dateFrom;
  DateTime? _dateTo;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{
        'status': 'delivered,cancelled',
      };
      if (_dateFrom != null) {
        queryParams['date_from'] = _dateFrom!.toIso8601String().split('T').first;
      }
      if (_dateTo != null) {
        queryParams['date_to'] = _dateTo!.toIso8601String().split('T').first;
      }
      final response = await apiService.get(
        ApiEndpoints.workerOrders,
        queryParams: queryParams,
      );
      final raw = response['data'] ?? response['orders'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _orders = list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar el historial';
        _isLoading = false;
      });
    }
  }

  Future<void> _pickDateRange() async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2024),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDateRange: _dateFrom != null && _dateTo != null
          ? DateTimeRange(start: _dateFrom!, end: _dateTo!)
          : null,
      locale: const Locale('es', 'CO'),
      textDirection: TextDirection.ltr,
    );
    if (picked != null) {
      setState(() {
        _dateFrom = picked.start;
        _dateTo = picked.end;
      });
      _loadHistory();
    }
  }

  void _clearFilters() {
    setState(() {
      _dateFrom = null;
      _dateTo = null;
    });
    _loadHistory();
  }

  void _openDetail(Order order) {
    Navigator.pushNamed(context, '/order-detail', arguments: order.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Historial de entregas'),
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
                        onPressed: _loadHistory,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _orders.isEmpty
                  ? RefreshIndicator(
                      onRefresh: _loadHistory,
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverFillRemaining(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.history, size: 64, color: AppColors.gray),
                                const SizedBox(height: 16),
                                const Text(
                                  'Sin entregas registradas',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _dateFrom != null
                                      ? 'No hay entregas en el rango seleccionado'
                                      : 'Aún no has completado entregas',
                                  style: const TextStyle(color: AppColors.textSecondary),
                                  textAlign: TextAlign.center,
                                ),
                                if (_dateFrom != null) ...[
                                  const SizedBox(height: 16),
                                  TextButton(
                                    onPressed: _clearFilters,
                                    child: const Text('Limpiar filtros'),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: [
                        _buildFilterBar(),
                        Expanded(
                          child: RefreshIndicator(
                            onRefresh: _loadHistory,
                            child: ListView.separated(
                              controller: _scrollController,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              itemCount: _orders.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (context, index) => _buildOrderItem(_orders[index]),
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.surface,
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: _pickDateRange,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.gray.withOpacity(0.3)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Text(
                      _dateFrom != null
                          ? '${formatDate(_dateFrom!.toIso8601String())} - ${formatDate(_dateTo!.toIso8601String())}'
                          : 'Filtrar por fechas',
                      style: TextStyle(
                        fontSize: 13,
                        color: _dateFrom != null ? AppColors.textPrimary : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_dateFrom != null) ...[
            const SizedBox(width: 8),
            TextButton(
              onPressed: _clearFilters,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.error,
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: const Text('Limpiar', style: TextStyle(fontSize: 13)),
            ),
          ],
          const SizedBox(width: 4),
          Text(
            '${_orders.length} resultado${_orders.length != 1 ? "s" : ""}',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderItem(Order order) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      child: InkWell(
        onTap: () => _openDetail(order),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          order.displayNumber,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(width: 10),
                        OrderStatusChip(status: order.status),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      order.clientName ?? 'Cliente',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      order.deliveryAddress ?? '',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatCOP(order.total),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    order.createdAt != null ? formatDate(order.createdAt!) : '',
                    style: const TextStyle(fontSize: 11, color: AppColors.gray),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
