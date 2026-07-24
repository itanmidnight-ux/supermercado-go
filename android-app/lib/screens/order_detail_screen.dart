import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/order.dart';
import '../widgets/app_button.dart';
import 'chat_screen.dart';

const Map<String, String> _payLabels = {
  'nequi': 'Nequi',
  'visa': 'Tarjeta Visa',
  'contra_entrega': 'Contra entrega',
};

/// Página completa del pedido (no ventana emergente, a pedido explícito):
/// listado de productos, total, método de pago + estado de cobro, botón
/// de navegación (Maps/Waze) según cómo el cliente compartió su ubicación,
/// y el botón "Aceptar pedido" -- reclama el pedido en exclusiva (el
/// servidor rechaza si otro trabajador ya lo tomó) sin avisar al cliente
/// que el trabajador todavía tiene que recogerlo en el punto principal.
/// Teléfono/WhatsApp del cliente solo aparecen una vez el pedido fue
/// aceptado por alguien -- antes de eso quedan ocultos.
class OrderDetailScreen extends StatefulWidget {
  final Order order;
  final Future<void> Function() onAccept;
  final Future<void> Function() onEnCamino;
  final Future<void> Function() onDeliver;
  final Future<void> Function(String reason)? onCancel;
  const OrderDetailScreen({
    super.key,
    required this.order,
    required this.onAccept,
    required this.onEnCamino,
    required this.onDeliver,
    this.onCancel,
  });

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  bool _busy = false;

  String _fmt(num v) => NumberFormat('#,###', 'es_CO').format(v);

  double get _total {
    final items = widget.order.items;
    if (items.isNotEmpty) {
      return items.fold<double>(0, (s, it) {
        final price = (it['product_price'] as num?)?.toDouble() ?? 0;
        final qty = (it['quantity'] as num?)?.toInt() ?? 1;
        return s + price * qty;
      });
    }
    return widget.order.productPrice ?? 0;
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) Navigator.of(context).maybePop();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openMaps() async {
    final o = widget.order;
    final uri = (o.deliveryMode == 'gps' &&
            o.deliveryLat != null &&
            o.deliveryLng != null)
        ? Uri.parse(
            'https://www.google.com/maps/search/?api=1&query=${o.deliveryLat},${o.deliveryLng}')
        : Uri.parse(
            'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(o.deliveryAddress)}');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openWaze() async {
    final o = widget.order;
    if (o.deliveryLat == null || o.deliveryLng == null) return;
    final uri = Uri.parse(
        'https://waze.com/ul?ll=${o.deliveryLat},${o.deliveryLng}&navigate=yes');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _openChat() {
    final phone = widget.order.customerPhone;
    if (phone == null) return;
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => ChatScreen(
                phone: phone, name: widget.order.customerName ?? phone)));
  }

  Future<void> _callClient() async {
    final phone = widget.order.customerPhone;
    if (phone == null) return;
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    await launchUrl(Uri(scheme: 'tel', path: '+$digits'));
  }

