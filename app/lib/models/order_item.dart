class OrderItem {
  final int? id;
  final int? orderId;
  final int productId;
  final String productName;
  final String? productSku;
  final String? unit;
  final double qty;
  final int unitPrice;
  final int discount;
  final double? taxRate;
  final int? taxAmount;
  final int lineTotal;
  final double? qtyDelivered;
  final String? status;
  final String? image;
  final int? substituteProductId;
  final String? substituteProductName;
  final bool? isMissing;

  OrderItem({
    this.id,
    this.orderId,
    required this.productId,
    required this.productName,
    this.productSku,
    this.unit,
    required this.qty,
    required this.unitPrice,
    this.discount = 0,
    this.taxRate,
    this.taxAmount,
    required this.lineTotal,
    this.qtyDelivered,
    this.status,
    this.image,
    this.substituteProductId,
    this.substituteProductName,
    this.isMissing = false,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] as int?,
      orderId: json['order_id'] as int?,
      productId: json['product_id'] as int,
      productName: json['product_name'] as String? ?? '',
      productSku: json['product_sku'] as String?,
      unit: json['unit'] as String?,
      qty: (json['qty'] is int) ? (json['qty'] as int).toDouble() : (json['qty'] as num?)?.toDouble() ?? 0.0,
      unitPrice: (json['unit_price'] is int) ? json['unit_price'] as int : (json['unit_price'] as num).toInt(),
      discount: (json['discount'] is int) ? json['discount'] as int : (json['discount'] as num?)?.toInt() ?? 0,
      taxRate: json['tax_rate'] as double?,
      taxAmount: json['tax_amount'] as int?,
      lineTotal: (json['line_total'] is int) ? json['line_total'] as int : (json['line_total'] as num).toInt(),
      qtyDelivered: json['qty_delivered'] as double?,
      status: json['status'] as String?,
      image: json['image'] as String?,
      substituteProductId: json['substitute_product_id'] as int?,
      substituteProductName: json['substitute_product_name'] as String?,
      isMissing: json['is_missing'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_id': orderId,
      'product_id': productId,
      'product_name': productName,
      'product_sku': productSku,
      'unit': unit,
      'qty': qty,
      'unit_price': unitPrice,
      'discount': discount,
      'tax_rate': taxRate,
      'tax_amount': taxAmount,
      'line_total': lineTotal,
      'qty_delivered': qtyDelivered,
      'status': status,
      'image': image,
      'substitute_product_id': substituteProductId,
      'substitute_product_name': substituteProductName,
      'is_missing': isMissing,
    };
  }
}