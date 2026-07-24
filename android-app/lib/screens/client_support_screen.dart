import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

// Mismos datos que server/src/public-site/app.js (BRAND) -- sin depender
// de una URL cruzada al sitio público (corre en otro puerto/dominio según
// el despliegue), el contenido queda embebido y siempre disponible.
const _supportPhone = '+57 300 123 4567';
const _supportWhatsapp = '573001234567';
const _supportEmail = 'contacto@supermercadogo.com.co';
const _supportHours =
    'Lunes a Sábado 8:00am - 8:00pm, Domingos 8:00am - 2:00pm';

class ClientSupportScreen extends StatefulWidget {
  const ClientSupportScreen({super.key});
  @override
  State<ClientSupportScreen> createState() => _ClientSupportScreenState();
}

class _ClientSupportScreenState extends State<ClientSupportScreen> {
  String? _expandedPolicy;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Ayuda y soporte')),
      backgroundColor: const Color(0xFFF5F5F0),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: scheme.primary.withValues(alpha: 0.2)),
            ),
            child: Row(children: [
              Icon(Icons.support_agent_rounded,
                  color: scheme.primary, size: 32),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text('¿En qué te ayudamos?',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: scheme.primary)),
                    const SizedBox(height: 3),
                    Text('Horario de atención: $_supportHours',
                        style: TextStyle(
                            color: Colors.grey.shade700, fontSize: 12)),
                  ])),
            ]),
          ),
          const SizedBox(height: 20),
          _SectionLabel('Contáctanos'),
          _ContactTile(
              icon: Icons.chat_rounded,
              color: const Color(0xFF25D366),
              label: 'WhatsApp',
              value: _supportPhone,
              onTap: () => launchUrl(
                  Uri.parse('https://wa.me/$_supportWhatsapp'),
                  mode: LaunchMode.externalApplication)),
          const SizedBox(height: 10),
          _ContactTile(
              icon: Icons.call_rounded,
              color: const Color(0xFF1565C0),
              label: 'Teléfono',
              value: _supportPhone,
              onTap: () => launchUrl(
                  Uri(scheme: 'tel', path: _supportPhone.replaceAll(' ', '')))),
          const SizedBox(height: 10),
          _ContactTile(
              icon: Icons.email_rounded,
              color: const Color(0xFF6A1B9A),
              label: 'Correo',
              value: _supportEmail,
              onTap: () =>
                  launchUrl(Uri(scheme: 'mailto', path: _supportEmail))),
          const SizedBox(height: 24),
          _SectionLabel('Políticas'),
          _PolicyAccordion(
            title: 'Términos y condiciones',
            expanded: _expandedPolicy == 'terminos',
            onTap: () => setState(() => _expandedPolicy =
                _expandedPolicy == 'terminos' ? null : 'terminos'),
            body:
                'Al usar la app aceptas nuestras condiciones de compra: los precios incluyen impuestos aplicables, '
                'la disponibilidad de productos puede variar y los pedidos se confirman una vez el trabajador los acepta.',
          ),
          _PolicyAccordion(
            title: 'Política de privacidad',
            expanded: _expandedPolicy == 'privacidad',
            onTap: () => setState(() => _expandedPolicy =
                _expandedPolicy == 'privacidad' ? null : 'privacidad'),
            body:
                'Tus datos (nombre, correo, teléfono, ubicación de entrega) se usan únicamente para procesar tus '
                'pedidos. La ubicación en tiempo real solo se comparte con el trabajador que recoge tu pedido, y solo '
                'después de que lo reclama en el punto principal.',
          ),
          _PolicyAccordion(
            title: 'Política de devoluciones y cambios',
            expanded: _expandedPolicy == 'devoluciones',
            onTap: () => setState(() => _expandedPolicy =
                _expandedPolicy == 'devoluciones' ? null : 'devoluciones'),
            body:
                'Si un producto llega en mal estado o no corresponde a tu pedido, contáctanos dentro de las 24 '
                'horas siguientes a la entrega por WhatsApp o correo para coordinar el cambio.',
          ),
          _PolicyAccordion(
            title: 'Política de envíos',
            expanded: _expandedPolicy == 'envios',
            onTap: () => setState(() => _expandedPolicy =
                _expandedPolicy == 'envios' ? null : 'envios'),
            body:
                'Los tiempos de entrega dependen de la ubicación y disponibilidad de trabajadores. Puedes rastrear '
                'tu pedido en tiempo real desde la pestaña Rastrear pedido una vez sea reclamado.',
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Colors.black54,
                letterSpacing: 0.5)),
      );
}

class _ContactTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;
  final VoidCallback onTap;
  const _ContactTile(
      {required this.icon,
      required this.color,
      required this.label,
      required this.value,
      required this.onTap});

  @override
  Widget build(BuildContext context) => Material(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                      color: color, borderRadius: BorderRadius.circular(12)),
                  child: Icon(icon, color: Colors.white, size: 19)),
              const SizedBox(width: 12),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(label,
                        style: const TextStyle(
                            fontSize: 11,
                            color: Colors.black45,
                            fontWeight: FontWeight.w600)),
                    Text(value,
                        style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1A1A1A))),
                  ])),
              Icon(Icons.chevron_right_rounded, color: Colors.grey.shade400),
            ]),
          ),
        ),
      );
}

class _PolicyAccordion extends StatelessWidget {
  final String title;
  final String body;
  final bool expanded;
  final VoidCallback onTap;
  const _PolicyAccordion(
      {required this.title,
      required this.body,
      required this.expanded,
      required this.onTap});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(children: [
                  Icon(Icons.policy_outlined,
                      size: 18, color: Colors.grey.shade600),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Text(title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13.5))),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(Icons.expand_more_rounded,
                        color: Colors.grey.shade500),
                  ),
                ]),
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            child: expanded
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: Text(body,
                        style: TextStyle(
                            color: Colors.grey.shade700,
                            fontSize: 12.5,
                            height: 1.5)),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ]),
      );
}
