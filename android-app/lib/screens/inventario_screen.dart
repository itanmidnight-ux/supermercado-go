import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/product.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../widgets/empty_state.dart';
import '../widgets/futuristic_modal.dart';

/// Inventario real: listado de todos los productos agrupados por categoría
/// ("cajones"), con imagen y nombre, buscador, y al tocar uno se abre una
/// ventana emergente con cantidad/precio editables. El botón eliminar solo
/// se habilita cuando la cantidad en existencia es 0 (seguridad -- evita
/// borrar productos con stock real por error).
class InventarioScreen extends StatefulWidget {
  const InventarioScreen({super.key});
  @override
  State<InventarioScreen> createState() => _InventarioScreenState();
}

class _InventarioScreenState extends State<InventarioScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(
        () => setState(() => _query = _searchCtrl.text.trim().toLowerCase()));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final provider = context.watch<AppProvider>();
    final all = provider.products;

    final filtered = _query.isEmpty
        ? all
        : all.where((p) => p.name.toLowerCase().contains(_query)).toList();

    final groups = <String, List<Product>>{};
    for (final p in filtered) {
      final key = (p.category == null || p.category!.trim().isEmpty)
          ? 'Sin categoría'
          : p.category!;
      groups.putIfAbsent(key, () => []).add(p);
    }
    final sortedKeys = groups.keys.toList()..sort();

    return Column(children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
        child: TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            hintText: 'Buscar producto en el inventario...',
            prefixIcon: Icon(Icons.search_rounded, color: scheme.primary),
            suffixIcon: _query.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => _searchCtrl.clear())
                : null,
            filled: true,
            fillColor: const Color(0xFFF5F5F5),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none),
          ),
        ),
      ),
      Expanded(
        child: all.isEmpty
            ? const EmptyState(
                icon: Icons.inventory_2_rounded,
                title: 'Sin productos en el inventario')
            : filtered.isEmpty
                ? EmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'Sin resultados para "$_query"')
                : RefreshIndicator(
                    onRefresh: provider.refreshProducts,
                    color: scheme.primary,
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                      itemCount: sortedKeys.length,
                      itemBuilder: (_, gi) {
                        final key = sortedKeys[gi];
                        final items = groups[key]!;
                        return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.fromLTRB(6, 14, 6, 8),
                                child: Row(children: [
                                  Icon(Icons.inventory_rounded,
                                      size: 16, color: scheme.primary),
                                  const SizedBox(width: 6),
                                  Text(key.toUpperCase(),
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: scheme.primary,
                                          letterSpacing: 0.5)),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 7, vertical: 2),
                                    decoration: BoxDecoration(
                                        color: Colors.grey.shade100,
                                        borderRadius: BorderRadius.circular(8)),
                                    child: Text('${items.length}',
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: Colors.grey.shade600)),
                                  ),
                                ]),
                              ),
                              ...items.map((p) => _InventoryTile(
                                  product: p,
                                  onTap: () => _openDetail(context, p))),
                            ]);
                      },
                    ),
                  ),
      ),
    ]);
  }

  Future<void> _openDetail(BuildContext context, Product p) async {
    await showFuturisticModal(context,
        builder: (_) => _InventoryDetailModal(product: p));
  }
}

class _InventoryTile extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;
  const _InventoryTile({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final stock = product.stock;
    final lowStock = stock != null && stock <= 3;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 54,
                  height: 54,
                  child: product.images.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl:
                              ApiService.productImageUrl(product.images.first),
                          httpHeaders: ApiService.imageHeaders,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => Container(
                              color: scheme.primary.withValues(alpha: 0.1),
                              child: Icon(Icons.inventory_2_outlined,
                                  color: scheme.primary)),
                        )
                      : Container(
                          color: scheme.primary.withValues(alpha: 0.1),
                          child: Icon(Icons.inventory_2_outlined,
                              color: scheme.primary)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 13.5)),
                    const SizedBox(height: 3),
                    Text(
                        '\$${NumberFormat('#,###', 'es_CO').format(product.price)}',
                        style: TextStyle(
                            color: scheme.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 12.5)),
                  ])),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: stock == null
                      ? Colors.grey.shade100
                      : (stock == 0
                          ? Colors.red.shade50
                          : lowStock
                              ? Colors.orange.shade50
                              : Colors.green.shade50),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  stock == null ? 'Sin dato' : '$stock uds',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: stock == null
                        ? Colors.grey.shade600
                        : (stock == 0
                            ? Colors.red.shade700
                            : lowStock
                                ? Colors.orange.shade800
                                : Colors.green.shade700),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _InventoryDetailModal extends StatefulWidget {
  final Product product;
  const _InventoryDetailModal({required this.product});
  @override
  State<_InventoryDetailModal> createState() => _InventoryDetailModalState();
}

