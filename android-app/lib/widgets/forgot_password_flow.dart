import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'app_button.dart';
import 'futuristic_modal.dart';

/// Flujo "olvidé mi contraseña": pide correo → código de 6 dígitos (vence en
/// 5 min) → nueva contraseña. Vive dentro de una sola ventana emergente
/// futurista (mismo componente compartido en toda la app).
Future<void> showForgotPasswordFlow(BuildContext context) {
  return showFuturisticModal(context, builder: (_) => const _ForgotPasswordModal());
}

enum _Step { email, code, done }

class _ForgotPasswordModal extends StatefulWidget {
  const _ForgotPasswordModal();
  @override
  State<_ForgotPasswordModal> createState() => _ForgotPasswordModalState();
}

class _ForgotPasswordModalState extends State<_ForgotPasswordModal> {
  final _emailCtrl = TextEditingController();
  final _codeCtrl  = TextEditingController();
  final _pwCtrl    = TextEditingController();
  final _pw2Ctrl   = TextEditingController();

  _Step _step = _Step.email;
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _codeCtrl.dispose();
    _pwCtrl.dispose();
    _pw2Ctrl.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    final email = _emailCtrl.text.trim();
    if (!RegExp(r'^[\w.+\-]+@[\w\-]+\.[a-z]{2,}$').hasMatch(email)) {
      setState(() => _error = 'Correo inválido');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ApiService.forgotPassword(email);
      if (mounted) setState(() { _step = _Step.code; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceAll('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _confirmReset() async {
    final code = _codeCtrl.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'El código tiene 6 dígitos');
      return;
    }
    if (_pwCtrl.text.length < 8) {
      setState(() => _error = 'La contraseña debe tener mínimo 8 caracteres');
      return;
    }
    if (_pwCtrl.text != _pw2Ctrl.text) {
      setState(() => _error = 'Las contraseñas no coinciden');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await ApiService.resetPassword(_emailCtrl.text.trim(), code, _pwCtrl.text);
      if (mounted) setState(() { _step = _Step.done; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceAll('Exception: ', ''); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FuturisticModalCard(
      child: AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const ModalCloseButton(),
          Icon(
            _step == _Step.done ? Icons.verified_rounded : Icons.lock_reset_rounded,
            size: 40, color: scheme.primary,
          ),
          const SizedBox(height: 10),
          Text(
            switch (_step) {
              _Step.email => 'Recuperar contraseña',
              _Step.code  => 'Verifica tu correo',
              _Step.done  => '¡Contraseña actualizada!',
            },
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: Color(0xFF1A1A1A)),
          ),
          const SizedBox(height: 6),
          Text(
            switch (_step) {
              _Step.email => 'Ingresa el correo con el que te registraste. Te enviaremos un código de verificación.',
              _Step.code  => 'Enviamos un código de 6 dígitos a ${_emailCtrl.text.trim()}. Vence en 5 minutos.',
              _Step.done  => 'Ya puedes iniciar sesión con tu nueva contraseña.',
            },
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: Colors.black54),
          ),
          const SizedBox(height: 20),

          if (_step == _Step.email) ..._buildEmailStep(scheme),
          if (_step == _Step.code)  ..._buildCodeStep(scheme),

          if (_error != null) Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF0F0),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFFCDD2)),
              ),
              child: Row(children: [
                const Icon(Icons.info_outline_rounded, color: Color(0xFFD32F2F), size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(_error!, style: const TextStyle(color: Color(0xFFD32F2F), fontSize: 13))),
              ]),
            ),
          ),
          const SizedBox(height: 16),

          if (_step == _Step.email)
            AppButton(label: 'Enviar código', loading: _loading, icon: Icons.send_rounded,
              onPressed: _loading ? null : _requestCode),
          if (_step == _Step.code)
            AppButton(label: 'Cambiar contraseña', loading: _loading, icon: Icons.check_circle_outline_rounded,
              onPressed: _loading ? null : _confirmReset),
          if (_step == _Step.done)
            AppButton(label: 'Ir a iniciar sesión', icon: Icons.login_rounded,
              onPressed: () => Navigator.of(context).maybePop()),

          if (_step == _Step.code) Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Center(child: TextButton(
              onPressed: _loading ? null : () => setState(() { _step = _Step.email; _error = null; }),
              child: const Text('¿No te llegó? Volver a enviar', style: TextStyle(fontSize: 12)),
            )),
          ),
        ]),
      ),
    );
  }

  List<Widget> _buildEmailStep(ColorScheme scheme) => [
    TextField(
      controller: _emailCtrl,
      keyboardType: TextInputType.emailAddress,
      autocorrect: false,
      onSubmitted: (_) => _requestCode(),
      decoration: InputDecoration(
        labelText: 'Correo electrónico',
        prefixIcon: Icon(Icons.email_outlined, color: scheme.primary, size: 20),
        filled: true, fillColor: const Color(0xFFF8FAF8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: scheme.primary, width: 1.8)),
      ),
    ),
  ];

  List<Widget> _buildCodeStep(ColorScheme scheme) => [
    TextField(
      controller: _codeCtrl,
      keyboardType: TextInputType.number,
      maxLength: 6,
      textAlign: TextAlign.center,
      style: const TextStyle(fontSize: 24, letterSpacing: 10, fontWeight: FontWeight.w700),
      decoration: InputDecoration(
        counterText: '',
        hintText: '000000',
        filled: true, fillColor: const Color(0xFFF8FAF8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: scheme.primary, width: 1.8)),
      ),
    ),
    const SizedBox(height: 12),
    TextField(
      controller: _pwCtrl,
      obscureText: _obscure,
      decoration: InputDecoration(
        labelText: 'Nueva contraseña',
        prefixIcon: Icon(Icons.lock_outline_rounded, color: scheme.primary, size: 20),
        suffixIcon: IconButton(
          icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: Colors.grey.shade400),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
        filled: true, fillColor: const Color(0xFFF8FAF8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: scheme.primary, width: 1.8)),
      ),
    ),
    const SizedBox(height: 12),
    TextField(
      controller: _pw2Ctrl,
      obscureText: _obscure,
      onSubmitted: (_) => _confirmReset(),
      decoration: InputDecoration(
        labelText: 'Confirmar contraseña',
        prefixIcon: Icon(Icons.lock_outline_rounded, color: scheme.primary, size: 20),
        filled: true, fillColor: const Color(0xFFF8FAF8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: scheme.primary, width: 1.8)),
      ),
    ),
  ];
}
