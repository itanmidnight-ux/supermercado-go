import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'app_button.dart';
import 'futuristic_modal.dart';

class DeliveryChoice {
  final String mode; // 'gps' | 'address'
  final double? lat;
  final double? lng;
  final String? address;
  const DeliveryChoice.gps({required this.lat, required this.lng})
      : mode = 'gps',
        address = null;
  const DeliveryChoice.address(this.address)
      : mode = 'address',
        lat = null,
        lng = null;
}

/// Paso 1 del checkout: elegir entre compartir ubicación en tiempo real o
/// escribir una dirección de entrega. Ventana emergente futurista, ambas
/// opciones en tarjetas grandes con acordeón para el input de dirección.
Future<DeliveryChoice?> showDeliveryModal(BuildContext context) {
  return showFuturisticModal<DeliveryChoice>(context,
      builder: (_) => const _DeliveryModal());
}

class _DeliveryModal extends StatefulWidget {
  const _DeliveryModal();
  @override
  State<_DeliveryModal> createState() => _DeliveryModalState();
}

class _DeliveryModalState extends State<_DeliveryModal> {
  bool _addressMode = false;
  bool _locating = false;
  String? _error;
  final _addressCtrl = TextEditingController();

  @override
  void dispose() {
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _useGps() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Activa el GPS de tu dispositivo para continuar');
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever ||
          perm == LocationPermission.denied) {
        throw Exception(
            'Necesitamos acceso a tu ubicación para esta opción de entrega');
      }
      final pos = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high));
      if (mounted) {
        Navigator.of(context)
            .pop(DeliveryChoice.gps(lat: pos.latitude, lng: pos.longitude));
      }
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _locating = false;
        });
    }
  }

  void _confirmAddress() {
    final addr = _addressCtrl.text.trim();
    if (addr.length < 5) {
      setState(() => _error = 'Escribe una dirección válida');
      return;
    }
    Navigator.of(context).pop(DeliveryChoice.address(addr));
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FuturisticModalCard(
      child: AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const ModalCloseButton(),
              Icon(Icons.local_shipping_rounded,
                  size: 38, color: scheme.primary),
              const SizedBox(height: 8),
              const Text('¿Dónde entregamos tu pedido?',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF1A1A1A))),
              const SizedBox(height: 16),
              _OptionTile(
                icon: Icons.my_location_rounded,
                title: 'Entregar en mi ubicación actual',
                subtitle:
                    'Comparte tu ubicación en tiempo real (habilita pago contra entrega)',
                color: scheme.primary,
                selected: !_addressMode,
                loading: _locating,
                onTap: _locating
                    ? null
                    : () {
                        setState(() {
                          _addressMode = false;
                          _error = null;
                        });
                        _useGps();
                      },
              ),
              const SizedBox(height: 10),
              _OptionTile(
                icon: Icons.edit_location_alt_rounded,
                title: 'Entrega por dirección',
                subtitle: 'Escribe la dirección exacta de entrega',
                color: const Color(0xFF1565C0),
                selected: _addressMode,
                onTap: () => setState(() {
                  _addressMode = true;
                  _error = null;
                }),
              ),
              if (_addressMode) ...[
                const SizedBox(height: 14),
                TextField(
                  controller: _addressCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Ej: Calle 10 #5-30, Barrio El Prado',
                    filled: true,
                    fillColor: const Color(0xFFF8FAF8),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200)),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: Colors.grey.shade200)),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide:
                            BorderSide(color: scheme.primary, width: 1.8)),
                  ),
                ),
                const SizedBox(height: 12),
                AppButton(
                    label: 'Confirmar dirección',
                    icon: Icons.check_rounded,
                    onPressed: _confirmAddress),
              ],
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(_error!,
                      style: const TextStyle(
                          color: Color(0xFFD32F2F), fontSize: 12),
                      textAlign: TextAlign.center),
                ),
            ]),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final bool selected;
  final bool loading;
  final VoidCallback? onTap;
  const _OptionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.selected,
    this.loading = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Material(
        color: selected ? color.withValues(alpha: 0.08) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                  color: selected
                      ? color.withValues(alpha: 0.5)
                      : Colors.grey.shade200,
                  width: selected ? 1.6 : 1),
            ),
            child: Row(children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    shape: BoxShape.circle),
                child: loading
                    ? Padding(
                        padding: const EdgeInsets.all(11),
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: color))
                    : Icon(icon, color: color, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(title,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13.5,
                            color: color)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 11.5,
                            height: 1.3)),
                  ])),
            ]),
          ),
        ),
      );
}
