import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';
import '../../widgets/custom_app_bar.dart';

class InvoiceConfigScreen extends StatefulWidget {
  const InvoiceConfigScreen({super.key});

  @override
  State<InvoiceConfigScreen> createState() => _InvoiceConfigScreenState();
}

class _InvoiceConfigScreenState extends State<InvoiceConfigScreen> {
  final TextEditingController _resolutionController = TextEditingController();
  final TextEditingController _prefixController = TextEditingController();
  final TextEditingController _fromController = TextEditingController();
  final TextEditingController _toController = TextEditingController();
  final TextEditingController _validUntilController = TextEditingController();
  String _provider = 'mock';
  bool _isLoading = true;
  bool _isSaving = false;
  String? _error;
  Map<String, dynamic>? _currentNumbering;
  int _currentNumber = 0;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  @override
  void dispose() {
    _resolutionController.dispose();
    _prefixController.dispose();
    _fromController.dispose();
    _toController.dispose();
    _validUntilController.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final settingsResponse = await apiService.get(ApiEndpoints.settings);
      final settings = settingsResponse['data'] ?? settingsResponse;

      final numberingResponse = await apiService.get('/api/invoices/numbering');
      final numbering = numberingResponse['data'] ?? numberingResponse;

      setState(() {
        _resolutionController.text = settings['invoice_resolution']?.toString() ?? '';
        _prefixController.text = settings['invoice_prefix']?.toString() ?? 'SETP';
        _fromController.text = settings['invoice_from']?.toString() ?? '';
        _toController.text = settings['invoice_to']?.toString() ?? '';
        _validUntilController.text = settings['invoice_valid_until']?.toString() ?? '';
        _provider = settings['invoice_provider']?.toString() ?? 'mock';
        _currentNumbering = numbering;
        _currentNumber = (numbering['current_number'] as num?)?.toInt() ?? 0;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error al cargar la configuración';
        _isLoading = false;
      });
    }
  }

  Future<void> _saveConfig() async {
    if (_resolutionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('El número de resolución es obligatorio'), backgroundColor: AppColors.error),
      );
      return;
    }
    setState(() => _isSaving = true);
    try {
      await apiService.put(ApiEndpoints.settings, {
        'invoice_resolution': _resolutionController.text.trim(),
        'invoice_prefix': _prefixController.text.trim(),
        'invoice_from': int.tryParse(_fromController.text) ?? 0,
        'invoice_to': int.tryParse(_toController.text) ?? 0,
        'invoice_valid_until': _validUntilController.text.trim(),
        'invoice_provider': _provider,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Configuración guardada'), backgroundColor: AppColors.success),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _selectDate() async {
    final date = await showDatePicker(
      context: context,
      firstDate: DateTime.now(),
      lastDate: DateTime(2030),
      locale: const Locale('es', 'CO'),
    );
    if (date != null) {
      setState(() {
        _validUntilController.text = date.toIso8601String().split('T').first;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Configuración facturación', showBack: true),
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
                        onPressed: _loadConfig,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_currentNumbering != null) _buildNumberingStatus(),
                    const SizedBox(height: 16),
                    Card(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Datos de la resolución', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 16),
                            _buildTextField(
                              controller: _resolutionController,
                              label: 'Número de resolución *',
                              hint: 'Ej: 18764',
                            ),
                            const SizedBox(height: 12),
                            _buildTextField(
                              controller: _prefixController,
                              label: 'Prefijo',
                              hint: 'Ej: SETP',
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildTextField(
                                    controller: _fromController,
                                    label: 'Numeración desde',
                                    keyboardType: TextInputType.number,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildTextField(
                                    controller: _toController,
                                    label: 'Numeración hasta',
                                    keyboardType: TextInputType.number,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            GestureDetector(
                              onTap: _selectDate,
                              child: AbsorbPointer(
                                child: _buildTextField(
                                  controller: _validUntilController,
                                  label: 'Válida hasta',
                                  hint: 'YYYY-MM-DD',
                                  suffixIcon: const Icon(Icons.calendar_today, size: 18),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            const Text('Proveedor DIAN', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 8),
                            _buildProviderSelector(),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        onPressed: _isSaving ? null : _saveConfig,
                        icon: _isSaving
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.save),
                        label: Text(_isSaving ? 'Guardando...' : 'Guardar configuración'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildNumberingStatus() {
    final prefix = _currentNumbering?['prefix'] ?? _prefixController.text;
    final from = _currentNumbering?['from'] ?? _fromController.text;
    final to = _currentNumbering?['to'] ?? _toController.text;
    final fromInt = int.tryParse(from.toString()) ?? 0;
    final toInt = int.tryParse(to.toString()) ?? 0;
    final progress = toInt > 0 ? _currentNumber / toInt : 0.0;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: AppColors.primaryDark.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.receipt_long, color: AppColors.primaryDark),
                const SizedBox(width: 8),
                const Text('Estado de numeración', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Consecutivo actual:', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                Text(
                  '$prefix${_currentNumber.toString().padLeft(8, "0")}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.primaryDark),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Rango:', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                Text(
                  '$prefix${fromInt.toString().padLeft(8, "0")} - $prefix${toInt.toString().padLeft(8, "0")}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.clamp(0.0, 1.0),
                minHeight: 6,
                backgroundColor: AppColors.lightGray,
                valueColor: AlwaysStoppedAnimation(
                  progress > 0.9 ? AppColors.error : progress > 0.7 ? AppColors.accent : AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${(progress * 100).toStringAsFixed(1)}% utilizado (${toInt - _currentNumber} disponibles)',
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    String? hint,
    TextInputType? keyboardType,
    Widget? suffixIcon,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        suffixIcon: suffixIcon,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
        fillColor: AppColors.lightGray,
      ),
    );
  }

  Widget _buildProviderSelector() {
    return Row(
      children: [
        Expanded(
          child: RadioListTile<String>(
            title: const Text('Simulación (Desarrollo)'),
            subtitle: const Text('No envía a DIAN', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            value: 'mock',
            groupValue: _provider,
            onChanged: (val) => setState(() => _provider = val!),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
        Expanded(
          child: RadioListTile<String>(
            title: const Text('Producción'),
            subtitle: const Text('Envío real a DIAN', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            value: 'real',
            groupValue: _provider,
            onChanged: (val) => setState(() => _provider = val!),
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        ),
      ],
    );
  }
}
