import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;
import '../models/order.dart';
import '../services/api_service.dart';
import '../widgets/empty_state.dart';

/// Rastrear mi pedido: muestra la ubicación en tiempo real del trabajador
/// SOLO cuando el pedido ya está en camino (el servidor jamás la envía
/// antes -- ver GET /api/orders/:id/track). Antes de eso se muestra el
/// mensaje de espera pedido: "tu pedido aún no ha sido enviado...".
class ClientTrackOrderScreen extends StatefulWidget {
  const ClientTrackOrderScreen({super.key});
  @override
  State<ClientTrackOrderScreen> createState() => _ClientTrackOrderScreenState();
}

class _ClientTrackOrderScreenState extends State<ClientTrackOrderScreen> {
  bool _loading = true;
  List<Order> _activeOrders = [];
  Order? _selected;
  Map<String, dynamic>? _tracking;
  Timer? _timer;

  static const _activeStatuses = {'pending', 'claimed', 'en_camino'};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final orders = await ApiService.getMyOrders();
      final active = orders
          .where((o) => _activeStatuses.contains(o.status))
          .toList()
        ..sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
      if (mounted) {
        setState(() {
          _activeOrders = active;
          _selected = active.isNotEmpty ? active.first : null;
        });
        if (_selected != null) _startTracking();
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _selectOrder(Order o) {
    setState(() {
      _selected = o;
      _tracking = null;
    });
    _startTracking();
  }

  void _startTracking() {
    _timer?.cancel();
    _pollOnce();
    _timer = Timer.periodic(const Duration(seconds: 8), (_) => _pollOnce());
  }

  Future<void> _pollOnce() async {
    final order = _selected;
    if (order?.id == null) return;
    try {
      final data = await ApiService.trackOrder(order!.id!);
      if (mounted) setState(() => _tracking = data);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (_loading)
      return Center(child: CircularProgressIndicator(color: scheme.primary));

    if (_activeOrders.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        color: scheme.primary,
        child: ListView(children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.7,
            child: const EmptyState(
              icon: Icons.local_shipping_outlined,
              title: 'No tienes pedidos activos',
              subtitle:
                  'Aquí podrás rastrear tu pedido en tiempo real una vez lo hagas',
            ),
          ),
        ]),
      );
    }

    return Column(children: [
      if (_activeOrders.length > 1) _buildOrderSelector(scheme),
      Expanded(child: _buildTrackingBody(scheme)),
    ]);
  }

  Widget _buildOrderSelector(ColorScheme scheme) => Container(
        color: Colors.white,
        height: 56,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: _activeOrders.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (_, i) {
            final o = _activeOrders[i];
            final sel = o.id == _selected?.id;
            return GestureDetector(
              onTap: () => _selectOrder(o),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: sel ? scheme.primary : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('Pedido #${o.id}',
                    style: TextStyle(
                        color: sel ? Colors.white : Colors.grey.shade700,
                        fontWeight: FontWeight.w700,
                        fontSize: 12)),
              ),
            );
          },
        ),
      );

  Widget _buildTrackingBody(ColorScheme scheme) {
    final tracking = _tracking;
    final available = tracking?['tracking_available'] == true;

    if (!available) {
      final message = tracking?['message'] as String? ??
          'Tu pedido aún no ha sido enviado, agradecemos tu espera. En pocos minutos tu pedido será enviado.';
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeOutCubic,
            builder: (_, v, child) => Opacity(
                opacity: v,
                child: Transform.scale(scale: 0.9 + v * 0.1, child: child)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle),
                child: Icon(Icons.local_shipping_rounded,
                    color: scheme.primary, size: 46),
              ),
              const SizedBox(height: 20),
              Text('Pedido #${_selected?.id}',
                  style: const TextStyle(
                      fontSize: 13,
                      color: Colors.black45,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Text(message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 15,
                      color: Color(0xFF1A1A1A),
                      fontWeight: FontWeight.w600,
                      height: 1.5)),
            ]),
          ),
        ),
      );
    }

    final lat = (tracking!['lat'] as num).toDouble();
    final lng = (tracking['lng'] as num).toDouble();
    final workerName = tracking['worker_name'] as String? ?? 'Trabajador';
    final point = ll.LatLng(lat, lng);

    return Stack(children: [
      FlutterMap(
        options: MapOptions(initialCenter: point, initialZoom: 15),
        children: [
          TileLayer(
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            userAgentPackageName: 'com.supermercadogo.pedidos_app',
          ),
          MarkerLayer(markers: [
            Marker(
              point: point,
              width: 50,
              height: 50,
              child: Container(
                decoration: BoxDecoration(
                  color: scheme.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.3),
                        blurRadius: 8)
                  ],
                ),
                child: const Icon(Icons.moped_rounded,
                    color: Colors.white, size: 24),
              ),
            ),
          ]),
          RichAttributionWidget(attributions: [
            TextSourceAttribution('OpenStreetMap', onTap: () {}),
          ]),
        ],
      ),
      Positioned(
        top: 12,
        left: 12,
        right: 12,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 14,
                  offset: const Offset(0, 4))
            ],
          ),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.12),
                  shape: BoxShape.circle),
              child: Icon(Icons.moped_rounded, color: scheme.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(workerName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 14)),
                  const Text('Tu pedido va en camino',
                      style: TextStyle(fontSize: 11, color: Colors.black54)),
                ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                  color: Colors.green.shade600,
                  borderRadius: BorderRadius.circular(10)),
              child: const Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.circle, color: Colors.white, size: 7),
                SizedBox(width: 4),
                Text('En vivo',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w700)),
              ]),
            ),
          ]),
        ),
      ),
    ]);
  }
}
