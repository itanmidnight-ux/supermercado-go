import 'package:flutter/material.dart';
import '../utils/constants.dart';
import '../utils/formatters.dart';

enum MoneySize { small, medium, large }

class MoneyText extends StatelessWidget {
  final int amount;
  final MoneySize size;
  final int? compareAmount;

  const MoneyText({
    super.key,
    required this.amount,
    this.size = MoneySize.medium,
    this.compareAmount,
  });

  @override
  Widget build(BuildContext context) {
    final fontSize = switch (size) {
      MoneySize.small => 13.0,
      MoneySize.medium => 16.0,
      MoneySize.large => 22.0,
    };

    final fontWeight = switch (size) {
      MoneySize.small => FontWeight.w600,
      MoneySize.medium => FontWeight.bold,
      MoneySize.large => FontWeight.bold,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          formatCOP(amount),
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: fontWeight,
            color: AppColors.primary,
          ),
        ),
        if (compareAmount != null && compareAmount! > amount)
          Text(
            formatCOP(compareAmount!),
            style: TextStyle(
              fontSize: fontSize - 3,
              color: AppColors.gray,
              decoration: TextDecoration.lineThrough,
            ),
          ),
      ],
    );
  }
}
