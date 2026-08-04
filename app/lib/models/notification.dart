import 'dart:convert';

class AppNotification {
  final int id;
  final int userId;
  final String title;
  final String body;
  final String? type;
  final Map<String, dynamic>? dataJson;
  final String? readAt;
  final String createdAt;

  AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    this.type,
    this.dataJson,
    this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic>? data;
    if (json['data_json'] != null) {
      if (json['data_json'] is String) {
        try {
          data = Map<String, dynamic>.from(
            (jsonDecode(json['data_json'] as String) as Map),
          );
        } catch (_) {
          data = null;
        }
      } else if (json['data_json'] is Map) {
        data = Map<String, dynamic>.from(json['data_json'] as Map);
      }
    }

    return AppNotification(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      type: json['type'] as String?,
      dataJson: data,
      readAt: json['read_at'] as String?,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'title': title,
      'body': body,
      'type': type,
      'data_json': dataJson,
      'read_at': readAt,
      'created_at': createdAt,
    };
  }
}