  Future<void> _showCancelDialog() async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancelar pedido'),
        content: TextField(
            controller: ctrl,
            decoration:
                const InputDecoration(hintText: 'Motivo de cancelación...')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Volver')),
          FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () => Navigator.pop(context, ctrl.text.trim()),
              child: const Text('Cancelar pedido')),
        ],
      ),
    );
    if (reason != null && reason.isNotEmpty) {
      await _run(() => widget.onCancel!(reason));
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final scheme = Theme.of(context).colorScheme;
    final date = DateTime.tryParse(o.requestedAt)?.toLocal();
    final dateStr =
        date != null ? DateFormat('dd/MM/yyyy HH:mm').format(date) : 'N/A';
    final unclaimed = !o.isClaimed;
    final gps = o.deliveryMode == 'gps';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F0),
      appBar: AppBar(
        title: Text('Pedido #${o.id}'),
        actions: [
          if (widget.onCancel != null)
            IconButton(
                icon: const Icon(Icons.cancel_outlined),
                tooltip: 'Cancelar pedido',
                onPressed: _showCancelDialog),
        ],
      ),
      body: Column(children: [
        // Botón superior "Aceptar pedido" -- solo si nadie lo ha tomado.
        if (unclaimed)
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: AppButton(
              label: 'Aceptar pedido',
              icon: Icons.check_circle_outline_rounded,
              loading: _busy,
              onPressed: _busy ? null : () => _run(widget.onAccept),
            ),
          )
        else
          Container(
            width: double.infinity,
            color: scheme.primary.withValues(alpha: 0.08),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(children: [
              Icon(Icons.verified_rounded, color: scheme.primary, size: 18),
              const SizedBox(width: 8),
              Expanded(
                  child: Text(o.statusLabel,
                      style: TextStyle(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13))),
            ]),
          ),

        Expanded(
            child: ListView(padding: const EdgeInsets.all(16), children: [
          _section('Cliente', Icons.person_outline_rounded, [
            Text(o.customerName ?? o.customerPhone ?? 'N/A',
                style:
                    const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 10),
            // Teléfono/WhatsApp solo visibles una vez alguien aceptó el pedido.
            if (o.isClaimed && o.customerPhone != null)
              Row(children: [
                Expanded(
                    child: OutlinedButton.icon(
                  onPressed: _openChat,
                  icon: const Icon(Icons.chat_bubble_outline_rounded,
                      size: 16, color: Color(0xFF25D366)),
                  label: const Text('WhatsApp',
                      style: TextStyle(color: Color(0xFF25D366))),
                  style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF25D366))),
                )),
                const SizedBox(width: 10),
                Expanded(
                    child: OutlinedButton.icon(
                  onPressed: _callClient,
                  icon: const Icon(Icons.call_rounded,
                      size: 16, color: Colors.blue),
                  label: const Text('Llamar',
                      style: TextStyle(color: Colors.blue)),
                  style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.blue)),
                )),
              ])
            else
              Text(
                  'El número y el chat se habilitan cuando alguien acepte el pedido',
                  style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                      fontStyle: FontStyle.italic)),
          ]),
          _section('Productos', Icons.shopping_basket_outlined, [
            if (o.items.isNotEmpty)
              ...o.items.map((it) {
                final qty = (it['quantity'] as num?)?.toInt() ?? 1;
                final price = (it['product_price'] as num?)?.toDouble() ?? 0;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(children: [
                    Container(
                      width: 26,
                      height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                          color: scheme.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8)),
                      child: Text('${qty}x',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: scheme.primary)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text(it['product_name'] as String? ?? '',
                            style: const TextStyle(fontSize: 13.5))),
                    Text('\$${_fmt(price * qty)}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 13)),
                  ]),
                );
              })
            else
              Text(o.productName, style: const TextStyle(fontSize: 13.5)),
            const Divider(height: 20),
            Row(children: [
              const Text('Total',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              const Spacer(),
              Text('\$${_fmt(_total)}',
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: scheme.primary)),
            ]),
          ]),
          _section('Pago', Icons.payments_outlined, [
            Row(children: [
              Expanded(
                  child: Text(
                      _payLabels[o.paymentMethod] ??
                          (o.isFiado ? 'Fiado' : 'Sin especificar'),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14))),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: o.paid
                        ? Colors.green.withValues(alpha: 0.12)
                        : Colors.orange.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10)),
                child: Text(o.paid ? 'PAGADO' : 'COBRAR AL ENTREGAR',
                    style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                        color: o.paid
                            ? Colors.green.shade700
                            : Colors.orange.shade800)),
              ),
            ]),
          ]),
          _section('Entrega', Icons.location_on_outlined, [
            Text(
                gps ? 'Ubicación en tiempo real compartida' : o.deliveryAddress,
                style: const TextStyle(fontSize: 13.5)),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: FilledButton.icon(
                onPressed: _openMaps,
                icon: const Icon(Icons.map_rounded, size: 18),
                label: const Text('Google Maps'),
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1A73E8)),
              )),
              if (gps) ...[
                const SizedBox(width: 10),
                Expanded(
                    child: FilledButton.icon(
                  onPressed: _openWaze,
                  icon: const Icon(Icons.navigation_rounded, size: 18),
                  label: const Text('Waze'),
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF33CCFF)),
                )),
              ],
            ]),
          ]),
          _section('Detalle', Icons.info_outline_rounded, [
            _row('Solicitado', dateStr),
            if (o.comment != null) _row('Comentario', o.comment!),
          ]),
          const SizedBox(height: 100),
        ])),
      ]),
      bottomNavigationBar: o.isClaimed &&
              o.status != 'entregado' &&
              o.status != 'delivered'
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: o.status == 'claimed'
                    ? AppButton(
                        label: 'Marcar en camino',
                        icon: Icons.directions_bike_rounded,
                        loading: _busy,
                        onPressed: _busy ? null : () => _run(widget.onEnCamino))
                    : AppButton(
                        label: 'Marcar entregado',
                        icon: Icons.check_circle_rounded,
                        loading: _busy,
                        onPressed: _busy ? null : () => _run(widget.onDeliver)),
              ),
            )
          : null,
    );
  }

  Widget _section(String title, IconData icon, List<Widget> children) =>
      Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: Colors.white, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 16, color: Colors.grey.shade600),
            const SizedBox(width: 6),
            Text(title.toUpperCase(),
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Colors.grey.shade600,
                    letterSpacing: 0.5)),
          ]),
          const SizedBox(height: 10),
          ...children,
        ]),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
              width: 90,
              child: Text(label,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ]),
      );
}
