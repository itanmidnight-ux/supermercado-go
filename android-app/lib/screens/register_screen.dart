import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../services/guest_cart_service.dart';
import '../widgets/app_button.dart';
import '../widgets/app_logo.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _pwCtrl = TextEditingController();
  final _pw2Ctrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  bool _loading = false;
  bool _obscure1 = true;
  bool _obscure2 = true;
  String? _error;

  // Computa fortaleza de la contraseña en tiempo real
  int get _pwStrength {
    final pw = _pwCtrl.text;
    if (pw.isEmpty) return 0;
    int score = 0;
    if (pw.length >= 8) score++;
    if (RegExp(r'[A-Z]').hasMatch(pw)) score++;
    if (RegExp(r'[0-9]').hasMatch(pw)) score++;
    if (RegExp(r'[!@#\$%^&*(),.?":{}|<>_\-+=]').hasMatch(pw)) score++;
    return score;
  }

  String get _pwStrengthLabel {
    switch (_pwStrength) {
      case 0: return '';
      case 1: return 'Débil';
      case 2: return 'Aceptable';
      case 3: return 'Buena';
      case 4: return 'Segura';
      default: return '';
    }
  }

  Color get _pwStrengthColor {
    switch (_pwStrength) {
      case 0: return Colors.grey;
      case 1: return const Color(0xFFD32F2F); // rojo
      case 2: return const Color(0xFFEF6C00); // naranja
      case 3: return const Color(0xFFFBC02D); // amarillo
      case 4: return const Color(0xFF2E7D32); // verde
      default: return Colors.grey;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _pwCtrl.dispose();
    _pw2Ctrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final phone = _phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    final password = _pwCtrl.text;
    try {
      // La cuenta queda activa de inmediato (sin aprobación de un admin) --
      // se entra directo en vez de mandar de vuelta a escribir credenciales
      // que la persona acaba de escribir en este mismo formulario. El
      // usuario para el login no lo elige el cliente -- el backend lo
      // deriva del celular (queda "57$phone").
      await ApiService.register(
        phone: phone,
        password: password,
        displayName: _nameCtrl.text.trim(),
        email: _emailCtrl.text.trim(),
        address: _addressCtrl.text.trim(),
      );
      if (!mounted) return;
      await context.read<AppProvider>().login('57$phone', password);
      // Fusiona el carrito de invitado (armado antes de registrarse en el
      // sitio web) con el carrito real del servidor recién creado.
      await GuestCartService.mergeIntoServerCart();
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (e) {
      if (mounted)
        setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hint,
    bool obscure = false,
    VoidCallback? onToggle,
    TextInputType keyboard = TextInputType.text,
    TextCapitalization capitalize = TextCapitalization.sentences,
    TextInputAction action = TextInputAction.next,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    final scheme = Theme.of(context).colorScheme;
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboard,
      textCapitalization: capitalize,
      textInputAction: action,
      maxLines: maxLines,
      validator: validator,
      style: const TextStyle(fontSize: 15),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: scheme.primary, size: 20),
        suffixIcon: onToggle != null
            ? IconButton(
                icon: Icon(
                    obscure
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 20,
                    color: Colors.grey.shade400),
                onPressed: onToggle)
            : null,
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
            borderSide: BorderSide(color: scheme.primary, width: 1.8)),
        errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Colors.red)),
        focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Colors.red, width: 1.8)),
        contentPadding:
            const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        alignLabelWithHint: maxLines > 1,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final greenDark = Color.lerp(scheme.primary, Colors.black, 0.35)!;
    return Scaffold(
      backgroundColor: greenDark,
      appBar: AppBar(
        backgroundColor: greenDark,
        foregroundColor: Colors.white,
        title: const Text('Crear cuenta',
            style: TextStyle(fontWeight: FontWeight.w700)),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          // Mismo límite que login_screen: sin esto, Column(stretch) infla el
          // formulario a todo el ancho de la ventana en tablet/desktop.
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(children: [
                // Header strip
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const AppLogo(size: 44),
                        const SizedBox(height: 8),
                        Text('Supermercado GO',
                            style: TextStyle(
                                color: scheme.secondary,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1)),
                        const SizedBox(height: 4),
                        Text('Regístrate para hacer pedidos',
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 13)),
                      ]),
                ),

                // Form card
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFFF5F5F0),
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(28)),
                  ),
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Security strip
                          Container(
                            margin: const EdgeInsets.only(bottom: 14),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 7),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  const Color(0xFF2E7D32).withValues(alpha: 0.08),
                                  const Color(0xFF1565C0).withValues(alpha: 0.08),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color: const Color(0xFF2E7D32)
                                      .withValues(alpha: 0.2)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.shield_outlined,
                                    size: 14, color: Color(0xFF2E7D32)),
                                const SizedBox(width: 6),
                                Text(
                                  'Tus datos están protegidos con cifrado AES-256',
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.grey.shade700),
                                ),
                              ],
                            ),
                          ),

                          const Text('Información personal',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.black54,
                                  letterSpacing: 0.5)),
                          const SizedBox(height: 12),
                          _field(
                            controller: _nameCtrl,
                            label: 'Nombre completo *',
                            icon: Icons.badge_outlined,
                            capitalize: TextCapitalization.words,
                            validator: (v) => (v == null || v.trim().length < 2)
                                ? 'Mínimo 2 caracteres'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          _field(
                            controller: _phoneCtrl,
                            label: 'Celular *',
                            hint: 'Ej: 3138207044',
                            icon: Icons.phone_android_rounded,
                            capitalize: TextCapitalization.none,
                            keyboard: TextInputType.phone,
                            validator: (v) {
                              final d = (v ?? '').replaceAll(RegExp(r'\D'), '');
                              if (d.length != 10 || !d.startsWith('3')) {
                                return 'Celular colombiano de 10 dígitos (ej: 3138207044)';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          _field(
                            controller: _emailCtrl,
                            label: 'Correo electrónico *',
                            icon: Icons.email_outlined,
                            keyboard: TextInputType.emailAddress,
                            capitalize: TextCapitalization.none,
                            validator: (v) {
                              if (v == null || v.trim().isEmpty)
                                return 'Campo requerido';
                              if (!RegExp(r'^[\w.+\-]+@[\w\-]+\.[a-z]{2,}$')
                                  .hasMatch(v.trim())) {
                                return 'Correo inválido';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),
                          const Text('Contraseña',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.black54,
                                  letterSpacing: 0.5)),
                          const SizedBox(height: 12),
                          _field(
                            controller: _pwCtrl,
                            label: 'Contraseña *',
                            icon: Icons.lock_outline_rounded,
                            obscure: _obscure1,
                            onToggle: () =>
                                setState(() => _obscure1 = !_obscure1),
                            validator: (v) => (v == null || v.length < 8)
                                ? 'Mínimo 8 caracteres'
                                : null,
                          ),

                          // Indicador de fortaleza de contraseña en tiempo real
                          AnimatedBuilder(
                            animation: _pwCtrl,
                            builder: (context, _) =>
                                _PasswordStrengthIndicator(
                              strength: _pwStrength,
                              label: _pwStrengthLabel,
                              color: _pwStrengthColor,
                            ),
                          ),

                          const SizedBox(height: 12),
                          _field(
                            controller: _pw2Ctrl,
                            label: 'Confirmar contraseña *',
                            icon: Icons.lock_outline_rounded,
                            obscure: _obscure2,
                            onToggle: () =>
                                setState(() => _obscure2 = !_obscure2),
                            action: TextInputAction.next,
                            validator: (v) => v != _pwCtrl.text
                                ? 'Las contraseñas no coinciden'
                                : null,
                          ),
                          const SizedBox(height: 20),
                          const Text('Dirección de entrega',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.black54,
                                  letterSpacing: 0.5)),
                          const SizedBox(height: 12),
                          _field(
                            controller: _addressCtrl,
                            label: 'Dirección *',
                            hint: 'Ej: Calle 10 #5-30, Barrio El Prado',
                            icon: Icons.location_on_outlined,
                            maxLines: 2,
                            validator: (v) => (v == null || v.trim().length < 5)
                                ? 'Mínimo 5 caracteres'
                                : null,
                          ),
                          const SizedBox(height: 20),
                          if (_error != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              margin: const EdgeInsets.only(bottom: 14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF0F0),
                                borderRadius: BorderRadius.circular(12),
                                border:
                                    Border.all(color: const Color(0xFFFFCDD2)),
                              ),
                              child: Row(children: [
                                const Icon(Icons.info_outline_rounded,
                                    color: Color(0xFFD32F2F), size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                    child: Text(_error!,
                                        style: const TextStyle(
                                            color: Color(0xFFD32F2F),
                                            fontSize: 13))),
                              ]),
                            ),
                          AppButton(
                            label: 'Crear mi cuenta',
                            onPressed: _loading ? null : _register,
                            loading: _loading,
                            icon: Icons.person_add_rounded,
                          ),
                          const SizedBox(height: 16),
                          Center(
                              child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: Text('¿Ya tienes cuenta? Inicia sesión',
                                style: TextStyle(color: scheme.primary)),
                          )),
                          const SizedBox(height: 8),
                        ]),
                  ),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Password strength indicator ──────────────────────────────────────
class _PasswordStrengthIndicator extends StatelessWidget {
  final int strength; // 0-4
  final String label;
  final Color color;

  const _PasswordStrengthIndicator({
    required this.strength,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    if (strength == 0) return const SizedBox(height: 8);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Barra de 4 segmentos
          Row(
            children: List.generate(4, (i) {
              final filled = i < strength;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: i < 3 ? 3 : 0),
                  decoration: BoxDecoration(
                    color: filled
                        ? color
                        : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                strength >= 3 ? Icons.check_circle : Icons.info_outline,
                size: 12,
                color: color,
              ),
              const SizedBox(width: 5),
              Text(
                'Seguridad: $label',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Una contraseña segura tiene mayúsculas, números y símbolos',
            style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
          ),
        ],
      ),
    );
  }
}
