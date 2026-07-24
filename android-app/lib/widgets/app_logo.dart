import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';

/// Logo de marca reutilizable: usa la imagen real subida por el admin
/// (theme.logoFilename) si existe, o si no un distintivo propio (bolsa +
/// insignia "GO") en vez de un simple ícono plano. Antes cada pantalla
/// (login, registro, home, invitado, header del staff) armaba su propio
/// círculo con Icons.storefront_rounded a mano -- ninguna mostraba el logo
/// real que el admin puede subir desde Configuración, solo company_header.
/// Con esto todas comparten la misma fuente de verdad y el mismo look.
///
/// Entra con una animación de escala+fade -- no es solo un ícono estático.
class AppLogo extends StatefulWidget {
  final double size;
  final Color? badgeColor;
  final Color? iconColor;
  final bool animate;

  const AppLogo({
    super.key,
    this.size = 56,
    this.badgeColor,
    this.iconColor,
    this.animate = true,
  });

  @override
  State<AppLogo> createState() => _AppLogoState();
}

class _AppLogoState extends State<AppLogo> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut);
    _fade = CurvedAnimation(
        parent: _ctrl, curve: const Interval(0, 0.5, curve: Curves.easeOut));
    if (widget.animate) {
      _ctrl.forward();
    } else {
      _ctrl.value = 1.0;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeProvider>();
    final badgeColor = widget.badgeColor ?? theme.primary;
    final accent = theme.accent;
    final iconColor = widget.iconColor ?? Colors.white;
    final logo = theme.logoFilename;

    Widget mark;
    if (logo != null && logo.isNotEmpty) {
      mark = ClipOval(
        child: CachedNetworkImage(
          imageUrl: ApiService.logoUrl(logo),
          width: widget.size,
          height: widget.size,
          fit: BoxFit.cover,
          placeholder: (_, __) =>
              _fallbackMark(widget.size, badgeColor, accent, iconColor),
          errorWidget: (_, __, ___) =>
              _fallbackMark(widget.size, badgeColor, accent, iconColor),
        ),
      );
    } else {
      mark = _fallbackMark(widget.size, badgeColor, accent, iconColor);
    }

    if (!widget.animate) return mark;

    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => Opacity(
        opacity: _fade.value.clamp(0.0, 1.0),
        child: Transform.scale(scale: _scale.value, child: child),
      ),
      child: mark,
    );
  }

  static Widget _fallbackMark(
      double size, Color badgeColor, Color accent, Color iconColor) {
    final badgeSize = size * 0.36;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(clipBehavior: Clip.none, children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [badgeColor, Color.lerp(badgeColor, Colors.black, 0.35)!],
            ),
            boxShadow: [
              BoxShadow(
                  color: badgeColor.withValues(alpha: 0.35),
                  blurRadius: size * 0.25,
                  offset: Offset(0, size * 0.08)),
            ],
          ),
          child: Center(
            child: Icon(Icons.shopping_bag_rounded,
                size: size * 0.52, color: iconColor),
          ),
        ),
        Positioned(
          right: -badgeSize * 0.12,
          bottom: -badgeSize * 0.12,
          child: Container(
            width: badgeSize,
            height: badgeSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: accent,
              border: Border.all(color: Colors.white, width: size * 0.035),
            ),
            child: Icon(Icons.bolt_rounded,
                size: badgeSize * 0.62, color: Colors.white),
          ),
        ),
      ]),
    );
  }
}
