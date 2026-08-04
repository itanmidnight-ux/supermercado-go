class User {
  final int id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String? avatar;
  final bool isActive;
  final int? earnings;
  final String? docType;
  final String? docNumber;
  final bool mustChangePassword;
  final String? acceptedPrivacyAt;
  final String? lastLoginAt;
  final String? createdAt;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    this.avatar,
    this.isActive = true,
    this.earnings,
    this.docType,
    this.docNumber,
    this.mustChangePassword = false,
    this.acceptedPrivacyAt,
    this.lastLoginAt,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      role: json['role'] as String? ?? 'client',
      avatar: json['avatar'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      earnings: json['earnings'] as int?,
      docType: json['doc_type'] as String?,
      docNumber: json['doc_number'] as String?,
      mustChangePassword: json['must_change_password'] as bool? ?? false,
      acceptedPrivacyAt: json['accepted_privacy_at'] as String?,
      lastLoginAt: json['last_login_at'] as String?,
      createdAt: json['created_at'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'role': role,
      'avatar': avatar,
      'is_active': isActive,
      'earnings': earnings,
      'doc_type': docType,
      'doc_number': docNumber,
      'must_change_password': mustChangePassword,
      'accepted_privacy_at': acceptedPrivacyAt,
      'last_login_at': lastLoginAt,
      'created_at': createdAt,
    };
  }

  User copyWith({
    int? id,
    String? name,
    String? email,
    String? phone,
    String? role,
    String? avatar,
    bool? isActive,
    int? earnings,
    String? docType,
    String? docNumber,
    bool? mustChangePassword,
    String? acceptedPrivacyAt,
    String? lastLoginAt,
    String? createdAt,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      avatar: avatar ?? this.avatar,
      isActive: isActive ?? this.isActive,
      earnings: earnings ?? this.earnings,
      docType: docType ?? this.docType,
      docNumber: docNumber ?? this.docNumber,
      mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      acceptedPrivacyAt: acceptedPrivacyAt ?? this.acceptedPrivacyAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
