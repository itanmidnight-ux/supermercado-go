import 'order_item.dart';

class Order {
  final int id;
  final int userId;
  final String status;
  final int subtotal;
  final int deliveryFee;
  final int discount;
  final int taxTotal;
  final int total;
  final String? paymentMethod;
  final String? paymentStatus;
  final String? deliveryAddress;
  final double? deliveryLat;
  final double? deliveryLng;
  final String? fulfillmentType;
  final String? pickupCode;
  final String? pickupReadyAt;
  final String? scheduledFor;
  final int? workerId;
  final String? clientName;
  final String? clientPhone;
  final String? workerName;
  final String? cancelledReason;
  final int? rating;
  final String? ratingComment;
  final int? invoiceId;
  final String? notes;
  final List<OrderItem> items;
  final String? createdAt;
  final String? updatedAt;

  Order({
    required this.id,
    required this.userId,
    required this.status,
    required this.subtotal,
    required this.deliveryFee,
    required this.discount,
    required this.taxTotal,
    required this.total,
    this.paymentMethod,
    this.paymentStatus,
    this.deliveryAddress,
    this.deliveryLat,
    this.deliveryLng,
    this.fulfillmentType,
    this.pickupCode,
    this.pickupReadyAt,
    this.scheduledFor,
    this.workerId,
    this.clientName,
    this.clientPhone,
    this.workerName,
    this.cancelledReason,
    this.rating,
    this.ratingComment,
    this.invoiceId,
    this.notes,
    this.items = const [],
    this.createdAt,
    this.updatedAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    List<OrderItem> parsedItems = [];
    if (json['order_items'] != null) {
      final raw = json['order_items'] as List;
      parsedItems = raw.map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList();
    } else if (json['items_legacy'] != null) {
      final raw = json['items_legacy'] as List;
      parsedItems = raw.map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList();
    } else if (json['items'] != null) {
      final raw = json['items'] as List;
      parsedItems = raw.map((e) => OrderItem.fromJson(e as Map<String, dynamic>)).toList();
    }

    return Order(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      status: json['status'] as String? ?? 'pending',
      subtotal: (json['subtotal'] is int) ? json['subtotal'] as int : (json['subtotal'] as num).toInt(),
      deliveryFee: (json['delivery_fee'] is int) ? json['delivery_fee'] as int : (json['delivery_fee'] as num?)?.toInt() ?? 0,
      discount: (json['discount'] is int) ? json['discount'] as int : (json['discount'] as num?)?.toInt() ?? 0,
      taxTotal: (json['tax_total'] is int) ? json['tax_total'] as int : (json['tax_total'] as num?)?.toInt() ?? 0,
      total: (json['total'] is int) ? json['total'] as int : (json['total'] as num).toInt(),
      paymentMethod: json['payment_method'] as String?,
      paymentStatus: json['payment_status'] as String?,
      deliveryAddress: json['delivery_address'] as String?,
      deliveryLat: json['delivery_lat'] as double?,
      deliveryLng: json['delivery_lng'] as double?,
      fulfillmentType: json['fulfillment_type'] as String?,
      pickupCode: json['pickup_code'] as String?,
      pickupReadyAt: json['pickup_ready_at'] as String?,
      scheduledFor: json['scheduled_for'] as String?,
      workerId: json['worker_id'] as int?,
      clientName: json['client_name'] as String?,
      clientPhone: json['client_phone'] as String?,
      workerName: json['worker_name'] as String?,
      cancelledReason: json['cancelled_reason'] as String?,
      rating: json['rating'] as int?,
      ratingComment: json['rating_comment'] as String?,
      invoiceId: json['invoice_id'] as int?,
      notes: json['notes'] as String?,
      items: parsedItems,
      createdAt: json['created_at'] as String?,
      updatedAt: json['updated_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'status': status,
      'subtotal': subtotal,
      'delivery_fee': deliveryFee,
      'discount': discount,
      'tax_total': taxTotal,
      'total': total,
      'payment_method': paymentMethod,
      'payment_status': paymentStatus,
      'delivery_address': deliveryAddress,
      'delivery_lat': deliveryLat,
      'delivery_lng': deliveryLng,
      'fulfillment_type': fulfillmentType,
      'pickup_code': pickupCode,
      'pickup_ready_at': pickupReadyAt,
      'scheduled_for': scheduledFor,
      'worker_id': workerId,
      'client_name': clientName,
      'client_phone': clientPhone,
      'worker_name': workerName,
      'cancelled_reason': cancelledReason,
      'rating': rating,
      'rating_comment': ratingComment,
      'invoice_id': invoiceId,
      'notes': notes,
      'items': items.map((e) => e.toJson()).toList(),
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }

  bool get canCancel => status == 'pending' || status == 'confirmed';
  bool get canRate => status == 'delivered' && rating == null;
  bool get isDelivery => fulfillmentType == 'domicilio' || fulfillmentType == 'delivery';
  bool get isPickup => fulfillmentType == 'recogida' || fulfillmentType == 'pickup';
  String get displayNumber => '#${id.toString().padLeft(4, '0')}';
}
