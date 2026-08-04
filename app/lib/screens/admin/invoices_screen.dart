import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  List<Map<String, dynamic>> _invoices = [];
  bool _isLoading = true;
  String? _error;
  String _statusFilter = 'all';
  DateTime? _dateFrom;
  DateTime? _dateTo;
  int _totalIssued = 0;
  int _totalValidated = 0;
  int _pendingCount = 0;

  @override
  void initState() {
    super.initState();
    _loadInvoices();
  }

  Future<void> _loadInvoices() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final queryParams = <String, String>{};
      if (_statusFilter != 'all') {
        queryParams['dian_status'] = _statusFilter;
      }
      if (_dateFrom != null) {
        queryParams['date_from'] = _dateFrom!.toIso8601String().split('T').first;
      }
      if (_dateTo != null) {
        queryParams['date_to'] = _dateTo!.toIso8601String().split('T').first;
      }
      final response = await apiService.get(ApiEndpoints.adminInvoices, queryParams: queryParams);
      final raw = response['data'] ?? response['invoices'] ?? response;
      final list = raw is List ? raw : [raw];
      final summary = response['summary'] as Map<String, dynamic>? ?? {};
      setState(() {
        _invoices = list.map((e) => e as Map<String, dynamic>).toList();
        _totalIssued = (summary['total_issued'] as num?)?.toInt() ?? 0;
        _totalValidated = (summary['total_validated'] as num?)?.toInt() ?? 0;
        _pendingCount = (summary['pending_count'] as num?)?.toInt() ?? 0;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar facturas';
        _isLoading = false;
      });
    }
  }

  String _getDianLabel(String status) {
    const map = {
      'pending': 'Pendiente',
      'sent': 'Enviada',
      'validated': 'Validada',
      'rejected': 'Rechazada',
    };
    return map[status] ?? status;
  }

  Color _getDianColor(String status) {
    switch (status) {
      case 'pending':
        return AppColors.accent;
      case 'sent':
        return Colors.blue;
      case 'validated':
        return AppColors.success;
      case 'rejected':
        return AppColors.error;
      default:
        return AppColors.gray;
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
      _loadInvoices();
    }
  }

  Future<void> _viewPdf(int invoiceId) async {
    try {
      final response = await apiService.get('/api/invoices/$invoiceId/pdf-url');
      final url = response['url'] as String? ?? response['data'] as String?;
      if (url != null && url.isNotEmpty) {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('PDF no disponible'), backgroundColor: AppColors.accent),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al abrir PDF'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _resendDian(int invoiceId) async {
    try {
      await apiService.post('/api/invoices/$invoiceId/resend-dian', {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reenvío a DIAN solicitado'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _showInvoiceDetail(Map<String, dynamic> invoice) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text('Factura #${invoice['number'] ?? invoice['id']}'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildDetailRow('Pedido', '#${invoice['order_id'] ?? '-'}'),
              _buildDetailRow('Cliente', invoice['client_name'] ?? '-'),
              _buildDetailRow('Total', formatCOP((invoice['total'] as num?)?.toInt() ?? 0)),
              _buildDetailRow('Estado DIAN', _getDianLabel(invoice['dian_status'] ?? 'pending')),
              _buildDetailRow('Fecha', invoice['created_at'] != null ? formatDate(invoice['created_at'].toString()) : '-'),
              if (invoice['dian_error'] != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: AppColors.error.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
                  child: Text('Error DIAN: ${invoice['dian_error']}', style: const TextStyle(fontSize: 12, color: AppColors.error)),
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cerrar')),
          if (invoice['dian_status'] == 'rejected' || invoice['dian_status'] == 'pending')
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                _resendDian(invoice['id'] as int);
              },
              child: const Text('Reenviar DIAN'),
            ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _viewPdf(invoice['id'] as int);
            },
            child: const Text('Ver PDF'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Facturación'),
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
                        onPressed: _loadInvoices,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    _buildSummaryCards(),
                    _buildFilterBar(),
                    Expanded(
                      child: _invoices.isEmpty
                          ? EmptyState(
                              icon: Icons.receipt_long_outlined,
                              title: 'Sin facturas',
                              subtitle: 'No hay facturas para los filtros seleccionados',
                            )
                          : RefreshIndicator(
                              onRefresh: _loadInvoices,
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                itemCount: _invoices.length,
                                itemBuilder: (context, index) => _buildInvoiceCard(_invoices[index]),
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildSummaryCards() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: AppColors.surface,
      child: Row(
        children: [
          Expanded(
            child: _buildSummaryCard('Total emitidas', formatCOP(_totalIssued), AppColors.primary, Icons.receipt),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _buildSummaryCard('Validadas', formatCOP(_totalValidated), AppColors.success, Icons.check_circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _buildSummaryCard('Pendientes', '$_pendingCount', AppColors.accent, Icons.hourglass_top),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(String title, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: color)),
          Text(title, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildChip('Todas', 'all'),
            const SizedBox(width: 6),
            _buildChip('Pendientes', 'pending'),
            const SizedBox(width: 6),
            _buildChip('Enviadas', 'sent'),
            const SizedBox(width: 6),
            _buildChip('Validadas', 'validated'),
            const SizedBox(width: 6),
            _buildChip('Rechazadas', 'rejected'),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: _pickDateRange,
              icon: const Icon(Icons.calendar_today, size: 14),
              label: Text(
                _dateFrom != null
                    ? '${formatDate(_dateFrom!.toIso8601String())} - ${formatDate(_dateTo!.toIso8601String())}'
                    : 'Fechas',
                style: const TextStyle(fontSize: 12),
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                visualDensity: VisualDensity.compact,
              ),
            ),
            if (_dateFrom != null) ...[
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(Icons.close, size: 16),
                onPressed: () {
                  setState(() { _dateFrom = null; _dateTo = null; });
                  _loadInvoices();
                },
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildChip(String label, String status) {
    final isActive = _statusFilter == status;
    return ChoiceChip(
      label: Text(label, style: TextStyle(fontSize: 12, color: isActive ? Colors.white : AppColors.textSecondary)),
      selected: isActive,
      onSelected: (_) => setState(() => _statusFilter = status),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.lightGray,
      side: BorderSide.none,
      visualDensity: VisualDensity.compact,
    );
  }

  Widget _buildInvoiceCard(Map<String, dynamic> invoice) {
    final dianStatus = invoice['dian_status'] as String? ?? 'pending';
    final dianColor = _getDianColor(dianStatus);
    final total = (invoice['total'] as num?)?.toInt() ?? 0;
    final date = invoice['created_at'] as String? ?? '';
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: () => _showInvoiceDetail(invoice),
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
                          invoice['number']?.toString() ?? '#${invoice['id']}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(width: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: dianColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _getDianLabel(dianStatus),
                            style: TextStyle(color: dianColor, fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      invoice['client_name'] as String? ?? 'Cliente',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    Text(
                      date.isNotEmpty ? '${formatDate(date)} ${formatTime(date)}' : '',
                      style: const TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(formatCOP(total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 20),
                    onSelected: (action) {
                      if (action == 'pdf') _viewPdf(invoice['id'] as int);
                      if (action == 'resend') _resendDian(invoice['id'] as int);
                      if (action == 'credit_note') _createCreditNote(invoice);
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'pdf', child: Text('Ver PDF')),
                      if (dianStatus == 'rejected' || dianStatus == 'pending')
                        const PopupMenuItem(value: 'resend', child: Text('Reenviar a DIAN')),
                      const PopupMenuItem(value: 'credit_note', child: Text('Nota crédito')),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _createCreditNote(Map<String, dynamic> invoice) async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Crear nota crédito'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Factura: ${invoice['number'] ?? invoice['id']}'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: 'Razón *',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              reasonController.dispose();
              Navigator.pop(ctx);
            },
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              final r = reasonController.text.trim();
              reasonController.dispose();
              Navigator.pop(ctx, r);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
            child: const Text('Crear nota'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    try {
      await apiService.post('/api/invoices/${invoice['id']}/credit-note', {'reason': reason});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Nota crédito creada'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }
}
