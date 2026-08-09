import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/server_config_dialog.dart';
import '../../utils/constants.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => LoginScreenState();
}

class LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passController = TextEditingController();
  bool _obscure = true;
  bool _rememberMe = false;
  int _failedAttempts = 0;
  int _cooldownRemaining = 0;
  Timer? _cooldownTimer;

  // Gradient animation
  late AnimationController _gradientCtrl;
  // Bounce animation for logo
  late AnimationController _bounceCtrl;
  late Animation<double> _bounceAnim;

  @override
  void initState() {
    super.initState();
    _loadSavedEmail();
    _gradientCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();
    _bounceCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));
    _bounceAnim = Tween<double>(begin: -40, end: 0).animate(CurvedAnimation(parent: _bounceCtrl, curve: Curves.elasticOut));
    _bounceCtrl.forward();
  }

  Future<void> _loadSavedEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('remembered_email');
    if (saved != null && saved.isNotEmpty && mounted) {
      setState(() { _emailController.text = saved; _rememberMe = true; });
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passController.dispose();
    _cooldownTimer?.cancel();
    _gradientCtrl.dispose();
    _bounceCtrl.dispose();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldownRemaining = 30);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) { timer.cancel(); return; }
      setState(() {
        _cooldownRemaining--;
        if (_cooldownRemaining <= 0) { timer.cancel(); _failedAttempts = 0; }
      });
    });
  }

  Future<void> _login() async {
    if (_cooldownRemaining > 0) return;
    if (!_formKey.currentState!.validate()) return;
    if (_rememberMe) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('remembered_email', _emailController.text.trim());
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('remembered_email');
    }
    final auth = context.read<AuthProvider>();
    final success = await auth.login(_emailController.text.trim(), _passController.text);
    if (!mounted) return;
    if (success) {
      _failedAttempts = 0;
      if (auth.mustChangePassword) {
        _showChangePassword(auth);
      } else {
        Navigator.pushReplacementNamed(context, auth.getHomeRoute());
      }
    } else {
      setState(() => _failedAttempts++);
      if (_failedAttempts >= 5) {
        _startCooldown();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Demasiados intentos. Espera 30 segundos.'), backgroundColor: AppColors.error, duration: Duration(seconds: 3)),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Credenciales incorrectas'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _forgotPassword() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresa tu correo primero'), backgroundColor: AppColors.error));
      return;
    }
    try {
      final sp = context.read<SettingsProvider>();
      final resp = await http.post(
        Uri.parse('${sp.serverUrl}/api/auth/forgot-password'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );
      if (resp.statusCode == 200 || resp.statusCode == 204) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Se enviaron instrucciones a tu correo'), backgroundColor: AppColors.primary));
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se encontró una cuenta con ese correo'), backgroundColor: AppColors.error));
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Error de conexión'), backgroundColor: AppColors.error));
    }
  }

  // Password strength: 0=empty, 1=weak, 2=fair, 3=good, 4=strong
  int _passwordStrength(String pass) {
    if (pass.isEmpty) return 0;
    int score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (RegExp(r'[0-9]').hasMatch(pass)) score++;
    if (RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(pass)) score++;
    return score;
  }

  String _strengthLabel(int s) {
    switch (s) {
      case 1: return 'Débil';
      case 2: return 'Regular';
      case 3: return 'Buena';
      case 4: return 'Fuerte';
      default: return '';
    }
  }

  Color _strengthColor(int s) {
    switch (s) {
      case 1: return AppColors.error;
      case 2: return AppColors.accent;
      case 3: return AppColors.gold;
      case 4: return AppColors.success;
      default: return AppColors.lightGray;
    }
  }

  Widget _buildStrengthBar(int strength) {
    if (strength == 0) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 6),
      Row(children: List.generate(4, (i) => Expanded(
        child: Container(
          height: 4, margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: i < strength ? _strengthColor(strength) : AppColors.lightGray),
        ),
      ))),
      const SizedBox(height: 4),
      Text(_strengthLabel(strength), style: TextStyle(fontSize: 11, color: _strengthColor(strength), fontWeight: FontWeight.w500)),
    ]);
  }

  void _showChangePassword(AuthProvider auth) {
    final newPassCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    bool obscureNew = true;
    bool obscureConf = true;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('Cambiar Contraseña'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: newPassCtrl, obscureText: obscureNew, decoration: InputDecoration(labelText: 'Nueva contraseña (mínimo 6 caracteres)', prefixIcon: const Icon(Icons.lock_outlined), suffixIcon: IconButton(icon: Icon(obscureNew ? Icons.visibility_off : Icons.visibility), onPressed: () => setDlg(() => obscureNew = !obscureNew))), onChanged: (_) => setDlg(() {})),
            _buildStrengthBar(_passwordStrength(newPassCtrl.text)),
            const SizedBox(height: 12),
            TextField(controller: confirmCtrl, obscureText: obscureConf, decoration: InputDecoration(labelText: 'Confirmar contraseña', prefixIcon: const Icon(Icons.lock_outlined), suffixIcon: IconButton(icon: Icon(obscureConf ? Icons.visibility_off : Icons.visibility), onPressed: () => setDlg(() => obscureConf = !obscureConf)))),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                if (newPassCtrl.text.length < 6) return;
                if (newPassCtrl.text != confirmCtrl.text) return;
                final ok = await auth.changePassword(_passController.text, newPassCtrl.text);
                if (ctx.mounted) Navigator.pop(ctx);
                if (ok && mounted) Navigator.pushReplacementNamed(context, auth.getHomeRoute());
              },
              child: const Text('Cambiar'),
            ),
          ],
        ),
      ),
    );
  }

  void _showRegisterDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    bool acceptPrivacy = false;
    bool obscurePass = true;
    bool obscureConf = true;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('Crear Cuenta', style: TextStyle(color: AppColors.primary)),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nombre completo', prefixIcon: Icon(Icons.person_outline))),
              const SizedBox(height: 10),
              TextField(controller: emailCtrl, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo electrónico', prefixIcon: Icon(Icons.email_outlined))),
              const SizedBox(height: 10),
              TextField(controller: phoneCtrl, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Teléfono (+57...)', prefixIcon: Icon(Icons.phone_outlined))),
              const SizedBox(height: 10),
              TextField(controller: passCtrl, obscureText: obscurePass, decoration: InputDecoration(
                labelText: 'Contraseña (mínimo 6)',
                prefixIcon: const Icon(Icons.lock_outlined),
                suffixIcon: IconButton(icon: Icon(obscurePass ? Icons.visibility_off : Icons.visibility), onPressed: () => setDialog(() => obscurePass = !obscurePass)),
              ), onChanged: (_) => setDialog(() {})),
              _buildStrengthBar(_passwordStrength(passCtrl.text)),
              const SizedBox(height: 10),
              TextField(controller: confirmCtrl, obscureText: obscureConf, decoration: InputDecoration(
                labelText: 'Confirmar contraseña',
                prefixIcon: const Icon(Icons.lock_outlined),
                suffixIcon: IconButton(icon: Icon(obscureConf ? Icons.visibility_off : Icons.visibility), onPressed: () => setDialog(() => obscureConf = !obscureConf)),
              )),
              const SizedBox(height: 8),
              Row(children: [
                SizedBox(width: 24, height: 24, child: Checkbox(value: acceptPrivacy, onChanged: (v) => setDialog(() => acceptPrivacy = v ?? false))),
                Expanded(child: GestureDetector(onTap: () => Navigator.pushNamed(context, '/privacy'), child: const Text('Acepto la política de privacidad', style: TextStyle(fontSize: 12, color: AppColors.primary, decoration: TextDecoration.underline)))),
              ]),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
            ElevatedButton(
              onPressed: () async {
                if (nameCtrl.text.trim().isEmpty || emailCtrl.text.trim().isEmpty || phoneCtrl.text.trim().isEmpty || passCtrl.text.length < 6) return;
                if (passCtrl.text != confirmCtrl.text) return;
                if (!acceptPrivacy) return;
                final auth = context.read<AuthProvider>();
                final ok = await auth.register(nameCtrl.text.trim(), emailCtrl.text.trim(), phoneCtrl.text.trim(), passCtrl.text);
                if (ctx.mounted) Navigator.pop(ctx);
                if (ok && mounted) Navigator.pushReplacementNamed(context, auth.getHomeRoute());
              },
              child: const Text('Registrarse'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLocked = _cooldownRemaining > 0;
    return Scaffold(
      body: AnimatedBuilder(
        animation: _gradientCtrl,
        builder: (context, _) {
          final t = _gradientCtrl.value;
          final color1 = Color.lerp(AppColors.primary, AppColors.primaryDark, t)!;
          final color2 = Color.lerp(AppColors.primaryDark, const Color(0xFF0E9B52), t)!;
          final color3 = Color.lerp(const Color(0xFF0E9B52), AppColors.primary, t)!;
          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color1, color2, color3],
              ),
            ),
            child: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedBuilder(
                          animation: _bounceCtrl,
                          builder: (_, child) {
                            final offset = _bounceAnim.value;
                            return Transform.translate(
                              offset: Offset(0, offset < 0 ? offset : 0),
                              child: Opacity(opacity: _bounceCtrl.isCompleted ? 1.0 : (_bounceCtrl.value * 2).clamp(0.0, 1.0)),
                                child: Container(
                                  width: 90, height: 90,
                                  decoration: const BoxDecoration(
                                    color: Colors.white,
                                    shape: BoxShape.circle,
                                    boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 16, offset: Offset(0, 6))],
                                  ),
                                  child: const Icon(Icons.shopping_bag, size: 44, color: AppColors.primary),
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 20),
                        const Text(AppStrings.appName, style: TextStyle(fontSize: 30, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5)),
                        const SizedBox(height: 6),
                        const Text(AppStrings.tagline, style: TextStyle(color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 24),
                        // Failed attempts warning
                        if (_failedAttempts > 0 && !isLocked)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: _failedAttempts >= 4 ? AppColors.error.withOpacity(0.15) : AppColors.accent.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: (_failedAttempts >= 4 ? AppColors.error : AppColors.accent).withOpacity(0.3)),
                            ),
                            child: Row(children: [
                              Icon(Icons.warning_amber_rounded, color: _failedAttempts >= 4 ? AppColors.error : AppColors.accent, size: 20),
                              const SizedBox(width: 10),
                              Expanded(child: Text(
                                _failedAttempts >= 4
                                    ? 'Último intento antes del bloqueo'
                                    : '${5 - _failedAttempts} intentos restantes antes del bloqueo',
                                style: TextStyle(color: _failedAttempts >= 4 ? AppColors.error : Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                              )),
                            ]),
                          ),
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 16, offset: Offset(0, 4))],
                          ),
                          child: Column(children: [
                            TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(labelText: 'Correo electrónico', prefixIcon: Icon(Icons.email_outlined)),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) return 'Ingresa tu correo';
                                if (!RegExp(r'^[\w\-.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v.trim())) return 'Correo inválido';
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _passController,
                              obscureText: _obscure,
                              decoration: InputDecoration(
                                labelText: 'Contraseña',
                                prefixIcon: const Icon(Icons.lock_outlined),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility),
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => v == null || v.isEmpty ? 'Ingresa tu contraseña' : null,
                              onChanged: (_) => setState(() {}),
                            ),
                            // Password strength for login field
                            if (_passController.text.isNotEmpty) _buildStrengthBar(_passwordStrength(_passController.text)),
                            const SizedBox(height: 8),
                            // Remember me checkbox
                            Row(children: [
                              SizedBox(
                                width: 20, height: 20,
                                child: Checkbox(value: _rememberMe, onChanged: (v) => setState(() => _rememberMe = v ?? false), activeColor: AppColors.primary, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                              ),
                              const SizedBox(width: 6),
                              const Text('Recordar sesión', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            ]),
                            const SizedBox(height: 4),
                            // Forgot password
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: isLocked ? null : _forgotPassword,
                                child: const Text('¿Olvidaste tu contraseña?', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500)),
                                style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 28), tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Consumer<AuthProvider>(builder: (_, auth, __) => SizedBox(
                              width: double.infinity, height: 50,
                              child: ElevatedButton(
                                onPressed: (auth.isLoading || isLocked) ? null : _login,
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 0),
                                child: isLocked
                                    ? Text('Espera ${_cooldownRemaining}s', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600))
                                    : auth.isLoading
                                        ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                                        : const Text('Iniciar Sesión', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                              ),
                            )),
                          ]),
                        ),
                        const SizedBox(height: 16),
                        TextButton(onPressed: _showRegisterDialog, child: const Text('¿No tienes cuenta? Regístrate', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500))),
                        const SizedBox(height: 4),
                        const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(Icons.shield_outlined, color: Colors.white54, size: 14),
                          SizedBox(width: 6),
                          Text('Inicios de sesión seguros', style: TextStyle(color: Colors.white54, fontSize: 12)),
                        ]),
                        const SizedBox(height: 16),
                        // Conectar con servidor button (prominent)
                        OutlinedButton.icon(
                          onPressed: () => ServerConfigDialog.show(context),
                          icon: const Icon(Icons.dns, size: 18),
                          label: const Text('Conectar con servidor', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white54, width: 1.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
