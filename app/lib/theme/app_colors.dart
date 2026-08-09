import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Core brand
  static const Color primary = Color(0xFF00B860);
  static const Color primaryDark = Color(0xFF009A50);
  static const Color primaryLight = Color(0xFFE8F9F0);
  static const Color accent = Color(0xFFFF8C00);
  static const Color gold = Color(0xFFFFD93D);

  // Semantic
  static const Color success = Color(0xFF00B860);
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);

  // Light theme surfaces
  static const Color background = Color(0xFFF9FAFB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF3F4F6);

  // Text
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textHint = Color(0xFF9CA3AF);

  // Borders
  static const Color border = Color(0xFFE5E7EB);
  static const Color divider = Color(0xFFF3F4F6);

  // Grays
  static const Color gray = Color(0xFF6B7280);
  static const Color lightGray = Color(0xFFF3F4F6);
  static const Color darkGray = Color(0xFF374151);

  // Status
  static const Color statusPending = Color(0xFFF59E0B);
  static const Color statusConfirmed = Color(0xFF3B82F6);
  static const Color statusPreparing = Color(0xFF8B5CF6);
  static const Color statusReady = Color(0xFF10B981);
  static const Color statusAssigned = Color(0xFF6366F1);
  static const Color statusInTransit = Color(0xFF0EA5E9);
  static const Color statusDelivered = Color(0xFF00B860);
  static const Color statusCancelled = Color(0xFFEF4444);
  static const Color statusPickedUp = Color(0xFF00B860);

  // Dark theme
  static const Color darkBackground = Color(0xFF0F172A);
  static const Color darkSurface = Color(0xFF1E293B);
  static const Color darkSurfaceVariant = Color(0xFF334155);
  static const Color darkTextPrimary = Color(0xFFF1F5F9);
  static const Color darkTextSecondary = Color(0xFF94A3B8);
  static const Color darkBorder = Color(0xFF334155);
  static const Color darkDivider = Color(0xFF1E293B);
}

class AppColorsDark {
  static const Color background = AppColors.darkBackground;
  static const Color surface = AppColors.darkSurface;
  static const Color surfaceVariant = AppColors.darkSurfaceVariant;
  static const Color textPrimary = AppColors.darkTextPrimary;
  static const Color textSecondary = AppColors.darkTextSecondary;
  static const Color border = AppColors.darkBorder;
  static const Color divider = AppColors.darkDivider;
}
