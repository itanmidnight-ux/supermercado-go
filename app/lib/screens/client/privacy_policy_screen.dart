import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../utils/constants.dart';

class PrivacyPolicyScreen extends StatefulWidget {
  final VoidCallback? onAccepted;

  const PrivacyPolicyScreen({super.key, this.onAccepted});

  @override
  State<PrivacyPolicyScreen> createState() => _PrivacyPolicyScreenState();
}

class _PrivacyPolicyScreenState extends State<PrivacyPolicyScreen> {
  bool _isLoading = false;
  bool _alreadyAccepted = false;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _checkAccepted();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _checkAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    final acceptedAt = prefs.getString('accepted_privacy_at');
    if (acceptedAt != null) {
      setState(() => _alreadyAccepted = true);
    }
  }

  Future<void> _acceptPolicy() async {
    setState(() => _isLoading = true);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accepted_privacy_at', DateTime.now().toIso8601String());
    setState(() {
      _isLoading = false;
      _alreadyAccepted = true;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Política de privacidad aceptada'), backgroundColor: AppColors.success),
      );
    }
    widget.onAccepted?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Política de privacidad'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: const EdgeInsets.all(20),
              children: [
                Center(
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.shield, color: AppColors.primary, size: 36),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Política de Privacidad',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  '${AppStrings.businessName} - ${AppStrings.businessCity}',
                  style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                  textAlign: TextAlign.center,
                ),
                const Text(
                  'Última actualización: Enero 2025',
                  style: TextStyle(fontSize: 12, color: AppColors.gray),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                _buildSection('1. Información que recopilamos', [
                  'Recopilamos los datos personales que nos proporcionas directamente al crear tu cuenta, realizar pedidos o comunicarte con nosotros. Esto incluye:',
                  '• Nombre completo',
                  '• Correo electrónico',
                  '• Número de teléfono',
                  '• Direcciones de entrega',
                  '• Historial de pedidos y preferencias',
                  '• Datos de pago (procesados por terceros seguros)',
                  '• Datos de ubicación para entregas',
                ]),
                _buildSection('2. Uso de la información', [
                  'Utilizamos tus datos personales para:',
                  '• Procesar y entregar tus pedidos',
                  '• Comunicarnos contigo sobre el estado de tus pedidos',
                  '• Enviar notificaciones y ofertas promocionales (con tu consentimiento)',
                  '• Mejorar nuestros servicios y experiencia de usuario',
                  '• Prevenir fraudes y garantizar la seguridad',
                  '• Cumplir con obligaciones legales',
                ]),
                _buildSection('3. Base legal - Ley 1581 de 2012', [
                  'El tratamiento de tus datos personales se rige por la Ley 1581 de 2012 (Ley de Protección de Datos Personales) de Colombia y el Decreto 1377 de 2013.',
                  '• Autorización previa del titular',
                  '• Finalidad legítima y consentimiento informado',
                  '• Derechos de acceso, rectificación, cancelación y oposición (ARCO)',
                  '• Tratamiento solo con fines autorizados',
                ]),
                _buildSection('4. Derechos del titular', [
                  'Como titular de tus datos personales, tienes derecho a:',
                  '• Conocer, actualizar y rectificar tus datos personales',
                  '• Solicitar la supresión de tus datos cuando el tratamiento no se ajuste a la ley',
                  '• Revocar la autorización otorgada para el tratamiento de datos',
                  '• Acceder a los datos que hayamos recopilado sobre ti',
                  '• Presentar quejas ante la Superintendencia de Industria y Comercio (SIC)',
                ]),
                _buildSection('5. Compartir información', [
                  'No vendemos ni alquilamos tu información personal. Podemos compartir datos con:',
                  '• Domiciliarios para la entrega de pedidos (nombre, dirección, teléfono)',
                  '• Proveedores de servicios de pago para procesar transacciones',
                  '• Autoridades competentes cuando sea requerido por ley',
                ]),
                _buildSection('6. Seguridad de los datos', [
                  'Implementamos medidas de seguridad técnicas, administrativas y organizativas para proteger tu información personal contra acceso no autorizado, alteración, divulgación o destrucción.',
                ]),
                _buildSection('7. Cookies y tecnologías similares', [
                  'Nuestra aplicación puede utilizar cookies y tecnologías similares para:',
                  '• Recordar tus preferencias y sesión',
                  '• Analizar el uso de la aplicación',
                  '• Personalizar tu experiencia',
                ]),
                _buildSection('8. Contacto', [
                  'Para ejercer tus derechos o consultas sobre esta política, contáctanos:',
                  '• Correo: ${AppStrings.businessEmail}',
                  '• Teléfono: ${AppStrings.businessPhone}',
                  '• Dirección: ${AppStrings.businessAddress}, ${AppStrings.businessCity}',
                  '• Horario de atención: ${AppStrings.businessHours}',
                ]),
                const SizedBox(height: 16),
              ],
            ),
          ),
          if (!_alreadyAccepted) _buildAcceptButton(),
          if (_alreadyAccepted)
            Container(
              padding: const EdgeInsets.all(16),
              color: AppColors.surface,
              child: Row(
                children: [
                  const Icon(Icons.verified, color: AppColors.success),
                  const SizedBox(width: 8),
                  const Text(
                    'Ya aceptaste esta política',
                    style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<String> contents) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.primaryDark)),
          const SizedBox(height: 8),
          ...contents.map((content) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              content,
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: content.startsWith('•') ? AppColors.textPrimary : AppColors.textSecondary,
                fontWeight: content.startsWith('•') ? FontWeight.normal : FontWeight.normal,
              ),
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildAcceptButton() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [BoxShadow(blurRadius: 8, offset: const Offset(0, -2), color: Colors.black.withOpacity(0.08))],
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _acceptPolicy,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _isLoading
                ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Aceptar política de privacidad', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}
