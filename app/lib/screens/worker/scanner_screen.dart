import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../models/product.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class ScannerScreen extends StatefulWidget {
  final int orderId;
  final int? itemId;

  const ScannerScreen({super.key, required this.orderId, this.itemId});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  MobileScannerController? _cameraController;
  Product? _scannedProduct;
  bool _isLookingUp = false;
  String? _error;
  bool _autoIncremented = false;
  int _scanCount = 0;

  @override
  void initState() {
    super.initState();
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }

  Future<void> _onBarcodeDetected(BarcodeCapture capture) async {
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null || code.isEmpty || _isLookingUp) return;

    HapticFeedback.mediumImpact();
    setState(() => _isLookingUp = true);

    try {
      final response = await apiService.get('/api/products/barcode/$code');
      final data = response['data'] ?? response['product'] ?? response;
      final product = Product.fromJson(data as Map<String, dynamic>);

      if (!mounted) return;

      setState(() {
        _scannedProduct = product;
        _scanCount++;
        _autoIncremented = false;
      });

      if (widget.itemId != null) {
        final response2 = await apiService.get(
          ApiEndpoints.order(widget.orderId.toString()),
        );
        final orderData = response2['data'] ?? response2['order'] ?? response2;
        final items = (orderData['order_items'] ?? orderData['items'] ?? []) as List;
        final matching = items.where((i) =>
            (i['product_id'] as int?) == product.id ||
            (i['id'] as int?) == widget.itemId);
        if (matching.isNotEmpty) {
          setState(() => _autoIncremented = true);
          HapticFeedback.heavyImpact();
        }
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${product.name} - Stock: ${product.stock}'),
          backgroundColor: AppColors.success,
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = 'Producto no encontrado: ${e.message}');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Código no encontrado: $code'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Error al buscar producto');
      }
    } finally {
      if (mounted) setState(() => _isLookingUp = false);
    }
  }

  void _toggleTorch() {
    _cameraController?.toggleTorch();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Escanear código de barras'),
        backgroundColor: AppColors.primaryDark,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            tooltip: 'Linterna',
            onPressed: _toggleTorch,
          ),
        ],
      ),
      body: Stack(
        children: [
          if (_cameraController != null)
            MobileScanner(
              controller: _cameraController!,
              onDetect: _onBarcodeDetected,
            ),
          _buildScanOverlay(),
          if (_isLookingUp)
            Container(
              color: Colors.black.withOpacity(0.5),
              child: const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
            ),
          if (_scannedProduct != null) _buildProductSheet(),
          if (_error != null)
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.9),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white, size: 18),
                      onPressed: () => setState(() => _error = null),
                    ),
                  ],
                ),
              ),
            ),
          Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Escaneos: $_scanCount',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScanOverlay() {
    return Center(
      child: Container(
        width: 260,
        height: 140,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.primary, width: 3),
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.qr_code_scanner, color: AppColors.primary, size: 36),
            SizedBox(height: 8),
            Text(
              'Apunte al código de barras',
              style: TextStyle(color: Colors.white, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductSheet() {
    final p = _scannedProduct!;
    return Positioned(
      left: 16,
      right: 16,
      bottom: 70,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_autoIncremented)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle, color: AppColors.success, size: 18),
                    SizedBox(width: 6),
                    Text(
                      'Cantidad incrementada automáticamente',
                      style: TextStyle(color: AppColors.success, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.lightGray,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: p.image != null && p.image!.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(p.image!, fit: BoxFit.cover, errorBuilder: (_, __, ___) =>
                              const Icon(Icons.shopping_bag, color: AppColors.gray)),
                        )
                      : const Icon(Icons.shopping_bag, color: AppColors.gray),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(
                        '${formatCOP(p.price)}  |  Stock: ${p.stock}',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                      if (p.sku != null)
                        Text(
                          'SKU: ${p.sku}',
                          style: const TextStyle(fontSize: 11, color: AppColors.gray),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
