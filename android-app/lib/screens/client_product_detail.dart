import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/product.dart';
import '../models/review.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../services/local_db.dart';
import '../services/guest_cart_service.dart';
import '../services/tab_navigator.dart';
import '../widgets/app_button.dart';
import '../widgets/futuristic_modal.dart';
import '../widgets/product_gallery_modal.dart';
import '../widgets/write_review_modal.dart';
import '../utils/product_description.dart';

class ClientProductDetail extends StatefulWidget {
  final Product product;
  final String description;
  const ClientProductDetail(
      {super.key, required this.product, required this.description});
  @override
  State<ClientProductDetail> createState() => _ClientProductDetailState();
}

class _ClientProductDetailState extends State<ClientProductDetail>
    with SingleTickerProviderStateMixin {
  int _qty = 1;
  bool _adding = false;
  int _imgIndex = 0;
  final _pageCtrl = PageController();
  final _relatedScrollCtrl = ScrollController();

  late final AnimationController _addCtrl;
  late final Animation<double> _addScale;

  ReviewSummary? _reviews;
  bool _loadingReviews = true;
  List<Product> _related = [];

  @override
  void initState() {
    super.initState();
    _addCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 150));
    _addScale = Tween<double>(begin: 1.0, end: 0.95)
        .animate(CurvedAnimation(parent: _addCtrl, curve: Curves.easeInOut));
    _loadReviews();
    _loadRelated();
  }

  Future<void> _loadReviews() async {
    if (widget.product.id == null) {
      setState(() => _loadingReviews = false);
      return;
    }
    try {
      final summary = await ApiService.getProductReviews(widget.product.id!);
      if (mounted)
        setState(() {
          _reviews = summary;
          _loadingReviews = false;
        });
    } catch (_) {
      if (mounted) setState(() => _loadingReviews = false);
    }
  }

  Future<void> _loadRelated() async {
    try {
      var list = await LocalDB.getCachedProducts();
      if (list.isEmpty) list = await ApiService.getProducts();
      if (mounted) {
        setState(() {
          _related = list
              .where((p) =>
                  p.id != widget.product.id &&
                  p.available &&
                  (p.category == widget.product.category ||
                      p.favorite == widget.product.favorite))
              .take(10)
              .toList();
          if (_related.length < 4) {
            _related = list
                .where((p) => p.id != widget.product.id && p.available)
                .take(10)
                .toList();
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _openWriteReview() async {
    if (widget.product.id == null) return;
    final ok =
        await showWriteReviewModal(context, productId: widget.product.id!);
    if (ok == true) {
      _loadReviews();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('¡Gracias por tu reseña!'),
          behavior: SnackBarBehavior.floating,
        ));
    }
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    _relatedScrollCtrl.dispose();
    _addCtrl.dispose();
    super.dispose();
  }

  double get _subtotal => widget.product.price * _qty;

  Future<void> _addToCart() async {
    HapticFeedback.mediumImpact();
    await _addCtrl.forward();
    await _addCtrl.reverse();
    setState(() => _adding = true);
    try {
      final loggedIn = context.read<AppProvider>().isLoggedIn;
      if (loggedIn) {
        await ApiService.addToCart(widget.product.id!, _qty);
      } else {
        await GuestCartService.add(
          productId: widget.product.id!,
          productName: widget.product.name,
          price: widget.product.price,
          quantity: _qty,
        );
      }
      if (mounted) _showSuccessSheet();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  void _showSuccessSheet() {
    showFuturisticModal(context, builder: (_) {
      final scheme = Theme.of(context).colorScheme;
      return FuturisticModalCard(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const ModalCloseButton(),
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.check_circle_rounded,
                color: scheme.primary, size: 44),
          ),
          const SizedBox(height: 16),
          const Text('¡Agregado al carrito!',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('${widget.product.name} × $_qty',
              style: const TextStyle(color: Colors.black54, fontSize: 14)),
          const SizedBox(height: 24),
          Row(children: [
            Expanded(
                child: OutlinedButton(
              onPressed: () => Navigator.of(context).maybePop(),
              style: OutlinedButton.styleFrom(
                foregroundColor: scheme.primary,
                side: BorderSide(color: scheme.primary),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Seguir comprando',
                  style: TextStyle(fontWeight: FontWeight.w700)),
            )),
            const SizedBox(width: 12),
            Expanded(
                child: FilledButton(
              onPressed: () {
                Navigator.of(context).maybePop();
                TabNavigator.goToCart();
                Navigator.of(context).popUntil((r) => r.isFirst);
              },
              style: FilledButton.styleFrom(
                backgroundColor: scheme.primary,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Ver carrito',
                  style: TextStyle(fontWeight: FontWeight.w700)),
            )),
          ]),
        ]),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final size = MediaQuery.of(context).size;
    final imgH = (size.height * 0.42).clamp(260.0, 380.0);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: scheme.surface,
      body: Stack(children: [
        CustomScrollView(slivers: [
          // ── Hero image ───────────────────────────────────────
          SliverAppBar(
            expandedHeight: imgH,
            pinned: true,
            backgroundColor: Color.lerp(scheme.primary, Colors.black, 0.35),
            elevation: 0,
            leading: Padding(
              padding: const EdgeInsets.all(8),
              child: GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: Colors.white.withValues(alpha: 0.25), width: 1),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 2))
                    ],
                  ),
                  child: const Icon(Icons.arrow_back_rounded,
                      color: Colors.white, size: 22),
                ),
              ),
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.all(8),
                child: GestureDetector(
                  onTap: () {
                    TabNavigator.goToCart();
                    Navigator.of(context).popUntil((r) => r.isFirst);
                  },
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.25),
                          width: 1),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2))
                      ],
                    ),
                    child: const Icon(Icons.shopping_cart_rounded,
                        color: Colors.white, size: 20),
                  ),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: p.images.isNotEmpty
                  ? Stack(children: [
                      // Image gallery with zoom -- tap abre la galería en ventana emergente
                      GestureDetector(
                        onTap: () => showProductGalleryModal(context,
                            images: p.images, initialIndex: _imgIndex),
                        child: PageView.builder(
                          controller: _pageCtrl,
                          itemCount: p.images.length,
                          onPageChanged: (i) => setState(() => _imgIndex = i),
                          itemBuilder: (_, i) => InteractiveViewer(
                            minScale: 1.0,
                            maxScale: 3.0,
                            child: i == 0
                                ? Hero(
                                    tag: 'product-image-${p.id}',
                                    child: CachedNetworkImage(
                                      imageUrl: ApiService.productImageUrl(
                                          p.images[i]),
                                      httpHeaders: ApiService.imageHeaders,
                                      fit: BoxFit.cover,
                                      width: double.infinity,
                                      height: double.infinity,
                                      placeholder: (_, __) => Container(
                                          color: scheme.primary
                                              .withValues(alpha: 0.1),
                                          child: Center(
                                              child: CircularProgressIndicator(
                                                  color: scheme.primary,
                                                  strokeWidth: 2))),
                                      errorWidget: (_, __, ___) =>
                                          _ImgFallback(),
                                    ))
                                : CachedNetworkImage(
                                    imageUrl:
                                        ApiService.productImageUrl(p.images[i]),
                                    httpHeaders: ApiService.imageHeaders,
                                    fit: BoxFit.cover,
                                    width: double.infinity,
                                    height: double.infinity,
                                    placeholder: (_, __) => Container(
                                        color: scheme.primary
                                            .withValues(alpha: 0.1),
                                        child: Center(
                                            child: CircularProgressIndicator(
                                                color: scheme.primary,
                                                strokeWidth: 2))),
                                    errorWidget: (_, __, ___) => _ImgFallback(),
                                  ),
                          ),
                        ),
                      ),
                      // Dark gradient bottom
                      Positioned(
                        bottom: 0,
                        left: 0,
                        right: 0,
                        child: Container(
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [
                                Colors.black.withValues(alpha: 0.55),
                                Colors.transparent
                              ],
                            ),
                          ),
                        ),
                      ),
                      // Photo dots
                      if (p.images.length > 1)
                        Positioned(
                          bottom: 14,
                          left: 0,
                          right: 0,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(
                                p.images.length,
                                (i) => AnimatedContainer(
                                      duration:
                                          const Duration(milliseconds: 250),
                                      margin: const EdgeInsets.symmetric(
                                          horizontal: 3),
                                      width: i == _imgIndex ? 20 : 7,
                                      height: 7,
                                      decoration: BoxDecoration(
                                          color: i == _imgIndex
                                              ? Colors.white
                                              : Colors.white54,
                                          borderRadius:
                                              BorderRadius.circular(4)),
                                    )),
                          ),
                        ),
                      // Favorite badge
                      if (p.favorite)
                        Positioned(
                          top: 0,
                          right: 0,
                          child: Container(
                            margin: const EdgeInsets.all(12),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: scheme.secondary,
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.2),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2))
                              ],
                            ),
                            child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.star_rounded,
                                      color: Colors.white, size: 14),
                                  SizedBox(width: 4),
                                  Text('Más vendido',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800)),
                                ]),
                          ),
                        ),
                    ])
                  : _ImgFallback(),
            ),
          ),

          // ── Content ──────────────────────────────────────────
          SliverToBoxAdapter(
            child:
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Name & price card
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.name,
                          style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                              color: Color(0xFF1A1A1A))),
                      if ((widget.description).isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          widget.description.split('\n').first,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                              height: 1.4,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Precio por unidad',
                                    style: TextStyle(
                                        color: Colors.black38, fontSize: 11)),
                                const SizedBox(height: 2),
                                Text('\$${_fmt(p.price)}',
                                    style: TextStyle(
                                        fontSize: 32,
                                        color: scheme.primary,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: -0.5)),
                              ]),
                            const Spacer(),
                            // Stock chip
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: scheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color:
                                        scheme.primary.withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.inventory_2_outlined,
                                        size: 14, color: scheme.primary),
                                    const SizedBox(width: 5),
                                    Text('Disponible',
                                        style: TextStyle(
                                            color: scheme.primary,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700)),
                                  ]),
                            ),
                          ]),
                    ]),
              ),

              const SizedBox(height: 8),

              // Description
              Container(
                color: Colors.white,
                padding: const EdgeInsets.all(20),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionTitle(
                          icon: Icons.info_outline_rounded,
                          label: 'Descripción'),
                      const SizedBox(height: 10),
                      Text(widget.description,
                          style: const TextStyle(
                              color: Color(0xFF4A4A4A),
                              fontSize: 14,
                              height: 1.6)),
                    ]),
              ),

              const SizedBox(height: 8),

              // Benefits row
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Row(children: [
                  _BenefitTile(
                      icon: Icons.local_shipping_rounded,
                      label: 'Entrega\na domicilio',
                      color: Colors.blue.shade600),
                  _BenefitTile(
                      icon: Icons.payments_outlined,
                      label: 'Pago\ncontraentrega',
                      color: Colors.orange.shade700),
                  _BenefitTile(
                      icon: Icons.verified_rounded,
                      label: 'Calidad\ngarantizada',
                      color: scheme.primary),
                  p.noFiado
                      ? _BenefitTile(
                          icon: Icons.block_rounded,
                          label: 'No se fía\neste producto',
                          color: Colors.red.shade400)
                      : _BenefitTile(
                          icon: Icons.handshake_rounded,
                          label: 'Disponible\na fiado',
                          color: Colors.purple.shade600),
                ]),
              ),

              const SizedBox(height: 8),

              // Payment methods
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionTitle(
                          icon: Icons.payments_rounded,
                          label: 'Métodos de pago'),
                      const SizedBox(height: 14),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                        _PaymentBadge(
                            icon: Icons.phone_android_rounded,
                            label: 'Nequi',
                            color: const Color(0xFF8B0A50)),
                        _PaymentBadge(
                            icon: Icons.credit_card_rounded,
                            label: 'Visa',
                            color: const Color(0xFF1A1F71)),
                        _PaymentBadge(
                            icon: Icons.money_rounded,
                            label: 'Contraentrega',
                            color: scheme.primary),
                      ]),
                      const SizedBox(height: 12),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                        _TrustBadge(
                            icon: Icons.lock_rounded,
                            label: 'Pago\nseguro'),
                        _TrustBadge(
                            icon: Icons.verified_user_rounded,
                            label: 'Datos\nprotegidos'),
                        _TrustBadge(
                            icon: Icons.support_agent_rounded,
                            label: 'Soporte\nWhatsApp'),
                      ]),
                    ]),
              ),

              const SizedBox(height: 8),

              // Quantity selector
              Container(
                color: Colors.white,
                padding: const EdgeInsets.all(20),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _SectionTitle(
                          icon: Icons.shopping_cart_outlined,
                          label: 'Cantidad'),
                      const SizedBox(height: 14),
                      Row(children: [
                        // Qty control
                        Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F5F5),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE0E0E0)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            _QtyBtn(
                              icon: Icons.remove_rounded,
                              enabled: _qty > 1,
                              onTap: () {
                                if (_qty > 1) setState(() => _qty--);
                              },
                            ),
                            SizedBox(
                              width: 56,
                              child: Text('$_qty',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF1A1A1A))),
                            ),
                            _QtyBtn(
                              icon: Icons.add_rounded,
                              enabled: true,
                              onTap: () => setState(() => _qty++),
                            ),
                          ]),
                        ),
                        const Spacer(),
                        Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text('Subtotal',
                                  style: TextStyle(
                                      color: Colors.black38, fontSize: 11)),
                              Text('\$${_fmt(_subtotal)}',
                                  style: TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.w800,
                                      color: scheme.primary)),
                            ]),
                      ]),
                    ]),
              ),

              const SizedBox(height: 8),

              // Reseñas (solo 3 a 5 estrellas -- filtro del servidor)
              Container(
                color: Colors.white,
                padding: const EdgeInsets.all(20),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Expanded(
                            child: _SectionTitle(
                                icon: Icons.reviews_rounded,
                                label: 'Reseñas de clientes')),
                        TextButton.icon(
                          onPressed: _openWriteReview,
                          icon: const Icon(Icons.edit_rounded, size: 16),
                          label: const Text('Escribir reseña',
                              style: TextStyle(fontSize: 12)),
                        ),
                      ]),
                      const SizedBox(height: 8),
                      if (_loadingReviews)
                        const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Center(
                                child:
                                    CircularProgressIndicator(strokeWidth: 2)))
                      else if (_reviews == null || _reviews!.count == 0)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text(
                              'Aún no hay reseñas para este producto. ¡Sé el primero en opinar!',
                              style: TextStyle(
                                  color: Colors.grey.shade500, fontSize: 13)),
                        )
                      else ...[
                        Row(children: [
                          Icon(Icons.star_rounded,
                              color: const Color(0xFFF5A623), size: 22),
                          const SizedBox(width: 6),
                          Text(_reviews!.average.toStringAsFixed(1),
                              style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1A1A1A))),
                          const SizedBox(width: 8),
                          Text(
                              '(${_reviews!.count} ${_reviews!.count == 1 ? "reseña" : "reseñas"})',
                              style: TextStyle(
                                  color: Colors.grey.shade500, fontSize: 12)),
                        ]),
                        const SizedBox(height: 12),
                        ...(_reviews!.reviews.take(6).map((r) => Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [
                                      Text(r.author,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13)),
                                      const SizedBox(width: 8),
                                      Row(
                                          children: List.generate(
                                              5,
                                              (i) => Icon(
                                                  i < r.rating
                                                      ? Icons.star_rounded
                                                      : Icons
                                                          .star_border_rounded,
                                                  size: 14,
                                                  color: const Color(
                                                      0xFFF5A623)))),
                                    ]),
                                    if (r.comment != null &&
                                        r.comment!.isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(r.comment!,
                                          style: const TextStyle(
                                              color: Color(0xFF4A4A4A),
                                              fontSize: 13,
                                              height: 1.4)),
                                    ],
                                  ]),
                            ))),
                      ],
                    ]),
              ),

              // ── RELATED PRODUCTS CAROUSEL ──────────────────
              if (_related.isNotEmpty) ...[
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.recommend_rounded,
                              color: scheme.primary, size: 20),
                          const SizedBox(width: 8),
                          const Text('También te puede interesar',
                              style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF1A1A1A))),
                        ]),
                        const SizedBox(height: 4),
                        Text('Productos relacionados que podrían gustarte',
                            style: TextStyle(
                                color: Colors.grey.shade500, fontSize: 12)),
                      ]),
                ),
                SizedBox(
                  height: 220,
                  child: ListView.builder(
                    controller: _relatedScrollCtrl,
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _related.length,
                    itemBuilder: (_, i) {
                      final rp = _related[i];
                      return GestureDetector(
                        onTap: () => Navigator.pushReplacement(
                            context,
                            PageRouteBuilder(
                              pageBuilder: (_, __, ___) =>
                                  ClientProductDetail(
                                      product: rp,
                                      description: productDescription(rp)),
                              transitionsBuilder: (_, a, __, c) =>
                                  FadeTransition(opacity: a, child: c),
                              transitionDuration:
                                  const Duration(milliseconds: 300),
                            )),
                        child: Container(
                          width: 155,
                          margin: const EdgeInsets.only(right: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                                color: Colors.grey.withValues(alpha: 0.12)),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.05),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2))
                            ],
                          ),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ClipRRect(
                                  borderRadius: const BorderRadius.vertical(
                                      top: Radius.circular(16)),
                                  child: SizedBox(
                                    height: 110,
                                    width: double.infinity,
                                    child: rp.images.isNotEmpty
                                        ? CachedNetworkImage(
                                            imageUrl:
                                                ApiService.productImageUrl(
                                                    rp.images.first),
                                            httpHeaders:
                                                ApiService.imageHeaders,
                                            fit: BoxFit.cover,
                                            errorWidget: (_, __, ___) =>
                                                _ImgPlaceholderSmall())
                                        : _ImgPlaceholderSmall(),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                      10, 8, 10, 10),
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(rp.name,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12,
                                                height: 1.3)),
                                        const SizedBox(height: 6),
                                        Row(children: [
                                          Expanded(
                                              child: Text(
                                                  '\$${_fmt(rp.price)}',
                                                  style: TextStyle(
                                                      color: scheme.primary,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                      fontSize: 15))),
                                          Container(
                                            padding:
                                                const EdgeInsets.all(5),
                                            decoration: BoxDecoration(
                                                color: scheme.primary,
                                                shape: BoxShape.circle),
                                            child: const Icon(
                                                Icons
                                                    .add_shopping_cart_rounded,
                                                color: Colors.white,
                                                size: 12),
                                          ),
                                        ]),
                                      ]),
                                ),
                              ]),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 8),
              ],

              // Company footer
              Container(
                color: const Color(0xFF1A1A2E),
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                child: Column(children: [
                  Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        const Text('Supermercado GO',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        Text('Tu tienda de confianza en Cúcuta.',
                            style: TextStyle(
                                color: Colors.grey.shade400, fontSize: 12)),
                        const SizedBox(height: 12),
                        _InfoRow(
                            icon: Icons.chat_rounded,
                            text: '+57 300 123 4567'),
                        const SizedBox(height: 4),
                        _InfoRow(
                            icon: Icons.email_rounded,
                            text: 'contacto@supermercadogo.com.co'),
                        const SizedBox(height: 4),
                        _InfoRow(
                            icon: Icons.location_on_rounded,
                            text: 'Cúcuta, Norte de Santander'),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('COMPRA 100% SEGURA',
                          style: TextStyle(
                              color: scheme.primary,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1)),
                      const SizedBox(height: 8),
                      Icon(Icons.verified_rounded,
                          size: 40, color: scheme.primary),
                    ]),
                  ]),
                  const SizedBox(height: 16),
                  Container(height: 1, color: Colors.white12),
                  const SizedBox(height: 12),
                  Text('Los precios y la disponibilidad están sujetos a cambio sin previo aviso.',
                      style: TextStyle(
                          color: Colors.grey.shade600, fontSize: 10)),
                ]),
              ),

              const SizedBox(height: 100),
                    ]),
                  ),
                ),
          ),
        ]),

        // ── Sticky bottom CTA ─────────────────────────────────
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(20)),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 20,
                    offset: const Offset(0, -6))
              ],
            ),
            padding: EdgeInsets.fromLTRB(
                20, 14, 20, MediaQuery.of(context).padding.bottom + 14),
            child: Row(children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Total del pedido',
                    style: TextStyle(color: Colors.black38, fontSize: 11)),
                Text('\$${_fmt(_subtotal)}',
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: scheme.primary)),
              ]),
              const SizedBox(width: 16),
              Expanded(
                child: ScaleTransition(
                  scale: _addScale,
                  child: SizedBox(
                    height: 54,
                    child: AppButton(
                      label: 'Agregar al carrito',
                      onPressed: _adding ? null : _addToCart,
                      loading: _adding,
                      icon: Icons.add_shopping_cart_rounded,
                    ),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  static String _fmt(double v) => NumberFormat('#,##0', 'es').format(v.round());
}

// ── Reusable widgets ───────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  final IconData icon;
  final String label;
  const _SectionTitle({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 6),
        Text(label,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A1A1A))),
      ]);
}

