import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';

class AdminPromoFormScreen extends StatefulWidget {
  final int? promoId;
  const AdminPromoFormScreen({super.key, this.promoId});

  @override
  State<AdminPromoFormScreen> createState() => _AdminPromoFormScreenState();
}

class _AdminPromoFormScreenState extends State<AdminPromoFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _valueCtrl = TextEditingController();
  final _minOrderCtrl = TextEditingController();
  final _maxUsesCtrl = TextEditingController();
  final _startCtrl = TextEditingController();
  final _endCtrl = TextEditingController();
  String _type = 'percentage';
  bool _isActive = true;
  bool _isLoading = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.promoId != null) _loadPromo();
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    _valueCtrl.dispose();
    _minOrderCtrl.dispose();
    _maxUsesCtrl.dispose();
    _startCtrl.dispose();
    _endCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPromo() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiService.get(ApiEndpoints.adminPromotion(widget.promoId.toString()));
      final data = response['data'] ?? response;
      if (mounted) {
        setState(() {
          _codeCtrl.text = data['code']?.toString() ?? '';
          _nameCtrl.text = data['name']?.toString() ?? '';
          _type = data['type']?.toString() ?? 'percentage';
          _valueCtrl.text = data['value']?.toString() ?? '';
          _minOrderCtrl.text = data['min_order']?.toString() ?? '';
          _maxUsesCtrl.text = data['max_uses']?.toString() ?? '';
          _startCtrl.text = data['start_date']?.toString().split('T').first ?? '';
          _endCtrl.text = data['end_date']?.toString().split('T').first ?? '';
          _isActive = data['is_active'] != false;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);
    try {
      final body = <String, dynamic>{
        'code': _codeCtrl.text.trim(),
        'name': _nameCtrl.text.trim(),
        'type': _type,
        'value': double.tryParse(_valueCtrl.text) ?? 0,
        'min_order': int.tryParse(_minOrderCtrl.text) ?? 0,
        'max_uses': _maxUsesCtrl.text.trim().isEmpty ? null : int.tryParse(_maxUsesCtrl.text),
        'start_date': _startCtrl.text.trim().isEmpty ? null : _startCtrl.text.trim(),
        'end_date': _endCtrl.text.trim().isEmpty ? null : _endCtrl.text.trim(),
        'is_active': _isActive,
      };
      if (widget.promoId != null) {
        await apiService.put(ApiEndpoints.adminPromotion(widget.promoId.toString()), body);
      } else {
        await apiService.post(ApiEndpoints.adminPromotions, body);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(widget.promoId != null ? 'Promoción actualizada' : 'Promoción creada'),
          backgroundColor: AppColors.success,
        ));
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.error));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: CustomAppBar(title: widget.promoId == null ? 'Nueva Promoción' : 'Editar Promoción', showBack: true),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Datos de la promoción', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _codeCtrl,
                            decoration: InputDecoration(labelText: 'Código', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _nameCtrl,
                            decoration: InputDecoration(labelText: 'Nombre *', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            validator: (v) => v == null || v.trim().isEmpty ? 'Obligatorio' : null,
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            value: _type,
                            decoration: InputDecoration(labelText: 'Tipo', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                            items: const [
                              DropdownMenuItem(value: 'percentage', child: Text('Porcentaje %')),
                              DropdownMenuItem(value: 'fixed', child: Text('Valor fijo')),
                              DropdownMenuItem(value: 'free_delivery', child: Text('Domicilio gratis')),
                            ],
                            onChanged: (v) => setState(() => _type = v ?? 'percentage'),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _valueCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: type == 'free_delivery' ? '(No aplica)' : 'Valor',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                              enabled: _type != 'free_delivery',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _minOrderCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(labelText: 'Pedido mínimo', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _maxUsesCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(labelText: 'Usos máximos (vacío = ilimitado)', border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                          ),
                          const SizedBox(height: 12),
                          Row(children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () async {
                                  final date = await showDatePicker(context: context, firstDate: DateTime.now().subtract(const Duration(days: 1)), lastDate: DateTime(2030), locale: const Locale('es', 'CO'));
                                  if (date != null) setState(() => _startCtrl.text = date.toIso8601String().split('T').first);
                                },
                                child: AbsorbPointer(
                                  child: TextFormField(
                                    controller: _startCtrl,
                                    decoration: InputDecoration(labelText: 'Fecha inicio', suffixIcon: const Icon(Icons.calendar_today, size: 18), border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: GestureDetector(
                                onTap: () async {
                                  final date = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime(2030), locale: const Locale('es', 'CO'));
                                  if (date != null) setState(() => _endCtrl.text = date.toIso8601String().split('T').first);
                                },
                                child: AbsorbPointer(
                                  child: TextFormField(
                                    controller: _endCtrl,
                                    decoration: InputDecoration(labelText: 'Fecha fin', suffixIcon: const Icon(Icons.calendar_today, size: 18), border: OutlineInputBorder(borderRadius: BorderRadius.circular(8))),
                                  ),
                                ),
                              ),
                            ),
                          ]),
                          const SizedBox(height: 8),
                          SwitchListTile(
                            title: const Text('Activo'),
                            value: _isActive,
                            onChanged: (v) => setState(() => _isActive = v),
                            contentPadding: EdgeInsets.zero,
                            activeColor: AppColors.primary,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _isSaving ? null : _save,
                      icon: _isSaving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save),
                      label: Text(_isSaving ? 'Guardando...' : 'Guardar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
