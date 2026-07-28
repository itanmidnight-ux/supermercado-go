import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/stat_tile.dart';
import '../widgets/app_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/futuristic_modal.dart';

const Map<String, String> _statusLabels = {
  'pending': 'Pendiente',
  'claimed': 'Reclamado',
  'en_camino': 'En camino',
  'entregado': 'Entregado',
  'delivered': 'Entregado',
  'cancelled': 'Cancelado',
};
// Antes duplicaba los mismos hex de AppTheme.warning/info/success/errorColor
// como literales sueltos -- si esas constantes cambian algún día, este mapa
// quedaba desincronizado en silencio.
const Map<String, Color> _statusColors = {
  'pending': AppTheme.warningColor,
  'claimed': AppTheme.infoColor,
  'en_camino': Color(0xFF2D5016),
  'entregado': AppTheme.successColor,
  'delivered': AppTheme.successColor,
  'cancelled': AppTheme.errorColor,
};

class AdminAnalyticsScreen extends StatefulWidget {
  const AdminAnalyticsScreen({super.key});
  @override
  State<AdminAnalyticsScreen> createState() => _AdminAnalyticsScreenState();
}

// Separador de miles (es-CO usa punto: 306.000) -- antes los numeros
// grandes se mostraban pegados ("306000"), dificiles de leer de un vistazo.
String _fmtN(dynamic n) => NumberFormat.decimalPattern('es_CO')
    .format(n is num ? n : num.tryParse('$n') ?? 0);

