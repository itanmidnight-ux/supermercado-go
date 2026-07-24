import 'package:flutter/material.dart';

/// Envoltorio reutilizable que agrega un "bounce" sutil (escala 0.94) a
/// cualquier widget al tocarlo -- mismo mecanismo que ya usa AppButton,
/// disponible para envolver íconos, tarjetas o cualquier zona clickeable
/// que solo tuviera el ripple por defecto de Material.
class AnimatedTapScale extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scaleDown;

  const AnimatedTapScale({
    super.key,
    required this.child,
    required this.onTap,
    this.scaleDown = 0.90,
  });

  @override
  State<AnimatedTapScale> createState() => _AnimatedTapScaleState();
}

class _AnimatedTapScaleState extends State<AnimatedTapScale> {
  double _scale = 1.0;
  void _set(bool pressed) =>
      setState(() => _scale = pressed ? widget.scaleDown : 1.0);

  @override
  Widget build(BuildContext context) {
    final disabled = widget.onTap == null;
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: disabled ? null : (_) => _set(true),
      onTapUp: disabled ? null : (_) => _set(false),
      onTapCancel: disabled ? null : () => _set(false),
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
