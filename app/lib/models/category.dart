class Category {
  final int id;
  final String name;
  final String description;
  final String? image;
  final int sortOrder;
  final bool isActive;
  final int productCount;

  Category({
    required this.id,
    required this.name,
    this.description = '',
    this.image,
    this.sortOrder = 0,
    this.isActive = true,
    this.productCount = 0,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      image: json['image'] as String?,
      sortOrder: json['sort_order'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
      productCount: json['product_count'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'image': image,
      'sort_order': sortOrder,
      'is_active': isActive,
      'product_count': productCount,
    };
  }

  Category copyWith({
    int? id,
    String? name,
    String? description,
    String? image,
    int? sortOrder,
    bool? isActive,
    int? productCount,
  }) {
    return Category(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      image: image ?? this.image,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
      productCount: productCount ?? this.productCount,
    );
  }
}
