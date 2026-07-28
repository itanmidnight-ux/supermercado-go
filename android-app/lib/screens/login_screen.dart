import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/guest_cart_service.dart';
import '../widgets/app_button.dart';
import '../widgets/app_logo.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _loading = false;
  bool _obscure = true;
  String? _error;

  late final AnimationController _enterCtrl;
  late final AnimationController _particleCtrl;
  late final AnimationController _glowCtrl;
  late final AnimationController _shakeCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;
  late final Animation<double> _shakeAnim;
  late final Animation<double> _glowAnim;

  int _logoTaps = 0;
  String _serverUrl = ApiService.serverUrl;

  @override
  void initState() {
    super.initState();
    _enterCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200));
    _particleCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 20000))
      ..repeat();
    _glowCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 3000))
      ..repeat(reverse: true);
    _shakeCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));

    _fadeAnim = CurvedAnimation(
        parent: _enterCtrl,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOut));
    _slideAnim = Tween<Offset>(
            begin: const Offset(0, 0.3), end: Offset.zero)
        .animate(CurvedAnimation(
            parent: _enterCtrl,
            curve: const Interval(0.2, 0.8, curve: Curves.easeOutCubic)));
    _shakeAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -12, end: 12), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 12, end: -8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -8, end: 8), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeCtrl, curve: Curves.easeInOut));
    _glowAnim = Tween<double>(begin: 0.3, end: 0.8).animate(
        CurvedAnimation(parent: _glowCtrl, curve: Curves.easeInOut));

    _enterCtrl.forward();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final saved = await ApiService.loadCredentials();
    if (saved.isNotEmpty && mounted) {
      setState(() => _userCtrl.text = saved);
    }
    _serverUrl = ApiService.serverUrl;
    if (mounted) setState(() {});
  }

  void _onLogoTap() {
    _logoTaps++;
    if (_logoTaps >= 7) {
      _logoTaps = 0;
      _showServerDialog();
    }
  }

  Future<void> _showServerDialog() async {
    final primary = Theme.of(context).colorScheme.primary;
    final ctrl = TextEditingController(text: _serverUrl);
    final result = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(children: [
          Icon(Icons.dns_rounded, color: primary),
          const SizedBox(width: 8),
          const Text('Configuración del servidor'),
        ]),
        content: StatefulBuilder(builder: (context, setDialogState) {
          final text = ctrl.text.trim();
          final looksInsecure = text.isNotEmpty && !text.startsWith('https://');
          return TextField(
            controller: ctrl,
            keyboardType: TextInputType.url,
            autocorrect: false,
            onChanged: (_) => setDialogState(() {}),
            decoration: InputDecoration(
              hintText: 'https://tu-dominio.com',
              // Sin fillColor/border propios: hereda el inputDecorationTheme
              // central de AppTheme (antes lo pisaba con un gris fijo).
              helperText: looksInsecure
                  ? 'Debe empezar con https:// -- el sistema bloquea http:// (network_security_config)'
                  : null,
              helperMaxLines: 2,
            ),
          );
        }),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancelar')),
          FilledButton(
            onPressed: () => Navigator.pop(context, ctrl.text.trim()),
            child: const Text('Guardar'),
          ),
        ],
      ),
    );
    if (result != null && result.isNotEmpty) {
      await ApiService.setServerUrl(result);
      if (mounted) setState(() => _serverUrl = result);
    }
  }

  @override
  void dispose() {
    _enterCtrl.dispose();
    _particleCtrl.dispose();
    _glowCtrl.dispose();
    _shakeCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final user = _userCtrl.text.trim();
    final pass = _passCtrl.text;
    if (user.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Completa todos los campos');
      _shakeCtrl.forward(from: 0);
      HapticFeedback.lightImpact();
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AppProvider>().login(user, pass);
      await GuestCartService.mergeIntoServerCart();
      if (context.mounted) await context.read<ThemeProvider>().load();
      await ApiService.saveCredentials(user);
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } catch (_) {
      HapticFeedback.mediumImpact();
      if (mounted) {
        setState(() => _error = 'Credenciales incorrectas');
        _shakeCtrl.forward(from: 0);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    final w = MediaQuery.of(context).size.width;
    final scheme = Theme.of(context).colorScheme;
    final isDesktop = w >= 768;
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(0xFF0A1A0A),
      body: Stack(children: [
        // Animated gradient background
        AnimatedBuilder(
          animation: _glowCtrl,
          builder: (_, __) => Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(
                    -0.3 + _glowAnim.value * 0.6,
                    -0.2 + _glowAnim.value * 0.4),
                radius: 1.5,
                colors: const [
                  Color(0xFF1A3A1A),
                  Color(0xFF0D200D),
                  Color(0xFF071207),
                  Color(0xFF040A04),
                ],
              ),
            ),
          ),
        ),

        // Floating particles
        Positioned.fill(
          child: AnimatedBuilder(
            animation: _particleCtrl,
            builder: (_, __) => CustomPaint(painter: _ParticlePainter(_particleCtrl.value)),
          ),
        ),

        // Decorative mesh circles
        Positioned(
          top: -h * 0.15,
          right: -w * 0.2,
          child: Container(
            width: w * 0.5,
            height: w * 0.5,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                  color: const Color(0xFF2E7D32).withValues(alpha: 0.06),
                  width: 1),
            ),
          ),
        ),
        Positioned(
          bottom: -h * 0.2,
          left: -w * 0.15,
          child: Container(
            width: w * 0.6,
            height: w * 0.6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                  color: const Color(0xFF4CAF50).withValues(alpha: 0.04),
                  width: 1),
            ),
          ),
        ),

        // Main content
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: isDesktop ? 420 : 400),
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(height: topPadding > 20 ? 20 : 40),

                          // Logo with animated glow
                          GestureDetector(
                            onTap: _onLogoTap,
                            child: AnimatedBuilder(
                              animation: _glowCtrl,
                              builder: (_, __) => Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: scheme.primary
                                          .withValues(alpha: _glowAnim.value * 0.3),
                                      blurRadius: 40 + _glowAnim.value * 20,
                                      spreadRadius: 5,
                                    ),
                                  ],
                                ),
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                        color: scheme.primary.withValues(alpha: 0.5),
                                        width: 2),
                                  ),
                                  child: const AppLogo(size: 72),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Brand name
                          ShaderMask(
                            shaderCallback: (bounds) => LinearGradient(
                              colors: [
                                scheme.primary,
                                const Color(0xFF81C784),
                                scheme.primary,
                              ],
                            ).createShader(bounds),
                            child: const Text(
                              'SUPERMERCADO GO',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 4),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Tu tienda de confianza en Cúcuta',
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.45),
                                fontSize: 13,
                                fontWeight: FontWeight.w400,
                                letterSpacing: 0.5),
                          ),
                          const SizedBox(height: 40),

                          // Frosted glass login card
                          AnimatedBuilder(
                            animation: _shakeAnim,
                            builder: (_, child) => Transform.translate(
                              offset: Offset(_shakeAnim.value, 0),
                              child: child,
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(24),
                              child: BackdropFilter(
                                filter:
                                    ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                                child: Container(
                                  padding: const EdgeInsets.all(28),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.06),
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(
                                        color: Colors.white
                                            .withValues(alpha: 0.1),
                                        width: 1),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black
                                            .withValues(alpha: 0.4),
                                        blurRadius: 40,
                                        offset: const Offset(0, 20),
                                      ),
                                    ],
                                  ),
                                  child: Form(
                                    key: _formKey,
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          // Welcome text
                                          Row(children: [
                                            Container(
                                              width: 40,
                                              height: 40,
                                              decoration: BoxDecoration(
                                                color: scheme.primary
                                                    .withValues(alpha: 0.15),
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                              ),
                                              child: Icon(
                                                  Icons.admin_panel_settings_rounded,
                                                  color: scheme.primary,
                                                  size: 22),
                                            ),
                                            const SizedBox(width: 12),
                                            const Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text('Panel de Administración',
                                                      style: TextStyle(
                                                          color: Colors.white,
                                                          fontSize: 17,
                                                          fontWeight:
                                                              FontWeight.w700)),
                                                  Text(
                                                      'Acceso restringido al administrador',
                                                      style: TextStyle(
                                                          color: Colors.white38,
                                                          fontSize: 11)),
                                                ]),
                                          ]),
                                          const SizedBox(height: 28),

                                          // Security indicator
                                          Container(
                                            margin:
                                                const EdgeInsets.only(bottom: 20),
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 12, vertical: 8),
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors: [
                                                  const Color(0xFF2E7D32)
                                                      .withValues(alpha: 0.12),
                                                  const Color(0xFF1565C0)
                                                      .withValues(alpha: 0.08),
                                                ],
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              border: Border.all(
                                                  color: const Color(0xFF2E7D32)
                                                      .withValues(alpha: 0.2)),
                                            ),
                                            child: Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Icon(Icons.lock_rounded,
                                                      size: 13,
                                                      color: scheme.primary),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    'Conexión segura · HTTPS · Cifrado AES-256',
                                                    style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w600,
                                                        color: Colors.white
                                                            .withValues(
                                                                alpha: 0.5)),
                                                  ),
                                                ]),
                                          ),

                                          // Username field
                                          _buildField(
                                            controller: _userCtrl,
                                            label: 'Usuario',
                                            hint: 'admin',
                                            icon: Icons.person_outline_rounded,
                                            action: TextInputAction.next,
                                          ),
                                          const SizedBox(height: 14),

                                          // Password field
                                          _buildField(
                                            controller: _passCtrl,
                                            label: 'Contraseña',
                                            hint: '••••••••',
                                            icon: Icons.lock_outline_rounded,
                                            obscure: _obscure,
                                            onToggle: () => setState(
                                                () => _obscure = !_obscure),
                                            action: TextInputAction.done,
                                            onSubmit: (_) {
                                              if (!_loading) _login();
                                            },
                                          ),
                                          const SizedBox(height: 10),

                                          // Error message
                                          AnimatedSize(
                                            duration: const Duration(
                                                milliseconds: 250),
                                            child: _error != null
                                                ? Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            top: 8),
                                                    child: Container(
                                                      padding: const EdgeInsets
                                                          .symmetric(
                                                          horizontal: 14,
                                                          vertical: 10),
                                                      decoration: BoxDecoration(
                                                        color: const Color(
                                                            0x18F44336),
                                                        borderRadius:
                                                            BorderRadius
                                                                .circular(12),
                                                        border: Border.all(
                                                            color: const Color(
                                                                0x30F44336)),
                                                      ),
                                                      child: Row(children: [
                                                        const Icon(
                                                            Icons
                                                                .error_outline_rounded,
                                                            color: Color(
                                                                0xFFEF5350),
                                                            size: 18),
                                                        const SizedBox(
                                                            width: 8),
                                                        Expanded(
                                                            child: Text(
                                                                _error!,
                                                                style: const TextStyle(
                                                                    color: Color(
                                                                        0xFFEF5350),
                                                                    fontSize:
                                                                        13))),
                                                      ]),
                                                    ),
                                                  )
                                                : const SizedBox.shrink(),
                                          ),
                                          const SizedBox(height: 20),

                                          // Login button
                                          SizedBox(
                                            height: 52,
                                            child: AppButton(
                                              label: _loading
                                                  ? 'Verificando...'
                                                  : 'Ingresar',
                                              onPressed:
                                                  _loading ? null : _login,
                                              loading: _loading,
                                              icon: Icons
                                                  .arrow_forward_rounded,
                                            ),
                                          ),
                                          const SizedBox(height: 16),

                                          // Trust indicators
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceEvenly,
                                            children: [
                                              _TrustIndicator(
                                                  icon: Icons
                                                      .shield_outlined,
                                                  label: 'SSL',
                                                  anim: _glowAnim),
                                              _TrustIndicator(
                                                  icon: Icons
                                                      .verified_user_outlined,
                                                  label: 'Cifrado',
                                                  anim: _glowAnim),
                                              _TrustIndicator(
                                                  icon: Icons
                                                      .speed_rounded,
                                                  label: 'Rápido',
                                                  anim: _glowAnim),
                                            ],
                                          ),
                                        ]),
                                  ),
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 32),

                          // Footer
                          Text('v2.0 — Supermercado GO © 2026',
                              style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  fontSize: 10)),
                          const SizedBox(height: 40),
                        ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscure = false,
    VoidCallback? onToggle,
    TextInputAction action = TextInputAction.next,
    void Function(String)? onSubmit,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      autocorrect: false,
      textCapitalization: TextCapitalization.none,
      textInputAction: action,
      onSubmitted: onSubmit,
      style: const TextStyle(fontSize: 15, color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle:
            TextStyle(color: Colors.white.withValues(alpha: 0.25), fontSize: 14),
        prefixIcon: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Icon(icon, size: 20, color: Colors.white.withValues(alpha: 0.5)),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 50),
        suffixIcon: onToggle != null
            ? IconButton(
                icon: Icon(
                    obscure
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    size: 20,
                    color: Colors.white.withValues(alpha: 0.4)),
                onPressed: onToggle)
            : null,
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.05),
        labelStyle:
            TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14),
        floatingLabelStyle: TextStyle(
            color: Theme.of(context).colorScheme.primary,
            fontSize: 13,
            fontWeight: FontWeight.w600),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide:
                BorderSide(color: Colors.white.withValues(alpha: 0.08))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide:
                BorderSide(color: Colors.white.withValues(alpha: 0.08))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(
                color: Theme.of(context).colorScheme.primary, width: 1.5)),
        contentPadding:
            const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      ),
    );
  }
}

