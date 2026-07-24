import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/api_service.dart';
import 'futuristic_modal.dart';

/// Galería de fotos del producto en ventana emergente futurista: swipe
/// entre imágenes, zoom con pellizco, miniaturas abajo para saltar a una
/// foto puntual. Se abre al tocar la imagen principal de la página de
/// producto.
Future<void> showProductGalleryModal(
  BuildContext context, {
  required List<String> images,
  int initialIndex = 0,
}) {
  return showFuturisticModal(context,
      builder: (_) => _GalleryModal(
            images: images,
            initialIndex: initialIndex,
          ));
}

class _GalleryModal extends StatefulWidget {
  final List<String> images;
  final int initialIndex;
  const _GalleryModal({required this.images, required this.initialIndex});

  @override
  State<_GalleryModal> createState() => _GalleryModalState();
}

class _GalleryModalState extends State<_GalleryModal> {
  late int _index = widget.initialIndex;
  late final _pageCtrl = PageController(initialPage: widget.initialIndex);

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final modalW = size.width > 560 ? 520.0 : size.width - 32;
    final modalH = size.height * 0.82;
    return Center(
      child: Container(
        width: modalW,
        height: modalH,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 50,
                offset: const Offset(0, 24)),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          PageView.builder(
            controller: _pageCtrl,
            itemCount: widget.images.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => InteractiveViewer(
              minScale: 1.0,
              maxScale: 4.0,
              child: Center(
                child: CachedNetworkImage(
                  imageUrl: ApiService.productImageUrl(widget.images[i]),
                  httpHeaders: ApiService.imageHeaders,
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),
          const Positioned(top: 10, right: 10, child: ModalCloseButton()),
          if (widget.images.length > 1)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.7),
                      Colors.transparent
                    ],
                  ),
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                        widget.images.length,
                        (i) => AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: i == _index ? 20 : 7,
                              height: 7,
                              decoration: BoxDecoration(
                                  color: i == _index
                                      ? Colors.white
                                      : Colors.white38,
                                  borderRadius: BorderRadius.circular(4)),
                            )),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 56,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: widget.images.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => GestureDetector(
                        onTap: () => _pageCtrl.animateToPage(i,
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeOut),
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color:
                                    i == _index ? Colors.white : Colors.white24,
                                width: i == _index ? 2 : 1),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: CachedNetworkImage(
                            imageUrl:
                                ApiService.productImageUrl(widget.images[i]),
                            httpHeaders: ApiService.imageHeaders,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