class _InventoryDetailModalState extends State<_InventoryDetailModal> {
  late final _priceCtrl =
      TextEditingController(text: widget.product.price.toStringAsFixed(0));
  late final _stockCtrl =
      TextEditingController(text: (widget.product.stock ?? 0).toString());
  bool _saving = false;
  bool _deleting = false;
  String? _error;

  @override
  void dispose() {
    _priceCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  int get _currentStock => int.tryParse(_stockCtrl.text.trim()) ?? -1;

  Future<void> _save() async {
    final price = double.tryParse(_priceCtrl.text.trim());
    final stock = int.tryParse(_stockCtrl.text.trim());
    if (price == null || price < 0) {
      setState(() => _error = 'Precio inválido');
      return;
    }
    if (stock == null || stock < 0) {
      setState(() => _error = 'Cantidad inválida');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context
          .read<AppProvider>()
          .updateProduct(widget.product.id!, {'price': price, 'stock': stock});
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Inventario actualizado'),
            behavior: SnackBarBehavior.floating));
      }
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _saving = false;
        });
    }
  }

  Future<void> _delete() async {
    final ok = await showFuturisticConfirm(context,
        title: 'Eliminar del inventario',
        message:
            '¿Eliminar "${widget.product.name}" permanentemente? Ya no tiene existencias.',
        icon: Icons.delete_outline_rounded,
        iconColor: Colors.red,
        confirmLabel: 'Eliminar',
        confirmColor: Colors.red);
    if (ok != true) return;
    setState(() => _deleting = true);
    try {
      await context.read<AppProvider>().deleteProduct(widget.product.id!);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _deleting = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final p = widget.product;
    final canDelete = _currentStock == 0;

    return FuturisticModalCard(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const ModalCloseButton(),
            Center(
                child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: SizedBox(
                width: 96,
                height: 96,
                child: p.images.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: ApiService.productImageUrl(p.images.first),
                        httpHeaders: ApiService.imageHeaders,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => Container(
                            color: scheme.primary.withValues(alpha: 0.1),
                            child: Icon(Icons.inventory_2_outlined,
                                color: scheme.primary, size: 36)),
                      )
                    : Container(
                        color: scheme.primary.withValues(alpha: 0.1),
                        child: Icon(Icons.inventory_2_outlined,
                            color: scheme.primary, size: 36)),
              ),
            )),
            const SizedBox(height: 12),
            Text(p.name,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1A1A))),
            if (p.category != null)
              Text(p.category!,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(
                  child: TextField(
                controller: _priceCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                    labelText: 'Precio',
                    prefixText: '\$',
                    filled: true,
                    fillColor: const Color(0xFFF8FAF8),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200))),
              )),
              const SizedBox(width: 12),
              Expanded(
                  child: TextField(
                controller: _stockCtrl,
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                    labelText: 'Cantidad',
                    suffixText: 'uds',
                    filled: true,
                    fillColor: const Color(0xFFF8FAF8),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200))),
              )),
            ]),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(_error!,
                    style: const TextStyle(
                        color: Color(0xFFD32F2F), fontSize: 12)),
              ),
            const SizedBox(height: 16),
            SizedBox(
                height: 48,
                child: FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.save_rounded),
                  label: const Text('Guardar cambios'),
                  style: FilledButton.styleFrom(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14))),
                )),
            const SizedBox(height: 10),
            SizedBox(
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: (!canDelete || _deleting) ? null : _delete,
                  icon: _deleting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.delete_outline_rounded),
                  label: Text(canDelete
                      ? 'Eliminar del inventario'
                      : 'Eliminar (requiere cantidad = 0)'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: BorderSide(
                        color: canDelete ? Colors.red : Colors.grey.shade300),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                )),
          ]),
    );
  }
}
