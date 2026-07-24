import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:cached_network_image/cached_network_image.dart';
import '../models/estado.dart';
import '../models/product.dart';
import '../services/api_service.dart';
import '../widgets/empty_state.dart';
import 'client_estados_viewer.dart';

class AdminEstadosScreen extends StatefulWidget {
  const AdminEstadosScreen({super.key});
  @override
  State<AdminEstadosScreen> createState() => _AdminEstadosScreenState();
}

class _AdminEstadosScreenState extends State<AdminEstadosScreen> {
  List<Estado> _estados = [];
  List<Product> _products = [];
  bool _loading = true;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final estados = await ApiService.getEstados();
      final products = await ApiService.getProducts();
      if (mounted) {
        _estados = estados;
        _products = products.where((p) => p.available).toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _openCreateFlow() async {
    final info = await _askPromoDetails();
    if (info == null || !mounted) return; // cancelado

    final product = info['product'] as Product?;
    final useProductImage = info['use_product_image'] as bool;

    String? filePath;
    Uint8List? bytes;
    String mime = 'image/jpeg';

    if (useProductImage) {
      if (product == null || product.images.isEmpty) {
        _snack('Ese producto no tiene imagen para reutilizar');
        return;
      }
      setState(() => _uploading = true);
      try {
        final res = await http.get(
          Uri.parse(ApiService.productImageUrl(product.images.first)),
          headers: ApiService.imageHeaders,
        );
        if (res.statusCode != 200)
          throw Exception('No se pudo cargar la imagen del producto');
        bytes = res.bodyBytes;
      } catch (e) {
        if (mounted) {
          _snack(e.toString().replaceAll('Exception: ', ''));
          setState(() => _uploading = false);
        }
        return;
      }
    } else {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      final file = result.files.first;
      filePath = file.path;
      bytes = file.bytes;
      if (filePath == null && bytes == null) {
        _snack('No se pudo leer el archivo');
        return;
      }
      final ext = (file.extension ?? 'jpg').toLowerCase();
      const mimeMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
      };
      mime = mimeMap[ext] ?? 'image/jpeg';
    }

    setState(() => _uploading = true);
    try {
      await ApiService.createEstado(
        filePath,
        caption: info['caption'] as String?,
        bytes: bytes,
        mimeType: mime,
        productId: product?.id,
        productName: product?.name,
        discountType: info['discount_type'] as String?,
        discountValue: info['discount_value'] as double?,
      );
      await _load();
      if (mounted) _snack('Promoción publicada', success: true);
    } catch (e) {
      if (mounted) _snack(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<Map<String, dynamic>?> _askPromoDetails() async {
    final captionCtrl = TextEditingController();
    final percentCtrl = TextEditingController(text: '10');
    Product? selectedProduct;
    bool useProductImage = false;
    String? discountType; // null | 'percent' | '2x1'
    String? error;

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Nueva publicación'),
          content: SizedBox(
              width: 340,
              child: SingleChildScrollView(
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: captionCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Texto (opcional)',
                          hintText: 'Escribe un texto...',
                        ),
                        maxLines: 2,
                      ),
                      if (_products.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        DropdownButtonFormField<Product>(
                          initialValue: selectedProduct,
                          decoration: const InputDecoration(
                            labelText: 'Producto vinculado',
                            prefixIcon: Icon(Icons.shopping_bag_outlined),
                          ),
                          hint: const Text('Sin producto'),
                          items: [
                            const DropdownMenuItem<Product>(
                                value: null, child: Text('Sin producto')),
                            ..._products.map((p) => DropdownMenuItem<Product>(
                                  value: p,
                                  child: Text(p.name,
                                      overflow: TextOverflow.ellipsis),
                                )),
                          ],
                          onChanged: (v) => setS(() {
                            selectedProduct = v;
                            if (v == null) {
                              useProductImage = false;
                              discountType = null;
                            }
                          }),
                        ),
                        if (selectedProduct != null)
                          CheckboxListTile(
                            contentPadding: EdgeInsets.zero,
                            value: useProductImage,
                            onChanged: (v) =>
                                setS(() => useProductImage = v ?? false),
                            title: const Text(
                                'Usar la imagen del producto (sin subir una nueva)',
                                style: TextStyle(fontSize: 13)),
                            controlAffinity: ListTileControlAffinity.leading,
                          ),
                      ],
                      const SizedBox(height: 8),
                      const Text('Promoción (opcional)',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Colors.black54)),
                      const SizedBox(height: 4),
                      _PromoOption(
                        label: 'Sin promoción',
                        selected: discountType == null,
                        onTap: () => setS(() => discountType = null),
                      ),
                      _PromoOption(
                        label: 'Descuento por porcentaje',
                        selected: discountType == 'percent',
                        onTap: () => setS(() => discountType = 'percent'),
                        expanded: discountType == 'percent'
                            ? TextField(
                                controller: percentCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    suffixText: '%',
                                    labelText: 'Porcentaje de descuento'),
                              )
                            : null,
                      ),
                      _PromoOption(
                        label: '2x1',
                        selected: discountType == '2x1',
                        onTap: () => setS(() => discountType = '2x1'),
                      ),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Text(error!,
                              style: const TextStyle(
                                  color: Colors.red, fontSize: 12)),
                        ),
                    ]),
              )),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancelar')),
            FilledButton(
              onPressed: () {
                if (discountType != null && selectedProduct == null) {
                  setS(() => error =
                      'Selecciona un producto para aplicar la promoción');
                  return;
                }
                double? discountValue;
                if (discountType == 'percent') {
                  discountValue = double.tryParse(percentCtrl.text.trim());
                  if (discountValue == null ||
                      discountValue <= 0 ||
                      discountValue > 90) {
                    setS(() => error = 'Ingresa un porcentaje válido (1-90)');
                    return;
                  }
                }
                Navigator.pop(ctx, {
                  'caption': captionCtrl.text.trim().isEmpty
                      ? null
                      : captionCtrl.text.trim(),
                  'product': selectedProduct,
                  'use_product_image': useProductImage,
                  'discount_type': discountType,
                  'discount_value': discountValue,
                });
              },
              child: const Text('Publicar'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showLikes(Estado e) async {
    showDialog(
      context: context,
      builder: (_) => _LikesDialog(estadoId: e.id, heartCount: e.heartCount),
    );
  }

  Future<void> _delete(Estado e) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Eliminar estado'),
        content: const Text('¿Eliminar este estado permanentemente?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiService.deleteEstado(e.id);
      await _load();
      if (mounted) _snack('Estado eliminado', success: true);
    } catch (ex) {
      if (mounted) _snack(ex.toString().replaceAll('Exception: ', ''));
    }
  }

  void _snack(String msg, {bool success = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor:
          success ? Theme.of(context).colorScheme.primary : Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
    ));
  }

  String _timeLeft(Estado e) {
    final diff = e.expiresAt.difference(DateTime.now());
    if (diff.inHours >= 1) return '${diff.inHours}h restantes';
    return '${diff.inMinutes}min restantes';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Stack(children: [
      _loading
          ? Center(child: CircularProgressIndicator(color: scheme.primary))
          : _estados.isEmpty
              ? const EmptyState(
                  icon: Icons.local_offer_outlined,
                  title: 'No hay promociones activas',
                  subtitle: 'Las publicaciones se mantienen visibles 7 días',
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  color: scheme.primary,
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                            childAspectRatio: 0.75),
                    itemCount: _estados.length,
                    itemBuilder: (_, i) {
                      final e = _estados[i];
                      return GestureDetector(
                        onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ClientEstadosViewer(
                                estados: _estados,
                                initialIndex: i,
                                showLikesOnSwipeUp: true,
                              ),
                            )),
                        onLongPress: () => _showLikes(e),
                        child: Card(
                          clipBehavior: Clip.antiAlias,
                          child: Stack(children: [
                            Positioned.fill(
                              child: e.mediaType == 'image'
                                  ? CachedNetworkImage(
                                      imageUrl:
                                          ApiService.estadoMediaUrl(e.filename),
                                      httpHeaders: ApiService.imageHeaders,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) => Container(
                                          color: Colors.grey.shade200,
                                          child: const Icon(
                                              Icons.image_not_supported,
                                              color: Colors.grey,
                                              size: 48)),
                                    )
                                  : Container(
                                      color: Colors.black87,
                                      child: const Icon(Icons.videocam,
                                          color: Colors.white, size: 48)),
                            ),
                            Positioned.fill(
                                child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withValues(alpha: 0.6)
                                  ],
                                ),
                              ),
                            )),
                            Positioned(
                                left: 8,
                                right: 8,
                                bottom: 8,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (e.caption != null)
                                      Text(e.caption!,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500)),
                                    if (e.productName != null)
                                      Row(children: [
                                        Icon(Icons.shopping_bag_outlined,
                                            color: scheme.secondary, size: 12),
                                        const SizedBox(width: 3),
                                        Expanded(
                                            child: Text(e.productName!,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    color: scheme.secondary,
                                                    fontSize: 11))),
                                      ]),
                                    const SizedBox(height: 2),
                                    Row(children: [
                                      const Icon(Icons.favorite,
                                          color: Colors.red, size: 12),
                                      const SizedBox(width: 3),
                                      Text('${e.heartCount}',
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 10)),
                                      const SizedBox(width: 8),
                                      Text(_timeLeft(e),
                                          style: TextStyle(
                                              color: Colors.white
                                                  .withValues(alpha: 0.8),
                                              fontSize: 10)),
                                    ]),
                                  ],
                                )),
                            if (e.isPromo)
                              Positioned(
                                  top: 8,
                                  left: 8,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.red.shade600,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(e.promoLabel,
                                        style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800)),
                                  )),
                            Positioned(
                                top: 4,
                                right: 4,
                                child: GestureDetector(
                                  onTap: () => _delete(e),
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: const BoxDecoration(
                                        color: Colors.black54,
                                        shape: BoxShape.circle),
                                    child: const Icon(Icons.close,
                                        color: Colors.white, size: 16),
                                  ),
                                )),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
      if (_uploading)
        Positioned.fill(
            child: ColoredBox(
          color: Colors.black26,
          child:
              Center(child: CircularProgressIndicator(color: scheme.primary)),
        )),
      Positioned(
        bottom: 20,
        right: 16,
        child: FloatingActionButton.extended(
          onPressed: _uploading ? null : _openCreateFlow,
          backgroundColor: scheme.primary,
          icon: const Icon(Icons.add_photo_alternate_rounded,
              color: Colors.white),
          label: const Text('Nueva promoción',
              style:
                  TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ),
      ),
    ]);
  }
}

