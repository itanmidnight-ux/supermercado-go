import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class RouteScreen extends StatefulWidget {
  const RouteScreen({super.key});

  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  List<Order> _orders = [];
  bool _isLoading = true;
  String? _error;
  int? _activeOrderId;
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(
        ApiEndpoints.workerOrders,
        queryParams: {'status': 'assigned,in_transit'},
      );
      final raw = response['data'] ?? response['orders'] ?? response;
      final list = raw is List ? raw : [raw];
      final orders = list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      orders.sort((a, b) {
        final dateA = a.createdAt ?? '';
        final dateB = b.createdAt ?? '';
        return dateA.compareTo(dateB);
      });
      final active = orders.where((o) => o.status == 'in_transit').map((o) => o.id).toList();
      setState(() {
        _orders = orders;
        _activeOrderId = active.isNotEmpty ? active.first : null;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar las rutas';
        _isLoading = false;
      });
    }
  }

  Future<void> _startDelivery(Order order) async {
    try {
      await apiService.post(ApiEndpoints.workerStartDelivery(order.id.toString()), {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Entrega iniciada'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pushNamed(context, '/worker/delivery-proof', arguments: {'order_id': order.id});
        _loadOrders();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al iniciar entrega'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  List<Marker> _buildMarkers() {
    final markers = <Marker>[];
    for (int i = 0; i < _orders.length; i++) {
      final order = _orders[i];
      if (order.deliveryLat != null && order.deliveryLng != null) {
        final isActive = order.id == _activeOrderId;
        markers.add(
          Marker(
            point: LatLng(order.deliveryLat!, order.deliveryLng!),
            width: isActive ? 44 : 36,
            height: isActive ? 44 : 36,
            child: GestureDetector(
              onTap: () => _mapController.move(
                LatLng(order.deliveryLat!, order.deliveryLng!),
                15,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: isActive ? AppColors.accent : AppColors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    '${i + 1}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }
    }
    return markers;
  }

  LatLng _getMapCenter() {
    final withCoords = _orders.where((o) => o.deliveryLat != null && o.deliveryLng != null);
    if (withCoords.isEmpty) return const LatLng(7.8939, -72.5058);
    final avgLat = withCoords.map((o) => o.deliveryLat!).reduce((a, b) => a + b) / withCoords.length;
    final avgLng = withCoords.map((o) => o.deliveryLng!).reduce((a, b) => a + b) / withCoords.length;
    return LatLng(avgLat, avgLng);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mi ruta de entregas'),
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
                        onPressed: _loadOrders,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _orders.isEmpty
                  ? RefreshIndicator(
                      onRefresh: _loadOrders,
                      child: CustomScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverFillRemaining(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.route, size: 64, color: AppColors.gray),
                                const SizedBox(height: 16),
                                const Text(
                                  'Sin entregas pendientes',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 8),
                                const Text(
                                  'No tienes entregas asignadas en este momento',
                                  style: TextStyle(color: AppColors.textSecondary),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadOrders,
                      child: Column(
                        children: [
                          SizedBox(
                            height: 200,
                            child: FlutterMap(
                              mapController: _mapController,
                              options: MapOptions(
                                initialCenter: _getMapCenter(),
                                initialZoom: 13,
                                minZoom: 10,
                                maxZoom: 18,
                              ),
                              children: [
                                TileLayer(
                                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                  userAgentPackageName: 'com.supermercadosgo.app',
                                ),
                                MarkerLayer(markers: _buildMarkers()),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: Row(
                              children: [
                                const Icon(Icons.local_shipping, color: AppColors.primary, size: 20),
                                const SizedBox(width: 6),
                                Text(
                                  '${_orders.length} entrega${_orders.length > 1 ? "s" : ""} asignada${_orders.length > 1 ? "s" : ""}',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                                ),
                                if (_activeOrderId != null) ...[
                                  const Spacer(),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.accent.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      'Entrega en curso',
                                      style: TextStyle(color: AppColors.accent, fontSize: 12, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Expanded(
                            child: ListView.separated(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              itemCount: _orders.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) => _buildOrderCard(_orders[index], index + 1),
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildOrderCard(Order order, int number) {
    final isActive = order.id == _activeOrderId;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: isActive ? 2 : 0,
      margin: const EdgeInsets.only(bottom: 4),
      color: isActive ? AppColors.primary.withOpacity(0.05) : AppColors.surface,
      borderOnForeground: isActive,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isActive ? AppColors.accent : AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  '$number',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            const SizedBox(width: 12),
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
                      const SizedBox(width: 8),
                      Text(
                        formatCOP(order.total),
                        style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primary, fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    order.clientName ?? 'Cliente',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.location_on, size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          order.deliveryAddress ?? 'Sin dirección',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (!isActive)
              ElevatedButton(
                onPressed: () => _startDelivery(order),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                child: const Text('Iniciar'),
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'En camino',
                  style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
