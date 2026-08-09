import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTypography {
  AppTypography._();

  static const String fontFamily = 'Poppins';

  // Light theme text styles
  static const TextStyle h1 = TextStyle(
    fontFamily: fontFamily, fontSize: 32, fontWeight: FontWeight.w700,
    color: AppColors.textPrimary, height: 1.2,
  );
  static const TextStyle h2 = TextStyle(
    fontFamily: fontFamily, fontSize: 24, fontWeight: FontWeight.w700,
    color: AppColors.textPrimary, height: 1.3,
  );
  static const TextStyle h3 = TextStyle(
    fontFamily: fontFamily, fontSize: 20, fontWeight: FontWeight.w600,
    color: AppColors.textPrimary, height: 1.3,
  );
  static const TextStyle h4 = TextStyle(
    fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w600,
    color: AppColors.textPrimary, height: 1.4,
  );
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w400,
    color: AppColors.textPrimary, height: 1.5,
  );
  static const TextStyle bodyMedium = TextStyle(
    fontFamily: fontFamily, fontSize: 14, fontWeight: FontWeight.w400,
    color: AppColors.textPrimary, height: 1.5,
  );
  static const TextStyle bodySmall = TextStyle(
    fontFamily: fontFamily, fontSize: 12, fontWeight: FontWeight.w400,
    color: AppColors.textSecondary, height: 1.5,
  );
  static const TextStyle label = TextStyle(
    fontFamily: fontFamily, fontSize: 12, fontWeight: FontWeight.w500,
    color: AppColors.textSecondary, height: 1.4,
  );
  static const TextStyle button = TextStyle(
    fontFamily: fontFamily, fontSize: 14, fontWeight: FontWeight.w600,
    color: Colors.white, height: 1.4,
  );
  static const TextStyle price = TextStyle(
    fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w700,
    color: AppColors.primary, height: 1.2,
  );
  static const TextStyle priceSmall = TextStyle(
    fontFamily: fontFamily, fontSize: 14, fontWeight: FontWeight.w600,
    color: AppColors.primary, height: 1.2,
  );
  static const TextStyle priceOld = TextStyle(
    fontFamily: fontFamily, fontSize: 12, fontWeight: FontWeight.w400,
    color: AppColors.textHint, height: 1.2,
    decoration: TextDecoration.lineThrough,
  );

  // Dark theme overrides
  static TextStyle h1Dark = h1.copyWith(color: AppColors.darkTextPrimary);
  static TextStyle h2Dark = h2.copyWith(color: AppColors.darkTextPrimary);
  static TextStyle h3Dark = h3.copyWith(color: AppColors.darkTextPrimary);
  static TextStyle h4Dark = h4.copyWith(color: AppColors.darkTextPrimary);
  static TextStyle bodyLargeDark = bodyLarge.copyWith(color: AppColors.darkTextPrimary);
  static TextStyle bodyMediumDark = bodyMedium.copyWith(color: AppColors.darkTextPrimary);
  static TextStyle bodySmallDark = bodySmall.copyWith(color: AppColors.darkTextSecondary);
}
