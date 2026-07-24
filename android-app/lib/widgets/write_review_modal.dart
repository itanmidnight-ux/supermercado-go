import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'app_button.dart';
import 'futuristic_modal.dart';

/// Ventana emergente para calificar un producto (1 a 5 estrellas) y dejar
/// un comentario opcional. Las reseñas de 1-2 estrellas se guardan pero
/// nunca se muestran públicamente (filtro del servidor).
Future<bool?> showWriteReviewModal(BuildContext context,
    {required int productId}) {
  return showFuturisticModal<bool>(context,
      builder: (_) => _WriteReviewModal(productId: productId));
}

class _WriteReviewModal extends StatefulWidget {
  final int productId;
  const _WriteReviewModal({required this.productId});
  @override
  State<_WriteReviewModal> createState() => _WriteReviewModalState();
}

class _WriteReviewModalState extends State<_WriteReviewModal> {
  int _rating = 5;
  final _commentCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ApiService.submitReview(
          widget.productId, _rating, _commentCtrl.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted)
        setState(() {
          _error = e.toString().replaceAll('Exception: ', '');
          _loading = false;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FuturisticModalCard(
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const ModalCloseButton(),
            const Icon(Icons.rate_review_rounded,
                size: 38, color: Color(0xFFB5651D)),
            const SizedBox(height: 8),
            const Text('¿Qué te pareció este producto?',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1A1A1A))),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final star = i + 1;
                return GestureDetector(
                  onTap: () => setState(() => _rating = star),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Icon(
                        star <= _rating
                            ? Icons.star_rounded
                            : Icons.star_border_rounded,
                        size: 36,
                        color: const Color(0xFFF5A623)),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _commentCtrl,
              maxLines: 3,
              maxLength: 300,
              decoration: InputDecoration(
                hintText: 'Cuéntanos tu experiencia (opcional)',
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
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(_error!,
                    style: const TextStyle(
                        color: Color(0xFFD32F2F), fontSize: 12)),
              ),
            const SizedBox(height: 12),
            AppButton(
                label: 'Enviar reseña',
                icon: Icons.send_rounded,
                loading: _loading,
                onPressed: _loading ? null : _submit),
          ]),
    );
  }
}
