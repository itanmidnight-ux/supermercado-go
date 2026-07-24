import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'app_button.dart';
import 'futuristic_modal.dart';

class PaymentChoice {
  final String method; // 'nequi' | 'visa' | 'contra_entrega'
  final String? reference;
  const PaymentChoice(this.method, [this.reference]);
}

/// Paso 2 del checkout: método de pago en estilo acordeón. Contra entrega
/// aparece bloqueado (gris, sin poder abrirse) si el cliente no compartió
/// su ubicación en tiempo real en el paso anterior.
Future<PaymentChoice?> showPaymentModal(
  BuildContext context, {
  required bool gpsGranted,
  required double total,
}) {
  return showFuturisticModal<PaymentChoice>(context,
      builder: (_) => _PaymentModal(gpsGranted: gpsGranted, total: total));
}

class _PaymentModal extends StatefulWidget {
  final bool gpsGranted;
  final double total;
  const _PaymentModal({required this.gpsGranted, required this.total});
  @override
  State<_PaymentModal> createState() => _PaymentModalState();
}

class _PaymentModalState extends State<_PaymentModal> {
  bool _loading = true;
  Map<String, dynamic>? _methods;
  String? _expanded;
  final _refCtrl = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _refCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final m = await ApiService.getPaymentMethods();
      if (mounted)
        setState(() {
          _methods = m;
          _loading = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmt(double v) =>
      NumberFormat.currency(locale: 'es_CO', symbol: '', decimalDigits: 0)
          .format(v);

  void _expand(String key) {
    setState(() {
      _expanded = _expanded == key ? null : key;
      _error = null;
      _refCtrl.clear();
    });
  }

  void _confirmWithReference(String method) {
    final ref = _refCtrl.text.trim();
    if (ref.isEmpty) {
      setState(() => _error = 'Ingresa la referencia de pago');
      return;
    }
    Navigator.of(context).pop(PaymentChoice(method, ref));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final nequi = _methods?['nequi'] as Map<String, dynamic>?;
    final nequiAvailable = nequi?['available'] == true;
    final visaAvailable =
        (_methods?['visa'] as Map<String, dynamic>?)?['available'] == true;

    return FuturisticModalCard(
      child: AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const ModalCloseButton(),
              Icon(Icons.payments_rounded, size: 38, color: scheme.primary),
              const SizedBox(height: 6),
              const Text('Método de pago',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1A1A1A))),
              const SizedBox(height: 4),
              Text('Total a pagar: \$${_fmt(widget.total)}',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: scheme.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14)),
              const SizedBox(height: 16),
              if (_loading)
                const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                        child: CircularProgressIndicator(strokeWidth: 2)))
              else ...[
                if (nequiAvailable)
                  _PaymentAccordionTile(
                    icon: Icons.account_balance_wallet_rounded,
                    title: 'Nequi',
                    subtitle:
                        'Bre-B / llaves — ${nequi?['account_name'] ?? ''} · ${nequi?['phone'] ?? ''}',
                    color: Colors.purple,
                    expanded: _expanded == 'nequi',
                    onTap: () => _expand('nequi'),
                    child: _ReferenceForm(
                      controller: _refCtrl,
                      color: Colors.purple,
                      error: _error,
                      hint: 'Ej: número de aprobación Bre-B',
                      onConfirm: () => _confirmWithReference('nequi'),
                    ),
                  ),
                if (nequiAvailable) const SizedBox(height: 10),
                if (visaAvailable)
                  _PaymentAccordionTile(
                    icon: Icons.credit_card_rounded,
                    title: 'Visa',
                    subtitle: 'Confirmar con referencia de pago',
                    color: const Color(0xFF1A237E),
                    expanded: _expanded == 'visa',
                    onTap: () => _expand('visa'),
                    child: _ReferenceForm(
                      controller: _refCtrl,
                      color: const Color(0xFF1A237E),
                      error: _error,
                      hint: 'Ej: código de autorización',
                      onConfirm: () => _confirmWithReference('visa'),
                    ),
                  ),
                if (visaAvailable) const SizedBox(height: 10),
                _PaymentAccordionTile(
                  icon: Icons.local_shipping_rounded,
                  title: 'Contra entrega',
                  subtitle: widget.gpsGranted
                      ? 'Pago en efectivo al recibir'
                      : 'Bloqueado — requiere ubicación en tiempo real',
                  color: Colors.orange.shade700,
                  expanded: _expanded == 'contra_entrega',
                  enabled: widget.gpsGranted,
                  onTap: widget.gpsGranted
                      ? () => _expand('contra_entrega')
                      : null,
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),
                        Text(
                            'Pagarás \$${_fmt(widget.total)} en efectivo cuando recibas tu pedido.',
                            style: TextStyle(
                                fontSize: 12.5, color: Colors.grey.shade600)),
                        const SizedBox(height: 10),
                        AppButton(
                            label: 'Confirmar pedido',
                            icon: Icons.check_rounded,
                            onPressed: () => Navigator.of(context)
                                .pop(const PaymentChoice('contra_entrega'))),
                      ]),
                ),
              ],
            ]),
      ),
    );
  }
}

class _PaymentAccordionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final bool expanded;
  final bool enabled;
  final VoidCallback? onTap;
  final Widget child;
  const _PaymentAccordionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.expanded,
    this.enabled = true,
    required this.onTap,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = enabled ? color : Colors.grey;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      decoration: BoxDecoration(
        color: enabled
            ? effectiveColor.withValues(alpha: 0.06)
            : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: expanded
                ? effectiveColor.withValues(alpha: 0.5)
                : Colors.grey.shade200),
      ),
      child: Column(children: [
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                      color: effectiveColor.withValues(alpha: 0.15),
                      shape: BoxShape.circle),
                  child: Icon(icon, color: effectiveColor, size: 19),
                ),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(title,
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: enabled
                                  ? const Color(0xFF1A1A1A)
                                  : Colors.grey)),
                      Text(subtitle,
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 11.5)),
                    ])),
                if (!enabled)
                  Icon(Icons.lock_rounded,
                      color: Colors.grey.shade400, size: 18)
                else
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 220),
                    child:
                        Icon(Icons.expand_more_rounded, color: effectiveColor),
                  ),
              ]),
            ),
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          child: expanded
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                  child: child)
              : const SizedBox(width: double.infinity),
        ),
      ]),
    );
  }
}

class _ReferenceForm extends StatelessWidget {
  final TextEditingController controller;
  final Color color;
  final String? error;
  final String hint;
  final VoidCallback onConfirm;
  const _ReferenceForm(
      {required this.controller,
      required this.color,
      required this.error,
      required this.hint,
      required this.onConfirm});

  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          onSubmitted: (_) => onConfirm(),
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade200)),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.grey.shade200)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: color, width: 1.8)),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(error!,
                style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 12)),
          ),
        const SizedBox(height: 10),
        AppButton(
            label: 'Confirmar pedido',
            icon: Icons.check_rounded,
            onPressed: onConfirm),
      ]);
}