// ── Likes dialog ───────────────────────────────────────────────
class _LikesDialog extends StatefulWidget {
  final int estadoId;
  final int heartCount;
  const _LikesDialog({required this.estadoId, required this.heartCount});
  @override
  State<_LikesDialog> createState() => _LikesDialogState();
}

class _LikesDialogState extends State<_LikesDialog> {
  List<Map<String, dynamic>> _reactions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await ApiService.getEstadoReactions(widget.estadoId);
      if (mounted)
        setState(() {
          _reactions = r;
          _loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      title: Row(children: [
        const Icon(Icons.favorite, color: Colors.red, size: 20),
        const SizedBox(width: 8),
        Text('${widget.heartCount} me gusta'),
      ]),
      content: SizedBox(
        width: 280,
        child: _loading
            ? Center(
                child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: CircularProgressIndicator(color: scheme.primary)))
            : _reactions.isEmpty
                ? const Text('Nadie ha reaccionado aún.',
                    style: TextStyle(color: Colors.grey))
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: _reactions.map((r) {
                      final name = r['display_name'] as String? ??
                          r['username'] as String? ??
                          '?';
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor:
                                scheme.primary.withValues(alpha: 0.12),
                            child: Text(name[0].toUpperCase(),
                                style: TextStyle(
                                    color: scheme.primary,
                                    fontWeight: FontWeight.bold)),
                          ),
                          const SizedBox(width: 10),
                          Text(name, style: const TextStyle(fontSize: 14)),
                          const Spacer(),
                          const Icon(Icons.favorite,
                              color: Colors.red, size: 14),
                        ]),
                      );
                    }).toList(),
                  ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cerrar')),
      ],
    );
  }
}

// ── Selector de promoción en estilo acordeón ────────────────────
class _PromoOption extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Widget? expanded;
  const _PromoOption(
      {required this.label,
      required this.selected,
      required this.onTap,
      this.expanded});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: selected
            ? scheme.primary.withValues(alpha: 0.08)
            : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: selected
                ? scheme.primary.withValues(alpha: 0.5)
                : Colors.grey.shade200),
      ),
      child: Column(children: [
        InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(children: [
              Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  size: 18,
                  color: selected ? scheme.primary : Colors.grey.shade400),
              const SizedBox(width: 10),
              Text(label,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: selected ? scheme.primary : Colors.black87)),
            ]),
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          child: (selected && expanded != null)
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: expanded)
              : const SizedBox(width: double.infinity),
        ),
      ]),
    );
  }
}
