class Address {
  final int id;
  final int userId;
  final String label;
  final String address;
  final String? detail;
  final String? neighborhood;
  final String city;
  final double? lat;
  final double? lng;
  final bool isDefault;
  final String? createdAt;

  Address({
    required this.id,
    required this.userId,
    required this.label,
    required this.address,
    this.detail,
    this.neighborhood,
    this.city = 'Cúcuta',
    this.lat,
    this.lng,
    this.isDefault = false,
    this.createdAt,
  });

  factory Address.fromJson(Map<String, dynamic> json) {
    return Address(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      label: json['label'] as String? ?? '',
      address: json['address'] as String? ?? '',
      detail: json['detail'] as String?,
      neighborhood: json['neighborhood'] as String?,
      city: json['city'] as String? ?? 'Cúcuta',
      lat: json['lat'] as double?,
      lng: json['lng'] as double?,
      isDefault: json['is_default'] as bool? ?? false,
      createdAt: json['created_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'label': label,
      'address': address,
      'detail': detail,
      'neighborhood': neighborhood,
      'city': city,
      'lat': lat,
      'lng': lng,
      'is_default': isDefault,
      'created_at': createdAt,
    };
  }

  String get fullAddress {
    final parts = <String>[address];
    if (neighborhood != null && neighborhood!.isNotEmpty) parts.add(neighborhood!);
    if (detail != null && detail!.isNotEmpty) parts.add(detail!);
    parts.add(city);
    return parts.join(', ');
  }
}