import 'dart:ui';
import 'package:flutter/material.dart';

/// Ventana emergente compartida por toda la app: fondo desenfocado y
/// oscurecido con animación de entrada/salida, tarjeta con bordes curvos.
/// Se cierra tocando fuera de la tarjeta o con el botón atrás del
/// dispositivo (ambos ya vienen gratis de ModalRoute/Navigator).
Future<T?> showFuturisticModal<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool barrierDismissible = true,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: 'Cerrar',
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 380),
    pageBuilder: (ctx, anim, secAnim) => builder(ctx),
    transitionBuilder: (ctx, anim, secAnim, child) {
      final t = CurvedAnimation(parent: anim, curve: Curves.easeOutCubic).value;
      return Stack(children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: barrierDismissible ? () => Navigator.of(ctx).maybePop() : null,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 14 * t, sigmaY: 14 * t),
              child: Container(color: const Color(0xFF040912).withValues(alpha: 0.55 * t)),
            ),
          ),
        ),
        FadeTransition(
          opacity: CurvedAnimation(parent: anim, curve: Curves.easeOut),
          child: ScaleTransition(
            scale: Tween(begin: 0.90, end: 1.0)
                .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
            child: GestureDetector(
              onTap: () {}, // absorbe el tap para que no cierre el modal al tocar la tarjeta
              child: child,
            ),
          ),
        ),
      ]);
    },
  );
}

/// Tarjeta base con bordes curvos + resplandor sutil para el contenido de
/// una ventana emergente futurista. maxWidth se adapta a cualquier
/// resolución (celular, tablet, TV, escritorio) sin desbordarse.
class FuturisticModalCard extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry padding;
  final BorderRadius borderRadius;

  const FuturisticModalCard({
    super.key,
    required this.child,
    this.maxWidth = 440,
    this.padding = const EdgeInsets.all(24),
    this.borderRadius = const BorderRadius.all(Radius.circular(28)),
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final screenW = MediaQuery.of(context).size.width;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: maxWidth,
          maxHeight: MediaQuery.of(context).size.height * 0.86,
        ),
        child: Container(
          margin: EdgeInsets.symmetric(horizontal: screenW < 380 ? 14 : 22),
          padding: padding,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: borderRadius,
            border: Border.all(color: scheme.primary.withValues(alpha: 0.14), width: 1.2),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 40, offset: const Offset(0, 20)),
              BoxShadow(color: scheme.primary.withValues(alpha: 0.18), blurRadius: 60),
            ],
          ),
          child: Material(type: MaterialType.transparency, child: child),
        ),
      ),
    );
  }
}

/// Botón de cierre circular estándar para la esquina de una tarjeta modal.
class ModalCloseButton extends StatelessWidget {
  const ModalCloseButton({super.key});

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.topRight,
    child: IconButton(
      onPressed: () => Navigator.of(context).maybePop(),
      icon: const Icon(Icons.close_rounded),
      style: IconButton.styleFrom(
        backgroundColor: Colors.black.withValues(alpha: 0.05),
        shape: const CircleBorder(),
      ),
    ),
  );
}