class _AdminAnalyticsScreenState extends State<AdminAnalyticsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  Map<String, dynamic>? _summary;
  Map<String, dynamic>? _products;
  Map<String, dynamic>? _employees;
  Map<String, dynamic>? _customers;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.getAnalyticsSummary(),
        ApiService.getAnalyticsProducts(),
        ApiService.getAnalyticsEmployees(),
        ApiService.getAnalyticsCustomers(),
      ]);
      if (mounted) {
        setState(() {
          _summary = results[0];
          _products = results[1];
          _employees = results[2];
          _customers = results[3];
        });
      }
    } catch (_) {
      // Pantalla se queda con los datos previos (o vacíos) si falla la carga
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Analíticas'),
        // Material 3 sin esto usa colorScheme.primary para el tab seleccionado
        // -- el mismo verde del fondo del AppBar, texto invisible sobre su
        // propio fondo. Un TabBar dentro de un AppBar de color necesita sus
        // colores explícitos en blanco, M3 no lo asume solo.
        bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            tabs: const [
              Tab(text: 'Resumen'),
              Tab(text: 'Productos'),
              Tab(text: 'Empleados'),
              Tab(text: 'Clientes'),
            ]),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: TabBarView(controller: _tabController, children: [
                _buildSummaryTab(),
                _buildProductsTab(),
                _buildEmployeesTab(),
                _buildCustomersTab(),
              ]),
            ),
    );
  }

  Widget _buildSummaryTab() {
    final s = _summary;
    if (s == null)
      return const EmptyState(
          icon: Icons.bar_chart_rounded, title: 'Sin datos todavía');
    final statusBreakdown =
        (s['status_breakdown'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final dailySales =
        (s['daily_sales'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    return ListView(padding: const EdgeInsets.all(16), children: [
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.5,
        children: [
          StatTile(
              label: 'Ventas hoy',
              value: '\$${_fmtN(s['sales_today'])}',
              icon: Icons.attach_money_rounded),
          StatTile(
              label: 'Pedidos activos',
              value: _fmtN(s['active_orders']),
              icon: Icons.pending_actions_rounded),
          StatTile(
              label: 'Cancelados',
              value: '${s['cancelled_pct']}%',
              icon: Icons.cancel_outlined),
          StatTile(
              label: 'Entregados (total)',
              value: _fmtN(s['delivered_total']),
              icon: Icons.local_shipping_outlined),
        ],
      ),
      const SizedBox(height: 20),
      Text('Ingresos por día — últimos 7 días',
          style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      AppCard(child: _DailySalesNumericList(data: dailySales)),
      const SizedBox(height: 20),
      Text('Distribución de pedidos',
          style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      AppCard(child: _StatusNumericList(data: statusBreakdown)),
    ]);
  }

  Widget _buildProductsTab() {
    final p = _products;
    if (p == null)
      return const EmptyState(
          icon: Icons.inventory_2_rounded, title: 'Sin datos todavía');
    final top = (p['top_products'] as List? ?? []).cast<Map<String, dynamic>>();
    final attention = (p['needs_attention'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((a) => !_dismissedAttention.contains(a['id']))
        .toList();
    return ListView(padding: const EdgeInsets.all(16), children: [
      if (attention.isNotEmpty) ...[
        Text('Requieren atención',
            style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        ...attention.map((item) {
          final isLowStock = item['reason'] == 'low_stock';
          return GestureDetector(
            onTap: () => _showAttentionModal(item),
            child: AppCard(
                child: Row(children: [
              Icon(
                  isLowStock
                      ? Icons.inventory_2_rounded
                      : Icons.trending_down_rounded,
                  color:
                      isLowStock ? Colors.red.shade400 : Colors.orange.shade600,
                  size: 20),
              const SizedBox(width: 10),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(item['name'] as String,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(item['detail'] as String,
                        style: TextStyle(
                            fontSize: 12,
                            color: isLowStock
                                ? Colors.red.shade400
                                : Colors.orange.shade700)),
                  ])),
              Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
            ])),
          );
        }),
        const SizedBox(height: 20),
      ],
      Text('Más vendidos', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      if (top.isEmpty)
        const EmptyState(
            icon: Icons.inventory_2_rounded, title: 'Sin ventas registradas'),
      ...top.map((prod) => AppCard(
              child: Row(children: [
            Expanded(child: Text(prod['name'] as String)),
            Text('${_fmtN(prod['total_qty'])} vendidos'),
          ]))),
    ]);
  }

  final Set<dynamic> _dismissedAttention = {};

  Future<void> _showAttentionModal(Map<String, dynamic> item) async {
    final action = await showFuturisticModal<String>(context,
        builder: (_) => FuturisticModalCard(
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const ModalCloseButton(),
                    Icon(
                        item['reason'] == 'low_stock'
                            ? Icons.inventory_2_rounded
                            : Icons.trending_down_rounded,
                        size: 38,
                        color: Theme.of(context).colorScheme.primary),
                    const SizedBox(height: 8),
                    Text(item['name'] as String,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(item['detail'] as String,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey.shade600)),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: () => Navigator.of(context).pop('update'),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Actualizar datos'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).pop('remove'),
                      icon: const Icon(Icons.playlist_remove_rounded),
                      label: const Text('Eliminar de la lista'),
                    ),
                  ]),
            ));
    if (action == 'update') {
      await _load();
    } else if (action == 'remove') {
      setState(() => _dismissedAttention.add(item['id']));
    }
  }

  String _timeAgo(String? iso) {
    if (iso == null) return 'nunca';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '-';
    final diff = DateTime.now().toUtc().difference(dt.toUtc());
    if (diff.inMinutes < 1) return 'ahora mismo';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'hace ${diff.inHours} h';
    return 'hace ${diff.inDays} d';
  }

  Widget _buildEmployeesTab() {
    final e = _employees;
    if (e == null)
      return const EmptyState(
          icon: Icons.engineering_rounded, title: 'Sin datos todavía');
    final list = (e['employees'] as List? ?? []).cast<Map<String, dynamic>>();
    if (list.isEmpty)
      return const EmptyState(
          icon: Icons.engineering_rounded,
          title: 'Sin trabajadores registrados');
    final notLoggedInToday =
        list.where((emp) => emp['logged_in_today'] != 1).length;
    return ListView(padding: const EdgeInsets.all(16), children: [
      if (notLoggedInToday > 0)
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.orange.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.orange.shade200),
          ),
          child: Row(children: [
            Icon(Icons.warning_amber_rounded,
                color: Colors.orange.shade800, size: 20),
            const SizedBox(width: 8),
            Expanded(
                child: Text(
                    '$notLoggedInToday ${notLoggedInToday == 1 ? "persona no ha" : "personas no han"} iniciado sesión hoy',
                    style: TextStyle(
                        color: Colors.orange.shade900,
                        fontSize: 13,
                        fontWeight: FontWeight.w600))),
          ]),
        ),
      ...list.map((emp) {
        final isActive = emp['is_active_now'] == 1;
        final loggedToday = emp['logged_in_today'] == 1;
        return GestureDetector(
          onTap: () => _showEmployeeDetail(emp),
          child: AppCard(
              child: Row(children: [
            Container(
              width: 10,
              height: 10,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isActive
                    ? Colors.green
                    : (loggedToday ? Colors.orange : Colors.grey.shade400),
              ),
            ),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(
                      emp['display_name'] as String? ??
                          emp['username'] as String,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    isActive
                        ? 'En sesión · entró ${_timeAgo(emp['last_login_at'] as String?)}'
                        : !loggedToday
                            ? 'No ha iniciado sesión hoy'
                            : 'Salió ${_timeAgo(emp['last_logout_at'] as String?)}',
                    style: TextStyle(
                        fontSize: 12,
                        color: isActive
                            ? Colors.green.shade700
                            : Colors.grey.shade600),
                  ),
                ])),
            Text('${_fmtN(emp['delivered_count'])} entregas'),
            const SizedBox(width: 12),
            Text('${emp['avg_minutes'] ?? '-'} min prom.'),
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
          ])),
        );
      }),
    ]);
  }

  Future<void> _showEmployeeDetail(Map<String, dynamic> emp) async {
    Map<String, dynamic>? detail;
    try {
      detail = await ApiService.getEmployeeDetail(emp['id'] as int);
    } catch (_) {}
    if (!mounted) return;
    final sessions =
        (detail?['sessions'] as List? ?? []).cast<Map<String, dynamic>>();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, scrollCtrl) => Padding(
          padding: const EdgeInsets.all(20),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(emp['display_name'] as String? ?? emp['username'] as String,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text('@${emp['username']} · ${emp['role']}',
                style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(
                  child: StatTile(
                      label: 'Entregas',
                      value: _fmtN(emp['delivered_count']),
                      icon: Icons.local_shipping_outlined)),
              const SizedBox(width: 10),
              Expanded(
                  child: StatTile(
                      label: 'Tiempo prom.',
                      value: '${emp['avg_minutes'] ?? '-'} min',
                      icon: Icons.timer_outlined)),
            ]),
            const SizedBox(height: 16),
            const Text('Historial de sesiones',
                style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Expanded(
              child: sessions.isEmpty
                  ? const Center(
                      child: Text('Sin sesiones registradas',
                          style: TextStyle(color: Colors.grey)))
                  : ListView.builder(
                      controller: scrollCtrl,
                      itemCount: sessions.length,
                      itemBuilder: (_, i) {
                        final s = sessions[i];
                        final open = s['logged_out_at'] == null;
                        return ListTile(
                          dense: true,
                          leading: Icon(
                              open ? Icons.login_rounded : Icons.logout_rounded,
                              color: open ? Colors.green : Colors.grey),
                          title: Text('Entrada: ${s['logged_in_at']}'),
                          subtitle: Text(open
                              ? 'Sigue en sesión'
                              : 'Salida: ${s['logged_out_at']}'),
                        );
                      },
                    ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildCustomersTab() {
    final c = _customers;
    if (c == null)
      return const EmptyState(
          icon: Icons.people_outline_rounded, title: 'Sin datos todavía');
    final top =
        (c['top_customers'] as List? ?? []).cast<Map<String, dynamic>>();
    return ListView(padding: const EdgeInsets.all(16), children: [
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.8,
        children: [
          StatTile(
              label: 'Clientes nuevos (30d)',
              value: _fmtN(c['new_customers']),
              icon: Icons.person_add_outlined),
          StatTile(
              label: 'Recurrentes',
              value: _fmtN(c['returning_customers']),
              icon: Icons.repeat_rounded),
        ],
      ),
      const SizedBox(height: 20),
      Text('Top clientes', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      if (top.isEmpty)
        const EmptyState(
            icon: Icons.people_outline_rounded,
            title: 'Sin pedidos entregados aún'),
      ...top.map((cust) => GestureDetector(
            onTap: () => _showCustomerDetail(cust),
            child: AppCard(
                child: Row(children: [
              Expanded(
                  child:
                      Text(cust['name'] as String? ?? cust['phone'] as String)),
              Text('${_fmtN(cust['order_count'])} pedidos'),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right_rounded,
                  color: Colors.grey.shade400, size: 18),
            ])),
          )),
    ]);
  }

  Future<void> _showCustomerDetail(Map<String, dynamic> cust) async {
    final scheme = Theme.of(context).colorScheme;
    await showFuturisticModal(context,
        builder: (_) => FuturisticModalCard(
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const ModalCloseButton(),
                    CircleAvatar(
                      radius: 32,
                      backgroundColor: scheme.primary.withValues(alpha: 0.12),
                      child: Text(
                          ((cust['name'] as String?) ?? '?').isNotEmpty
                              ? (cust['name'] as String)[0].toUpperCase()
                              : '?',
                          style: TextStyle(
                              color: scheme.primary,
                              fontSize: 26,
                              fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 12),
                    Center(
                        child: Text(cust['name'] as String? ?? 'Sin nombre',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 17, fontWeight: FontWeight.w800))),
                    const SizedBox(height: 16),
                    _detailRow(Icons.phone_outlined, 'Teléfono',
                        cust['phone'] as String? ?? '—'),
                    _detailRow(Icons.email_outlined, 'Correo',
                        cust['email'] as String? ?? 'Sin cuenta en la app'),
                    _detailRow(Icons.shopping_bag_outlined,
                        'Pedidos entregados', _fmtN(cust['order_count'])),
                    _detailRow(Icons.calendar_today_outlined, 'Cliente desde',
                        _timeAgo(cust['customer_since'] as String?)),
                  ]),
            ));
  }

  Widget _detailRow(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Icon(icon, size: 18, color: Colors.grey.shade500),
          const SizedBox(width: 10),
          Text(label,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          const Spacer(),
          Text(value,
              style:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
        ]),
      );
}

/// Ingresos por día (últimos 7 días) -- dato numérico, sin gráfica.
class _DailySalesNumericList extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _DailySalesNumericList({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty || data.every((d) => (d['total'] as num? ?? 0) == 0)) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(
            child: Text('Sin ingresos esta semana',
                style: TextStyle(color: Colors.grey))),
      );
    }
    final primary = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
          children: data.map((d) {
        final date = DateTime.tryParse(d['date'] as String? ?? '');
        final label = date != null
            ? DateFormat("EEEE d 'de' MMMM", 'es').format(date)
            : (d['date'] as String? ?? '');
        final total = (d['total'] as num? ?? 0).toDouble();
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Icon(Icons.calendar_today_outlined,
                size: 15, color: Colors.grey.shade400),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13))),
            Text('\$${_fmtN(total)}',
                style: TextStyle(
                    fontWeight: FontWeight.w800, color: primary, fontSize: 14)),
          ]),
        );
      }).toList()),
    );
  }
}

/// Distribución de pedidos por estado -- dato numérico, sin gráfica.
class _StatusNumericList extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const _StatusNumericList({required this.data});

  @override
  Widget build(BuildContext context) {
    final entries = data.where((d) => (d['count'] as num? ?? 0) > 0).toList();
    if (entries.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(
            child: Text('Sin pedidos todavía',
                style: TextStyle(color: Colors.grey))),
      );
    }
    final total =
        entries.fold<int>(0, (sum, e) => sum + (e['count'] as num).toInt());
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
          children: entries.map((e) {
        final status = e['status'] as String;
        final count = (e['count'] as num).toInt();
        final pct = (count / total * 100).round();
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                    color: _statusColors[status] ?? Colors.grey,
                    shape: BoxShape.circle)),
            const SizedBox(width: 10),
            Expanded(
                child: Text(_statusLabels[status] ?? status,
                    style: const TextStyle(fontSize: 13))),
            Text('$count',
                style:
                    const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            const SizedBox(width: 8),
            Text('($pct%)',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          ]),
        );
      }).toList()),
    );
  }
}
