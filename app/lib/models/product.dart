class Product {
  final int id;
  final String name;
  final String description;
  final int price;
  final int? comparePrice;
  final int stock;
  final int? stockMin;
  final String? sku;
  final String? barcode;
  final int? categoryId;
  final String? image;
  final String? unit;
  final double? taxRate;
  final bool isWeighed;
  final bool isActive;
  final bool isOffer;
  final int? offerPrice;
  final String? brand;
  final int? cost;
  final String? categoryName;

  Product({
    required this.id,
    required this.name,
    this.description = '',
    required this.price,
    this.comparePrice,
    required this.stock,
    this.stockMin,
    this.sku,
    this.barcode,
    this.categoryId,
    this.image,
    this.unit,
    this.taxRate,
    this.isWeighed = false,
    this.isActive = true,
    this.isOffer = false,
    this.offerPrice,
    this.brand,
    this.cost,
    this.categoryName,
  });

  int get effectivePrice => (isOffer && offerPrice != null) ? offerPrice! : price;
  bool get inStock => stock > 0;
  String get displayUnit => unit ?? 'un';
  bool get isPricedByWeight => isWeighed && (unit == 'kg' || unit == 'lb' || unit == 'g' || unit == 'oz');

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      price: (json['price'] is int) ? json['price'] as int : (json['price'] as num).toInt(),
      comparePrice: json['compare_price'] as int?,
      stock: (json['stock'] is int) ? json['stock'] as int : (json['stock'] as num).toInt(),
      stockMin: json['stock_min'] as int?,
      sku: json['sku'] as String?,
      barcode: json['barcode'] as String?,
      categoryId: json['category_id'] as int?,
      image: json['image'] as String?,
      unit: json['unit'] as String?,
      taxRate: json['tax_rate'] as double?,
      isWeighed: json['is_weighed'] as bool? ?? false,
      isActive: json['is_active'] as bool? ?? true,
      isOffer: json['is_offer'] as bool? ?? false,
      offerPrice: json['offer_price'] as int?,
      brand: json['brand'] as String?,
      cost: json['cost'] as int?,
      categoryName: json['category_name'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'price': price,
      'compare_price': comparePrice,
      'stock': stock,
      'stock_min': stockMin,
      'sku': sku,
      'barcode': barcode,
      'category_id': categoryId,
      'image': image,
      'unit': unit,
      'tax_rate': taxRate,
      'is_weighed': isWeighed,
      'is_active': isActive,
      'is_offer': isOffer,
      'offer_price': offerPrice,
      'brand': brand,
      'cost': cost,
      'category_name': categoryName,
    };
  }

  Product copyWith({
    int? id,
    String? name,
    String? description,
    int? price,
    int? comparePrice,
    int? stock,
    int? stockMin,
    String? sku,
    String? barcode,
    int? categoryId,
    String? image,
    String? unit,
    double? taxRate,
    bool? isWeighed,
    bool? isActive,
    bool? isOffer,
    int? offerPrice,
    String? brand,
    int? cost,
    String? categoryName,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      price: price ?? this.price,
      comparePrice: comparePrice ?? this.comparePrice,
      stock: stock ?? this.stock,
      stockMin: stockMin ?? this.stockMin,
      sku: sku ?? this.sku,
      barcode: barcode ?? this.barcode,
      categoryId: categoryId ?? this.categoryId,
      image: image ?? this.image,
      unit: unit ?? this.unit,
      taxRate: taxRate ?? this.taxRate,
      isWeighed: isWeighed ?? this.isWeighed,
      isActive: isActive ?? this.isActive,
      isOffer: isOffer ?? this.isOffer,
      offerPrice: offerPrice ?? this.offerPrice,
      brand: brand ?? this.brand,
      cost: cost ?? this.cost,
      categoryName: categoryName ?? this.categoryName,
    );
  }
}