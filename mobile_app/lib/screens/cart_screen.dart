import 'package:flutter/material.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Carrito'),
        actions: [
          IconButton(
            icon: const Icon(Icons.shopping_cart),
            onPressed: () {
              // Navegar al carrito desde cualquier pantalla
            },
          ),
        ],
      ),
      body: Consumer<CartProvider>(
        builder: (context, cartProvider, child) {
          if (cartProvider.items.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shopping_cart_outlined, size: 100, color: Colors.grey[700]),
                  const SizedBox(height: 24),
                  Text(
                    'Tu carrito está vacío',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.grey[400],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      // Navegar a productos
                    },
                    child: const Text('Explorar productos'),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: cartProvider.items.length,
                  itemBuilder: (context, index) {
                    final item = cartProvider.items[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(12),
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            item['image_url'] ?? '',
                            width: 80,
                            height: 80,
                            fit: BoxFit.cover,
                          ),
                        ),
                        title: Text(item['name'] ?? ''),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 8),
                            Text(
                              '\$${item['price']?.toStringAsFixed(2)} x ${item['quantity']}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).primaryColor,
                              ),
                            ),
                          ],
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline),
                              onPressed: () {
                                cartProvider.updateQuantity(
                                  item['id'],
                                  item['quantity'] - 1,
                                );
                              },
                            ),
                            Text('${item['quantity']}'),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline),
                              onPressed: () {
                                cartProvider.updateQuantity(
                                  item['id'],
                                  item['quantity'] + 1,
                                );
                              },
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red),
                              onPressed: () {
                                cartProvider.removeItem(item['id']);
                              },
                            ),
                          ],
                        ),
                        onLongPress: () {
                          // Mostrar vista rápida del producto
                        },
                        onTap: () {
                          // Navegar a detalle del producto
                        },
                      ),
                    );
                  },
                ),
              ),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).primaryColor.withOpacity(0.2),
                      blurRadius: 20,
                      offset: const Offset(0, -5),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Total:',
                            style: TextStyle(fontSize: 18, color: Colors.white70),
                          ),
                          Text(
                            '\$${cartProvider.total.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).primaryColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      FuturisticButton(
                        text: 'Continuar con la compra',
                        icon: Icons.arrow_forward,
                        onPressed: () {
                          _showDeliveryOptions(context);
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showDeliveryOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.9,
        builder: (context, scrollController) => GlassmorphicCard(
          child: SingleChildScrollView(
            controller: scrollController,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Opciones de Entrega',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                ListTile(
                  leading: const Icon(Icons.my_location, size: 30),
                  title: const Text('Entregar en mi ubicación actual'),
                  subtitle: const Text('Compartir ubicación en tiempo real'),
                  onTap: () {
                    // Solicitar permisos de ubicación
                    Navigator.pop(context);
                    _showPaymentMethods(context, 'location');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.location_on, size: 30),
                  title: const Text('Entrega por dirección'),
                  subtitle: const Text('Escribir dirección manual'),
                  onTap: () {
                    Navigator.pop(context);
                    _showAddressInput(context);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showAddressInput(BuildContext context) {
    final addressController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: GlassmorphicCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Dirección de Entrega',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: addressController,
                decoration: const InputDecoration(
                  hintText: 'Escribe tu dirección completa',
                  prefixIcon: Icon(Icons.home),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 20),
              FuturisticButton(
                text: 'Continuar',
                onPressed: () {
                  if (addressController.text.isNotEmpty) {
                    Navigator.pop(context);
                    _showPaymentMethods(context, 'address', address: addressController.text);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showPaymentMethods(BuildContext context, String deliveryType, {String? address}) {
    final cartProvider = Provider.of<CartProvider>(context, listen: false);
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        builder: (context, scrollController) => GlassmorphicCard(
          child: SingleChildScrollView(
            controller: scrollController,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Método de Pago',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                _buildPaymentOption(
                  context,
                  'Nequi',
                  Icons.account_balance,
                  () {
                    cartProvider.setDeliveryInfo(
                      type: deliveryType,
                      address: address,
                    );
                    cartProvider.setPaymentMethod('nequi');
                    // Procesar pago
                  },
                ),
                _buildPaymentOption(
                  context,
                  'Tarjeta de Crédito/Débito',
                  Icons.credit_card,
                  () {
                    cartProvider.setDeliveryInfo(
                      type: deliveryType,
                      address: address,
                    );
                    cartProvider.setPaymentMethod('card');
                    // Procesar pago
                  },
                ),
                _buildPaymentOption(
                  context,
                  'Pago Contra Entrega',
                  Icons.money,
                  cartProvider.canUseCashOnDelivery || deliveryType == 'location'
                      ? () {
                          cartProvider.setDeliveryInfo(
                            type: deliveryType,
                            address: address,
                          );
                          cartProvider.setPaymentMethod('cash');
                          // Procesar pedido
                        }
                      : null,
                  isDisabled: !(cartProvider.canUseCashOnDelivery || deliveryType == 'location'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentOption(BuildContext context, String title, IconData icon, VoidCallback? onTap, {bool isDisabled = false}) {
    return Opacity(
      opacity: isDisabled ? 0.5 : 1.0,
      child: ListTile(
        enabled: !isDisabled,
        leading: Icon(icon, size: 30),
        title: Text(title),
        subtitle: isDisabled
            ? const Text('Requiere ubicación en tiempo real')
            : null,
        onTap: onTap,
      ),
    );
  }
}