import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';

class PromotionsScreen extends StatefulWidget {
  const PromotionsScreen({super.key});

  @override
  State<PromotionsScreen> createState() => _PromotionsScreenState();
}

class _PromotionsScreenState extends State<PromotionsScreen> {
  List<Map<String, dynamic>> _promotions = [];
  bool _isLoading = true;
  String? _error;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadPromotions();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadPromotions() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get(ApiEndpoints.adminPromotions);
      final raw = response['data'] ?? response['promotions'] ?? response;
      final list = raw is List ? raw : [raw];
      setState(() {
        _promotions = list.map((e) => e as Map<String, dynamic>).toList();
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar promociones';
        _isLoading = false;
      });
    }
  }

  void _showForm({Map<String, dynamic>? promotion}) {
    final codeController = TextEditingController(text: promotion?['code'] as String? ?? '');
    final nameController = TextEditingController(text: promotion?['name'] as String? ?? '');
    String type = promotion?['type'] as String? ?? 'percentage';
    final valueController = TextEditingController(
      text: promotion?['value'] != null ? (promotion!['value'] as num).toString() : '',
    );
    final minOrderController = TextEditingController(
      text: promotion?['min_order'] != null ? (promotion!['min_order'] as num).toString() : '',
    );
    final maxUsesController = TextEditingController(
      text: promotion?['max_uses'] != null ? (promotion!['max_uses'] as num).toString() : '',
    );
    final startController = TextEditingController(
      text: promotion?['start_date']?.toString().split('T').first ?? '',
    );
    final endController = TextEditingController(
      text: promotion?['end_date']?.toString().split('T').first ?? '',
    );
    final isEdit = promotion != null;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(isEdit ? 'Editar promoción' : 'Nueva promoción'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: codeController,
                  decoration: InputDecoration(
                    labelText: 'Código',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(
                    labelText: 'Nombre *',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: type,
                  decoration: InputDecoration(
                    labelText: 'Tipo',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'percentage', child: Text('Porcentaje %')),
                    DropdownMenuItem(value: 'fixed', child: Text('Valor fijo')),
                    DropdownMenuItem(value: 'free_delivery', child: Text('Domicilio gratis')),
                  ],
                  onChanged: (val) => setDialogState(() => type = val ?? 'percentage'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: valueController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: type == 'free_delivery' ? '(No aplica)' : 'Valor',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    enabled: type != 'free_delivery',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: minOrderController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Pedido mínimo',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: maxUsesController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Usos máximos',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: startController,
                        readOnly: true,
                        decoration: InputDecoration(
                          labelText: 'Fecha inicio',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          suffixIcon: const Icon(Icons.calendar_today, size: 18),
                        ),
                        onTap: () async {
                          final date = await showDatePicker(
                            context: ctx,
                            firstDate: DateTime.now().subtract(const Duration(days: 1)),
                            lastDate: DateTime(2030),
                            locale: const Locale('es', 'CO'),
                          );
                          if (date != null) setDialogState(() => startController.text = date.toIso8601String().split('T').first);
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: endController,
                        readOnly: true,
                        decoration: InputDecoration(
                          labelText: 'Fecha fin',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          suffixIcon: const Icon(Icons.calendar_today, size: 18),
                        ),
                        onTap: () async {
                          final date = await showDatePicker(
                            context: ctx,
                            firstDate: DateTime.now(),
                            lastDate: DateTime(2030),
                            locale: const Locale('es', 'CO'),
                          );
                          if (date != null) setDialogState(() => endController.text = date.toIso8601String().split('T').first);
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                codeController.dispose();
                nameController.dispose();
                valueController.dispose();
                minOrderController.dispose();
                maxUsesController.dispose();
                startController.dispose();
                endController.dispose();
                Navigator.pop(ctx);
              },
              child: const Text('Cancelar'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('El nombre es obligatorio'), backgroundColor: AppColors.error),
                  );
                  return;
                }
                Navigator.pop(ctx);
                await _savePromotion(
                  isEdit: isEdit,
                  id: promotion?['id'] as int?,
                  data: {
                    'code': codeController.text.trim(),
                    'name': nameController.text.trim(),
                    'type': type,
                    'value': double.tryParse(valueController.text) ?? 0,
                    'min_order': int.tryParse(minOrderController.text) ?? 0,
                    'max_uses': int.tryParse(maxUsesController.text),
                    'start_date': startController.text,
                    'end_date': endController.text,
                  },
                );
                codeController.dispose();
                nameController.dispose();
                valueController.dispose();
                minOrderController.dispose();
                maxUsesController.dispose();
                startController.dispose();
                endController.dispose();
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              child: Text(isEdit ? 'Guardar' : 'Crear'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _savePromotion({required bool isEdit, int? id, required Map<String, dynamic> data}) async {
    try {
      if (isEdit && id != null) {
        await apiService.put(ApiEndpoints.adminPromotion(id.toString()), data);
      } else {
        await apiService.post(ApiEndpoints.adminPromotions, data);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isEdit ? 'Promoción actualizada' : 'Promoción creada'),
            backgroundColor: AppColors.success,
          ),
        );
        _loadPromotions();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _toggleActive(int id, bool current) async {
    try {
      await apiService.put(ApiEndpoints.adminPromotion(id.toString()), {'is_active': !current});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Estado actualizado'), backgroundColor: AppColors.success),
        );
        _loadPromotions();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _deletePromotion(int id, String name) async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('Eliminar promoción'),
        content: Text('¿Eliminar "$name"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await apiService.delete(ApiEndpoints.adminPromotion(id.toString()));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Promoción eliminada'), backgroundColor: AppColors.success),
        );
        _loadPromotions();
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  String _getTypeLabel(String type) {
    const map = {
      'percentage': 'Porcentaje',
      'fixed': 'Valor fijo',
      'free_delivery': 'Domicilio gratis',
    };
    return map[type] ?? type;
  }

  Color _getTypeColor(String type) {
    switch (type) {
      case 'percentage':
        return AppColors.primary;
      case 'fixed':
        return AppColors.accent;
      case 'free_delivery':
        return AppColors.gold;
      default:
        return AppColors.gray;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Promociones'),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showForm(),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add),
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
                        onPressed: _loadPromotions,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : _promotions.isEmpty
                  ? EmptyState(
                      icon: Icons.local_offer_outlined,
                      title: 'Sin promociones',
                      subtitle: 'Crea tu primera promoción para atraer clientes',
                    )
                  : RefreshIndicator(
                      onRefresh: _loadPromotions,
                      child: ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: _promotions.length,
                        itemBuilder: (context, index) => _buildPromotionCard(_promotions[index]),
                      ),
                    ),
    );
  }

  Widget _buildPromotionCard(Map<String, dynamic> promo) {
    final isActive = promo['is_active'] as bool? ?? true;
    final type = promo['type'] as String? ?? 'percentage';
    final typeColor = _getTypeColor(type);
    final uses = (promo['uses_count'] as num?)?.toInt() ?? 0;
    final maxUses = promo['max_uses'] as int?;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: typeColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.local_offer, color: typeColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          promo['name'] as String? ?? 'Sin nombre',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Switch(
                        value: isActive,
                        onChanged: (_) => _toggleActive(promo['id'] as int, isActive),
                        activeColor: AppColors.primary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (promo['code'] != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: AppColors.lightGray,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            promo['code'].toString(),
                            style: const TextStyle(fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(
                          color: typeColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(_getTypeLabel(type), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: typeColor)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        type == 'percentage'
                            ? '${promo['value']}%'
                            : type == 'fixed'
                                ? formatCOP((promo['value'] as num?)?.toInt() ?? 0)
                                : 'Gratis',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: typeColor),
                      ),
                      if (maxUses != null) ...[
                        const SizedBox(width: 12),
                        Text(
                          '$uses/$maxUses usos',
                          style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ],
                  ),
                  if (promo['start_date'] != null)
                    Text(
                      '${formatDate(promo['start_date'].toString())} - ${promo['end_date'] != null ? formatDate(promo['end_date'].toString()) : "Indefinido"}',
                      style: const TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20),
              onSelected: (action) {
                if (action == 'edit') _showForm(promotion: promo);
                if (action == 'delete') _deletePromotion(promo['id'] as int, promo['name']?.toString() ?? '');
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Editar')),
                const PopupMenuItem(value: 'delete', child: Text('Eliminar', style: TextStyle(color: AppColors.error))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
