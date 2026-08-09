import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/order_provider.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/money_text.dart';
import '../../utils/constants.dart';
import '../../utils/formatters.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _fulfillmentType = 'delivery';
  String _paymentMethod = 'efectivo';
  final _notesCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() { _notesCtrl.dispose(); super.dispose(); }

  Future<void> _submitOrder() async {
    setState(() => _submitting = true);
    final op = context.read<OrderProvider>();
    final ok = await op.createOrder(fulfillmentType: _fulfillmentType, paymentMethod: _paymentMethod, notes: _notesCtrl.text.trim());
    if (!mounted) return;
    setState(() => _submitting = false);
    if (ok && op.orders.isNotEmpty) {
      context.read<CartProvider>().clear();
      Navigator.pushNamedAndRemoveUntil(context, '/order', ModalRoute.withName('/home'), arguments: {'id': op.orders.first.id});
    } else { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(op.error ?? 'Error al crear pedido'), backgroundColor: AppColors.error)); }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    if (cart.items.isEmpty) return Scaffold(appBar: const CustomAppBar(title: 'Checkout', showBack: true), body: const EmptyState(icon: Icons.shopping_cart, title: 'Carrito vacío', subtitle: 'Agrega productos primero'));
    return Scaffold(appBar: const CustomAppBar(title: 'Finalizar Pedido', showBack: true), body: ListView(padding: const EdgeInsets.all(16), children: [
      // Tipo de entrega
      const Text('Tipo de entrega', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: _buildTypeCard('Domicilio', Icons.delivery_dining, 'delivery')),
        const SizedBox(width: 10),
        Expanded(child: _buildTypeCard('Recoger en tienda', Icons.store, 'pickup')),
      ]),
      const SizedBox(height: 16),
      if (_fulfillmentType == 'delivery') Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Dirección de entrega', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        InkWell(onTap: () => Navigator.pushNamed(context, '/addresses'), child: Row(children: [const Icon(Icons.location_on, color: AppColors.primary), const SizedBox(width: 8), Expanded(child: Text('Seleccionar dirección', style: TextStyle(color: AppColors.textSecondary))), const Icon(Icons.chevron_right)])),
      ]))),
      if (_fulfillmentType == 'pickup') Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Recoger en', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        const Text('KDX 1-2B Los Mangos, Cúcuta', style: TextStyle(fontSize: 14)),
        const SizedBox(height: 2),
        const Text('Lun-Sáb: 6:00 AM - 6:00 PM', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
      ]))),
      const SizedBox(height: 16),
      // Método de pago
      const Text('Método de pago', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 8),
      ...['efectivo', 'nequi', 'daviplata', 'tarjeta'].map((m) => RadioListTile<String>(
        value: m, groupValue: _paymentMethod, onChanged: (v) => setState(() => _paymentMethod = v!),
        title: Text({'efectivo': 'Efectivo', 'nequi': 'Nequi', 'daviplata': 'Daviplata', 'tarjeta': 'Tarjeta'}[m]!),
        secondary: Icon({'efectivo': Icons.payments_outlined, 'nequi': Icons.phone_android, 'daviplata': Icons.phone_android, 'tarjeta': Icons.credit_card}[m]!, color: AppColors.primary),
        activeColor: AppColors.primary, contentPadding: EdgeInsets.zero, dense: true,
      )),
      const SizedBox(height: 16),
      // Notas
      TextField(controller: _notesCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Notas del pedido (opcional)', prefixIcon: Icon(Icons.notes))),
      const SizedBox(height: 16),
      // Resumen
      Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Resumen del pedido', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 10),
        _buildSummaryRow('Subtotal', formatCOP(cart.subtotal)),
        _buildSummaryRow('Domicilio', cart.deliveryFee == 0 ? 'GRATIS' : formatCOP(cart.deliveryFee)),
        if (cart.discount > 0) _buildSummaryRow('Descuento', '-${formatCOP(cart.discount)}', color: AppColors.success),
        const Divider(height: 20),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)), MoneyText(amount: cart.total, size: MoneySize.large)]),
      ])),
      const SizedBox(height: 20),
      SizedBox(width: double.infinity, height: 50, child: ElevatedButton(
        onPressed: _submitting ? null : _submitOrder,
        child: _submitting ? const CircularProgressIndicator(color: Colors.white) : const Text('Confirmar Pedido', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      )),
      const SizedBox(height: 40),
    ]));
  }

  Widget _buildTypeCard(String title, IconData icon, String type) {
    final selected = _fulfillmentType == type;
    return InkWell(onTap: () => setState(() => _fulfillmentType = type), child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(border: Border.all(color: selected ? AppColors.primary : AppColors.lightGray, width: selected ? 2 : 1), borderRadius: BorderRadius.circular(12), color: selected ? AppColors.primary.withOpacity(0.05) : null), child: Column(children: [Icon(icon, color: selected ? AppColors.primary : AppColors.gray, size: 28), const SizedBox(height: 6), Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: selected ? AppColors.primary : AppColors.textSecondary, fontSize: 13))])));
  }

  Widget _buildSummaryRow(String label, String value, {Color? color}) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: const TextStyle(color: AppColors.textSecondary)), Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: color))]));
}
