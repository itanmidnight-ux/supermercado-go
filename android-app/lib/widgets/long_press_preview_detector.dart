import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Detector de "mantener presionado 2 segundos" para abrir la vista previa
/// de un producto. Un tap normal (corto) llama a [onTap]; mantener 2s
/// dispara [onLongPressReached] con un anillo de carga futurista que se
/// llena mientras el dedo sigue sobre la tarjeta.
class LongPressPreviewDetector extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onDoubleTap;
  final VoidCallback onLongPressReached;
  final Duration duration;
  final BorderRadius borderRadius;

  const LongPressPreviewDetector({
    super.key,
    required this.child,
    this.onTap,
    this.onDoubleTap,
    required this.onLongPressReached,
    this.duration = const Duration(milliseconds: 2000),
    this.borderRadius = const BorderRadius.all(Radius.circular(20)),
  });

  @override
  State<LongPressPreviewDetector> createState() =>
      _LongPressPreviewDetectorState();
}

class _LongPressPreviewDetectorState extends State<LongPressPreviewDetector>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  bool _triggered = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _ctrl.addStatusListener((status) {
      if (status == AnimationStatus.completed && !_triggered) {
        _triggered = true;
        HapticFeedback.mediumImpact();
        widget.onLongPressReached();
      }
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _start() {
    _triggered = false;
    _ctrl.forward(from: 0);
  }

  void _cancelHold() {
    if (!_triggered) _ctrl.stop();
    _ctrl.value = 0;
  }

  void _handleTap() {
    if (_triggered) {
      _triggered = false;
      return;
    }
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _handleTap,
      onDoubleTap: widget.onDoubleTap,
      onTapDown: (_) => _start(),
      onTapUp: (_) => _cancelHold(),
      onTapCancel: _cancelHold,
      child: Stack(children: [
        widget.child,
        Positioned.fill(
          child: IgnorePointer(
            child: ClipRRect(
              borderRadius: widget.borderRadius,
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) {
                  if (_ctrl.value <= 0) return const SizedBox.shrink();
                  return Container(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        radius: 1.1,
                        colors: [
                          scheme.primary.withValues(alpha: 0.05 * _ctrl.value),
                          scheme.primary.withValues(alpha: 0.38 * _ctrl.value),
                        ],
                      ),
                    ),
                    child: Center(
                      child: SizedBox(
                        width: 34,
                        height: 34,
                        child: CircularProgressIndicator(
                          value: _ctrl.value,
                          strokeWidth: 3,
                          color: Colors.white,
                          backgroundColor: Colors.white.withValues(alpha: 0.35),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ]),
    );
  }
}