class _BenefitTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _BenefitTile(
      {required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
          child: Column(children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(height: 6),
        Text(label,
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 10, color: Colors.grey.shade600, height: 1.3)),
      ]));
}

class _QtyBtn extends StatelessWidget {
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  const _QtyBtn(
      {required this.icon, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: enabled
                ? Theme.of(context).colorScheme.primary
                : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon,
              size: 22, color: enabled ? Colors.white : Colors.grey.shade300),
        ),
      );
}

class _PaymentBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _PaymentBadge(
      {required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Column(children: [
        Container(
          width: 52, height: 52,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(height: 5),
        Text(label,
            style: TextStyle(
                fontSize: 9, fontWeight: FontWeight.w700, color: color)),
      ]);
}

class _TrustBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  const _TrustBadge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final muted = Colors.grey.shade500;
    return Column(children: [
      Icon(icon, color: muted, size: 20),
      const SizedBox(height: 4),
      Text(label,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 9, color: muted, height: 1.3)),
    ]);
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.grey.shade500),
          const SizedBox(width: 6),
          Text(text,
              style:
                  TextStyle(color: Colors.grey.shade400, fontSize: 11)),
        ],
      );
}

class _ImgFallback extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      color: primary.withValues(alpha: 0.1),
      child: Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.pets_rounded, color: primary, size: 80),
          const SizedBox(height: 12),
          Text('Imagen no disponible',
              style: TextStyle(color: primary, fontSize: 13)),
        ]),
      ),
    );
  }
}

class _ImgPlaceholderSmall extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Container(
      color: primary.withValues(alpha: 0.1),
      child: Center(
          child: Icon(Icons.pets_rounded, color: primary, size: 36)),
    );
  }
}
