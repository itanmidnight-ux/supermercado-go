import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class CashSessionScreen extends StatefulWidget {
  const CashSessionScreen({super.key});

  @override
  State<CashSessionScreen> createState() => _CashSessionScreenState();
}

class _CashSessionScreenState extends State<CashSessionScreen> {
  final TextEditingController _openAmountController = TextEditingController();
  final TextEditingController _countedController = TextEditingController();
  final TextEditingController _closeNotesController = TextEditingController();
  bool _isLoading = true;
  String? _error;
  bool _isSubmitting = false;
  Map<String, dynamic>? _activeSession;
  bool _hasActiveSession = false;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  @override
  void dispose() {
    _openAmountController.dispose();
    _countedController.dispose();
    _closeNotesController.dispose();
    super.dispose();
  }

  Future<void> _loadSession() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await apiService.get('/api/cash-sessions/active');
      final data = response['data'] ?? response;
      setState(() {
        _activeSession = data;
        _hasActiveSession = data != null && data['id'] != null;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      if (e.message.contains('No hay') || e.statusCode == 404) {
        setState(() {
          _hasActiveSession = false;
          _activeSession = null;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _hasActiveSession = false;
        _activeSession = null;
        _isLoading = false;
      });
    }
  }

  Future<void> _openCash() async {
    final amount = int.tryParse(_openAmountController.text.replaceAll(RegExp(r'[^0-9]'), ''));
    if (amount == null || amount < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa un monto válido'), backgroundColor: AppColors.error),
      );
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      await apiService.post('/api/cash-sessions', {
        'opening_amount': amount,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Caja abierta correctamente'),
            backgroundColor: AppColors.success,
          ),
        );
        _openAmountController.clear();
        _loadSession();
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
          const SnackBar(content: Text('Error al abrir caja'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _closeCash() async {
    final counted = int.tryParse(_countedController.text.replaceAll(RegExp(r'[^0-9]'), ''));
    if (counted == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa el monto contado'), backgroundColor: AppColors.error),
      );
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Text('¿Cerrar caja?'),
        content: const Text('Esta acción no se puede deshacer.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Cerrar caja'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isSubmitting = true);
    try {
      await apiService.post('/api/cash-sessions/${_activeSession?["id"]}/close', {
        'counted_amount': counted,
        'notes': _closeNotesController.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Caja cerrada correctamente'),
            backgroundColor: AppColors.success,
          ),
        );
        _countedController.clear();
        _closeNotesController.clear();
        _loadSession();
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
          const SnackBar(content: Text('Error al cerrar caja'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  int get _openingAmount {
    final v = _activeSession?['opening_amount'];
    return v is int ? v : (v as num?)?.toInt() ?? 0;
  }

  int get _expectedAmount {
    final v = _activeSession?['expected_amount'];
    return v is int ? v : (v as num?)?.toInt() ?? 0;
  }

  int get _difference {
    final counted = int.tryParse(_countedController.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    return counted - (_openingAmount + _expectedAmount);
  }

  int get _totalExpected => _openingAmount + _expectedAmount;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Caja del repartidor'),
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
                        onPressed: _loadSession,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadSession,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (!_hasActiveSession) ...[
                        _buildOpenForm(),
                      ] else ...[
                        _buildSessionInfo(),
                        const SizedBox(height: 20),
                        _buildCloseForm(),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _buildOpenForm() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.lock_open, color: AppColors.primary, size: 28),
                SizedBox(width: 12),
                Text('Abrir caja', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Registra el dinero en efectivo con el que inicias tu turno de entregas.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _openAmountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Monto de apertura',
                prefixText: '	${AppStrings.currencySymbol} ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                filled: true,
                fillColor: AppColors.lightGray,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _openCash,
                icon: _isSubmitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.lock_open),
                label: Text(_isSubmitting ? 'Abriendo...' : 'Abrir caja'),
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

  Widget _buildSessionInfo() {
    final openedAt = _activeSession?['opened_at'] as String?;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: AppColors.primary.withOpacity(0.05),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.lock, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                const Text('Caja abierta', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Activa',
                    style: TextStyle(color: AppColors.success, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildInfoRow('Apertura', openedAt != null ? '${formatDate(openedAt)} ${formatTime(openedAt)}' : '-'),
            const Divider(height: 24),
            _buildInfoRow('Monto de apertura', formatCOP(_openingAmount)),
            const Divider(height: 24),
            _buildInfoRow('Efectivo cobrado', formatCOP(_expectedAmount)),
            const Divider(height: 24),
            _buildInfoRow(
              'Total esperado',
              formatCOP(_totalExpected),
              valueStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.primaryDark),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {TextStyle? valueStyle}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
        Text(value, style: valueStyle ?? const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ],
    );
  }

  Widget _buildCloseForm() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.lock_clock, color: AppColors.accent, size: 28),
                SizedBox(width: 12),
                Text('Cerrar caja', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _countedController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: 'Monto contado',
                prefixText: '	${AppStrings.currencySymbol} ',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                filled: true,
                fillColor: AppColors.lightGray,
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: _countedController.text.isNotEmpty
                  ? Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _difference == 0
                            ? AppColors.success.withOpacity(0.08)
                            : _difference > 0
                                ? AppColors.accent.withOpacity(0.08)
                                : AppColors.error.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Diferencia:',
                            style: TextStyle(
                              fontSize: 14,
                              color: _difference == 0
                                  ? AppColors.success
                                  : _difference > 0
                                      ? AppColors.accent
                                      : AppColors.error,
                            ),
                          ),
                          Text(
                            '${_difference >= 0 ? "+" : ""}${formatCOP(_difference.abs())}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: _difference == 0
                                  ? AppColors.success
                                  : _difference > 0
                                      ? AppColors.accent
                                      : AppColors.error,
                            ),
                          ),
                        ],
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _closeNotesController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Notas (opcional)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                filled: true,
                fillColor: AppColors.lightGray,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _closeCash,
                icon: _isSubmitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.lock),
                label: Text(_isSubmitting ? 'Cerrando...' : 'Cerrar caja'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
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
