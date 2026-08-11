import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/invoice.dart';
import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class InvoiceViewScreen extends StatefulWidget {
  final Order order;

  const InvoiceViewScreen({super.key, required this.order});

  @override
  State<InvoiceViewScreen> createState() => _InvoiceViewState();
}

class _InvoiceViewState extends State<InvoiceViewScreen> {
  Invoice? _invoice;
  List<Map<String, dynamic>> _invoiceItems = [];
  bool _isLoading = true;
  String? _error;
  String? _pdfPath;

  @override
  void initState() {
    super.initState();
    _loadInvoice();
  }

  Future<void> _loadInvoice() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.orderInvoice(widget.order.id.toString()));
      final data = response['data'] ?? response['invoice'] ?? response;

      if (data is Map<String, dynamic>) {
        _invoice = Invoice.fromJson(data);
        if (data['items'] != null) {
          final items = data['items'] as List;
          _invoiceItems = items
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        }
        _pdfPath = data['pdf_path'] as String?;
      }

      setState(() => _isLoading = false);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar la factura';
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadPdf() async {
    if (_pdfPath == null || _pdfPath!.isEmpty) return;
    try {
      final uri = Uri.parse(_pdfPath!);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No se pudo abrir el enlace'), backgroundColor: AppColors.error),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al descargar PDF'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Color _getDianColor(String? status) {
    switch (status) {
      case 'accepted':
      case 'aceptada':
        return AppColors.success;
      case 'rejected':
      case 'rechazada':
        return AppColors.error;
      default:
        return AppColors.accent;
    }
  }

  String _getDianLabel(String? status) {
    switch (status) {
      case 'accepted':
      case 'aceptada':
        return 'Aceptada por DIAN';
      case 'rejected':
      case 'rechazada':
        return 'Rechazada por DIAN';
      case 'pending':
      case 'pendiente':
        return 'Pendiente DIAN';
      default:
        return status ?? 'Sin estado';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Factura'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (_pdfPath != null && _pdfPath!.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.picture_as_pdf),
              tooltip: 'Descargar PDF',
              onPressed: _downloadPdf,
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
                        onPressed: _loadInvoice,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _invoice == null
                  ? const Center(child: Text('Factura no disponible'))
                  : RefreshIndicator(
                      onRefresh: _loadInvoice,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _buildInvoiceHeader(),
                          const SizedBox(height: 16),
                          _buildCustomerInfo(),
                          const SizedBox(height: 16),
                          _buildItemsTable(),
                          const SizedBox(height: 16),
                          _buildTotals(),
                          const SizedBox(height: 16),
                          _buildDianStatus(),
                          const SizedBox(height: 16),
                          _buildQrPlaceholder(),
                          if (_pdfPath != null && _pdfPath!.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            _buildDownloadButton(),
                          ],
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildInvoiceHeader() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _invoice!.fullNumber ?? '${_invoice!.prefix ?? 'FAC'}-${_invoice!.number.toString().padLeft(6, '0')}',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primary),
            ),
            const SizedBox(height: 8),
            if (_invoice!.resolutionNumber != null)
              Text(
                'Resolución: ${_invoice!.resolutionNumber}',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            if (_invoice!.issuedAt != null) ...[
              const SizedBox(height: 4),
              Text(
                'Fecha: ${formatDate(_invoice!.issuedAt!)}',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
            if (_invoice!.type != null) ...[
              const SizedBox(height: 4),
              Text(
                'Tipo: ${_invoice!.type!.toUpperCase()}',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCustomerInfo() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Información del cliente',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const Divider(height: 16),
            Text(
              _invoice!.customerName ?? widget.order.clientName ?? 'Cliente',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Text(
              'Pedido ${widget.order.displayNumber}',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            if (_invoice!.paymentMethod != null)
              Text(
                'Pago: ${AppStrings.paymentMethods[_invoice!.paymentMethod] ?? _invoice!.paymentMethod}',
                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildItemsTable() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Detalle de productos',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const Divider(height: 16),
            // Table header
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(color: AppColors.lightGray, borderRadius: BorderRadius.circular(6)),
              child: const Row(
                children: [
                  Expanded(flex: 3, child: Text('Descripción', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12))),
                  SizedBox(width: 40, child: Text('Cant.', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12), textAlign: TextAlign.center)),
                  SizedBox(width: 70, child: Text('Precio', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12), textAlign: TextAlign.right)),
                  SizedBox(width: 50, child: Text('IVA', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12), textAlign: TextAlign.right)),
                  SizedBox(width: 80, child: Text('Total', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12), textAlign: TextAlign.right)),
                ],
              ),
            ),
            const SizedBox(height: 4),
            // Rows from order items or invoice items
            if (_invoiceItems.isNotEmpty)
              ..._invoiceItems.map((item) => _buildInvoiceItemRow(
                    description: item['description'] as String? ?? item['product_name'] as String? ?? '',
                    qty: (item['qty'] is int ? (item['qty'] as int).toString() : (item['qty'] as num).toStringAsFixed(2)),
                    price: (item['unit_price'] is int ? item['unit_price'] as int : (item['unit_price'] as num).toInt()),
                    tax: (item['tax_amount'] is int ? item['tax_amount'] as int? : (item['tax_amount'] as num?)?.toInt()) ?? 0,
                    total: (item['line_total'] is int ? item['line_total'] as int : (item['line_total'] as num).toInt()),
                  ))
            else
              ...widget.order.items.map((item) => _buildInvoiceItemRow(
                    description: item.productName,
                    qty: item.qty == item.qty.roundToDouble() ? item.qty.toInt().toString() : item.qty.toStringAsFixed(2),
                    price: item.unitPrice,
                    tax: item.taxAmount ?? 0,
                    total: item.lineTotal,
                  )),
          ],
        ),
      ),
    );
  }

  Widget _buildInvoiceItemRow({
    required String description,
    required String qty,
    required int price,
    required int tax,
    required int total,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              description,
              style: const TextStyle(fontSize: 12),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(
            width: 40,
            child: Text(qty, style: const TextStyle(fontSize: 12), textAlign: TextAlign.center),
          ),
          SizedBox(
            width: 70,
            child: Text(formatCOP(price), style: const TextStyle(fontSize: 12), textAlign: TextAlign.right),
          ),
          SizedBox(
            width: 50,
            child: Text(formatCOP(tax), style: const TextStyle(fontSize: 12), textAlign: TextAlign.right),
          ),
          SizedBox(
            width: 80,
            child: Text(formatCOP(total), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500), textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }

  Widget _buildTotals() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _buildTotalRow('Subtotal', formatCOP(_invoice!.subtotal)),
            _buildTotalRow('Descuento', '-${formatCOP(_invoice!.discountTotal)}', valueColor: AppColors.success),
            _buildTotalRow('IVA', formatCOP(_invoice!.taxTotal)),
            const Divider(),
            _buildTotalRow('Total', formatCOP(_invoice!.total), isTotal: true),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalRow(String label, String value, {bool isTotal = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 16 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isTotal ? 18 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w600,
              color: valueColor ?? (isTotal ? AppColors.primary : AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDianStatus() {
    final dianStatus = _invoice!.dianStatus;
    final color = _getDianColor(dianStatus);
    final label = _getDianLabel(dianStatus);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(
            dianStatus == 'accepted' || dianStatus == 'aceptada' ? Icons.verified : Icons.hourglass_top,
            color: color,
            size: 22,
          ),
          const SizedBox(width: 12),
          Text(
            'Estado DIAN: $label',
            style: TextStyle(fontWeight: FontWeight.w600, color: color, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildQrPlaceholder() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.gray, width: 2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_2, size: 80, color: AppColors.gray.withOpacity(0.5)),
                  const SizedBox(height: 8),
                  Text(
                    _invoice!.fullNumber ?? 'FAC-${_invoice!.number}',
                    style: const TextStyle(fontSize: 11, color: AppColors.gray),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Código QR de factura electrónica',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDownloadButton() {
    return ElevatedButton.icon(
      onPressed: _downloadPdf,
      icon: const Icon(Icons.download),
      label: const Text('Descargar PDF'),
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}