// ── Particle painter ────────────────────────────────────────────
class _ParticlePainter extends CustomPainter {
  final double progress;
  _ParticlePainter(this.progress);

  static final _particles = List.generate(35, (i) {
    final rnd = math.Random(i * 7 + 3);
    return _Particle(
      x: rnd.nextDouble(),
      y: rnd.nextDouble(),
      r: 1.0 + rnd.nextDouble() * 2.5,
      speed: 0.2 + rnd.nextDouble() * 0.6,
      phase: rnd.nextDouble() * math.pi * 2,
      opacity: 0.03 + rnd.nextDouble() * 0.07,
    );
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in _particles) {
      final dx = p.x * size.width + math.sin(progress * 2 * math.pi + p.phase) * 20;
      final dy =
          ((p.y - progress * p.speed * 0.3) % 1.0) * size.height;
      paint.color = (Color.lerp(
          const Color(0xFF4CAF50), const Color(0xFF81C784), p.x) ?? const Color(0xFF4CAF50))
          .withValues(alpha: p.opacity);
      canvas.drawCircle(Offset(dx, dy), p.r, paint);
    }
  }

  @override
  bool shouldRepaint(_) => true;
}

class _Particle {
  final double x, y, r, speed, phase, opacity;
  const _Particle(
      {required this.x,
      required this.y,
      required this.r,
      required this.speed,
      required this.phase,
      required this.opacity});
}

// ── Trust indicator ────────────────────────────────────────────
class _TrustIndicator extends StatelessWidget {
  final IconData icon;
  final String label;
  final Animation<double> anim;
  const _TrustIndicator(
      {required this.icon, required this.label, required this.anim});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: anim,
      builder: (_, __) => Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFF2E7D32)
                .withValues(alpha: 0.08 + anim.value * 0.04),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color: const Color(0xFF2E7D32)
                    .withValues(alpha: 0.15 + anim.value * 0.1)),
          ),
          child: Icon(icon,
              color: const Color(0xFF81C784).withValues(alpha: 0.6 + anim.value * 0.2),
              size: 18),
        ),
        const SizedBox(height: 4),
        Text(label,
            style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF81C784)
                    .withValues(alpha: 0.5 + anim.value * 0.2))),
      ]),
    );
  }
}
