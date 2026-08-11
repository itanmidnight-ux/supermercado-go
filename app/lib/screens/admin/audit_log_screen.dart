import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class AuditLogScreen extends StatefulWidget {
  const AuditLogScreen({super.key});

  @override
  State<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends State<AuditLogScreen> {
  List<Map<String, dynamic>> _entries = [];
  bool _isLoading = true;
  String? _error;
  int _currentPage = 1;
  int _totalPages = 1;
  bool _hasMore = true;
  final ScrollController _scrollController = ScrollController();
  String? _userFilter;
  String? _actionFilter;
  DateTime? _dateFrom;
  DateTime? _dateTo;

  @override
  void initState() {
    super.initState();
    _loadEntries();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (_hasMore && !_isLoading) {
        _loadEntries(loadMore: true);
      }
    }
  }

  Future<void> _loadEntries({bool loadMore = false}) async {
    if (!loadMore) {
      setState(() {
        _isLoading = true;
        _error = null;
        _currentPage = 1;
        _hasMore = true;
      });
    }
    try {
      final queryParams = <String, String>{'page': _currentPage.toString()};
      if (_userFilter != null) queryParams['user_id'] = _userFilter!;
      if (_actionFilter != null) queryParams['action'] = _actionFilter!;
      if (_dateFrom != null) queryParams['date_from'] = _dateFrom!.toIso8601String().split('T').first;
      if (_dateTo != null) queryParams['date_to'] = _dateTo!.toIso8601String().split('T').first;

      final response = await apiService.get(ApiEndpoints.adminAudit, queryParams: queryParams);
      final raw = response['data'] ?? response['entries'] ?? response;
      final list = raw is List ? raw : [raw];

      setState(() {
        if (loadMore) {
          _entries.addAll(list.map((e) => e as Map<String, dynamic>).toList());
        } else {
          _entries = list.map((e) => e as Map<String, dynamic>).toList();
        }
        final meta = response['meta'] as Map<String, dynamic>? ?? {};
        _totalPages = (meta['total_pages'] as num?)?.toInt() ?? 1;
        _hasMore = _currentPage < _totalPages;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar auditoría';
        _isLoading = false;
      });
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
      _loadEntries();
    }
  }

  void _showFilters() {
    String? tempUser = _userFilter;
    String? tempAction = _actionFilter;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: const Text('Filtrar auditoría'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                decoration: InputDecoration(
                  labelText: 'ID de usuario',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onChanged: (val) => setDialogState(() => tempUser = val.isEmpty ? null : val),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: tempAction,
                decoration: InputDecoration(
                  labelText: 'Tipo de acción',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                ),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Todos')),
                  ...['create', 'update', 'delete', 'login', 'status_change', 'stock_adjust'].map(
                    (a) => DropdownMenuItem(
                      value: a,
                      child: Text(_getActionLabel(a)),
                    ),
                  ),
                ],
                onChanged: (val) => setDialogState(() => tempAction = val),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                setState(() {
                  _userFilter = null;
                  _actionFilter = null;
                  _dateFrom = null;
                  _dateTo = null;
                });
                Navigator.pop(ctx);
                _loadEntries();
              },
              child: const Text('Limpiar todo'),
            ),
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                setState(() {
                  _userFilter = tempUser;
                  _actionFilter = tempAction;
                });
                _loadEntries();
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              child: const Text('Aplicar'),
            ),
          ],
        ),
      ),
    );
  }

  String _getActionLabel(String action) {
    const map = {
      'create': 'Creación',
      'update': 'Actualización',
      'delete': 'Eliminación',
      'login': 'Inicio de sesión',
      'status_change': 'Cambio de estado',
      'stock_adjust': 'Ajuste de stock',
    };
    return map[action] ?? action;
  }

  Color _getActionColor(String action) {
    switch (action) {
      case 'create':
        return AppColors.success;
      case 'update':
      case 'status_change':
        return Colors.blue;
      case 'delete':
        return AppColors.error;
      case 'stock_adjust':
        return AppColors.accent;
      default:
        return AppColors.gray;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Registro de auditoría'),
      body: Column(
        children: [
          _buildFilterBar(),
          Expanded(
            child: _isLoading && _entries.isEmpty
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
                              onPressed: () => _loadEntries(),
                              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                              child: const Text('Reintentar'),
                            ),
                          ],
                        ),
                      )
                    : _entries.isEmpty
                        ? EmptyState(
                            icon: Icons.history,
                            title: 'Sin registros',
                            subtitle: 'No hay entradas de auditoría para los filtros seleccionados',
                          )
                        : RefreshIndicator(
                            onRefresh: () => _loadEntries(),
                            child: ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              itemCount: _entries.length + (_hasMore ? 1 : 0),
                              itemBuilder: (context, index) {
                                if (index >= _entries.length) {
                                  _loadEntries(loadMore: true);
                                  return const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                                  );
                                }
                                return _buildEntryCard(_entries[index]);
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    final hasFilters = _userFilter != null || _actionFilter != null || _dateFrom != null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.surface,
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _showFilters,
              icon: const Icon(Icons.filter_list, size: 16),
              label: Text(
                hasFilters ? 'Filtros activos' : 'Filtrar',
                style: TextStyle(
                  fontSize: 13,
                  color: hasFilters ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: _pickDateRange,
            icon: const Icon(Icons.calendar_today, size: 16),
            label: Text(
              _dateFrom != null
                  ? '${formatDate(_dateFrom!.toIso8601String())} - ${formatDate(_dateTo!.toIso8601String())}'
                  : 'Fechas',
              style: const TextStyle(fontSize: 13),
            ),
          ),
          if (_dateFrom != null) ...[
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.close, size: 16),
              onPressed: () {
                setState(() { _dateFrom = null; _dateTo = null; });
                _loadEntries();
              },
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            ),
          ],
          const SizedBox(width: 4),
          Text(
            '${_entries.length} registros',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildEntryCard(Map<String, dynamic> entry) {
    final action = entry['action'] as String? ?? 'unknown';
    final actionColor = _getActionColor(action);
    final date = entry['created_at'] as String? ?? '';
    final entity = entry['entity_type'] as String? ?? entry['entity'] ?? '';
    final entityId = entry['entity_id'] ?? '';
    final userName = entry['user_name'] as String? ?? entry['user'] ?? 'Sistema';
    final before = entry['before'] as Map<String, dynamic>?;
    final after = entry['after'] as Map<String, dynamic>?;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: actionColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _getActionLabel(action),
                    style: TextStyle(color: actionColor, fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    entity.isNotEmpty ? '$entity #$entityId' : '',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  date.isNotEmpty ? '${formatDate(date)} ${formatTime(date)}' : '',
                  style: const TextStyle(fontSize: 11, color: AppColors.gray),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.person, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(userName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              ],
            ),
            if (before != null && after != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.lightGray,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: _buildDiffEntries(before, after),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _buildDiffEntries(Map<String, dynamic> before, Map<String, dynamic> after) {
    final allKeys = {...before.keys, ...after.keys}.toList();
    allKeys.sort();
    final widgets = <Widget>[];
    for (final key in allKeys) {
      final beforeVal = before[key]?.toString() ?? '-';
      final afterVal = after[key]?.toString() ?? '-';
      if (beforeVal == afterVal) continue;
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 3),
          child: Row(
            children: [
              Text(key, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              const SizedBox(width: 8),
              Text(beforeVal, style: const TextStyle(fontSize: 11, color: AppColors.error, decoration: TextDecoration.lineThrough)),
              const SizedBox(width: 6),
              const Text('→', style: TextStyle(fontSize: 12, color: AppColors.gray)),
              const SizedBox(width: 6),
              Text(afterVal, style: const TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      );
    }
    if (widgets.isEmpty) {
      widgets.add(const Text('Sin cambios visibles', style: TextStyle(fontSize: 11, color: AppColors.gray, fontStyle: FontStyle.italic)));
    }
    return widgets;
  }
}
