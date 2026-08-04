class Invoice {
  final int id;
  final int orderId;
  final String? type;
  final String? prefix;
  final int number;
  final String? fullNumber;
  final String? resolutionNumber;
  final String? customerName;
  final int subtotal;
  final int discountTotal;
  final int taxTotal;
  final int total;
  final String? paymentMethod;
  final String? dianStatus;
  final String? issuedAt;

  Invoice({
    required this.id,
    required this.orderId,
    this.type,
    this.prefix,
    required this.number,
    this.fullNumber,
    this.resolutionNumber,
    this.customerName,
    required this.subtotal,
    required this.discountTotal,
    required this.taxTotal,
    required this.total,
    this.paymentMethod,
    this.dianStatus,
    this.issuedAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] as int,
      orderId: json['order_id'] as int,
      type: json['type'] as String?,
      prefix: json['prefix'] as String?,
      number: json['number'] as int,
      fullNumber: json['full_number'] as String?,
      resolutionNumber: json['resolution_number'] as String?,
      customerName: json['customer_name'] as String?,
      subtotal: (json['subtotal'] is int) ? json['subtotal'] as int : (json['subtotal'] as num).toInt(),
      discountTotal: (json['discount_total'] is int) ? json['discount_total'] as int : (json['discount_total'] as num?)?.toInt() ?? 0,
      taxTotal: (json['tax_total'] is int) ? json['tax_total'] as int : (json['tax_total'] as num).toInt(),
      total: (json['total'] is int) ? json['total'] as int : (json['total'] as num).toInt(),
      paymentMethod: json['payment_method'] as String?,
      dianStatus: json['dian_status'] as String?,
      issuedAt: json['issued_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_id': orderId,
      'type': type,
      'prefix': prefix,
      'number': number,
      'full_number': fullNumber,
      'resolution_number': resolutionNumber,
      'customer_name': customerName,
      'subtotal': subtotal,
      'discount_total': discountTotal,
      'tax_total': taxTotal,
      'total': total,
      'payment_method': paymentMethod,
      'dian_status': dianStatus,
      'issued_at': issuedAt,
    };
  }
}