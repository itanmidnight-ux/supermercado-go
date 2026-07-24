class Review {
  final int id;
  final int rating;
  final String? comment;
  final String createdAt;
  final String author;

  Review({
    required this.id,
    required this.rating,
    this.comment,
    required this.createdAt,
    required this.author,
  });

  factory Review.fromJson(Map<String, dynamic> j) => Review(
        id: j['id'] as int,
        rating: j['rating'] as int,
        comment: j['comment'] as String?,
        createdAt: j['created_at'] as String? ?? '',
        author: j['author'] as String? ?? 'Cliente',
      );
}

class ReviewSummary {
  final List<Review> reviews;
  final int count;
  final double average;
  const ReviewSummary(
      {required this.reviews, required this.count, required this.average});

  factory ReviewSummary.fromJson(Map<String, dynamic> j) => ReviewSummary(
        reviews: (j['reviews'] as List).map((r) => Review.fromJson(r)).toList(),
        count: j['count'] as int? ?? 0,
        average: (j['average'] as num?)?.toDouble() ?? 0,
      );
}
