class AppBanner {
  final String id;
  final String title;
  final String bgColor;
  final String textColor;
  final String? subtitle;
  final String? imageUrl;

  const AppBanner({
    required this.id,
    required this.title,
    required this.bgColor,
    required this.textColor,
    this.subtitle,
    this.imageUrl,
  });

  factory AppBanner.fromJson(Map<String, dynamic> json) => AppBanner(
        id: '${json['id'] ?? ''}',
        title: '${json['title'] ?? ''}',
        bgColor: '${json['bg_color'] ?? '#00B860'}',
        textColor: '${json['text_color'] ?? '#FFFFFF'}',
        subtitle: json['subtitle'] as String?,
        imageUrl: json['image_url'] as String?,
      );
}
