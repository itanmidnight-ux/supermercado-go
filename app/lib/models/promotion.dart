class Promotion {
  final int id;
  final String code;
  final String name;
  final String? type;
  final int value;
  final int? minOrder;
  final int? maxUses;
  final int? uses;
  final String? startsAt;
  final String? endsAt;
  final bool isActive;

  Promotion({
    required this.id,
    required this.code,
    required this.name,
    this.type,
    required this.value,
    this.minOrder,
    this.maxUses,
    this.uses,
    this.startsAt,
    this.endsAt,
    this.isActive = true,
  });

  factory Promotion.fromJson(Map<String, dynamic> json) {
    return Promotion(
      id: json['id'] as int,
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String?,
      value: (json['value'] is int) ? json['value'] as int : (json['value'] as num).toInt(),
      minOrder: (json['min_order'] is int) ? json['min_order'] as int : (json['min_order'] as num?)?.toInt(),
      maxUses: (json['max_uses'] is int) ? json['max_uses'] as int : (json['max_uses'] as num?)?.toInt(),
      uses: (json['uses'] is int) ? json['uses'] as int : (json['uses'] as num?)?.toInt(),
      startsAt: json['starts_at'] as String?,
      endsAt: json['ends_at'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'name': name,
      'type': type,
      'value': value,
      'min_order': minOrder,
      'max_uses': maxUses,
      'uses': uses,
      'starts_at': startsAt,
      'ends_at': endsAt,
      'is_active': isActive,
    };
  }

  int calculateDiscount(int subtotal) {
    if (type == 'percentage') {
      return (subtotal * value / 100).round();
    }
    return value;
  }

  bool get isValid {
    if (!isActive) return false;
    if (maxUses != null && uses != null && uses! >= maxUses!) return false;
    if (startsAt != null && DateTime.now().isBefore(DateTime.parse(startsAt!))) return false;
    if (endsAt != null && DateTime.now().isAfter(DateTime.parse(endsAt!))) return false;
    return true;
  }
}