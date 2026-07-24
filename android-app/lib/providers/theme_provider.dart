import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class ThemeProvider extends ChangeNotifier {
  Color _primary = const Color(0xFF2D5016);
  Color _accent = const Color(0xFFD4800A);
  String _brandName = 'Supermercado GO';
  String? _logoFilename;

  ThemeData get lightTheme => AppTheme.build(
      primary: _primary, accent: _accent, brightness: Brightness.light);
  ThemeData get darkTheme => AppTheme.build(
      primary: _primary, accent: _accent, brightness: Brightness.dark);
  String get brandName => _brandName;
  String? get logoFilename => _logoFilename;
  Color get primary => _primary;
  Color get accent => _accent;

  Color _parseHex(String hex, Color fallback) {
    final clean = hex.replaceAll('#', '');
    if (clean.length != 6) return fallback;
    final value = int.tryParse('FF$clean', radix: 16);
    return value != null ? Color(value) : fallback;
  }

  void _applySettings(Map<String, String> s) {
    _primary = _parseHex(s['theme_primary'] ?? '', _primary);
    _accent = _parseHex(s['theme_accent'] ?? '', _accent);
    _brandName =
        (s['theme_name'] ?? '').isNotEmpty ? s['theme_name']! : _brandName;
    _logoFilename =
        (s['theme_logo_url'] ?? '').isNotEmpty ? s['theme_logo_url'] : null;
    notifyListeners();
  }

  Future<void> load() async {
    try {
      _applySettings(await ApiService.getSettings());
    } catch (_) {
      // Sin conexión al cargar: se queda con los defaults, no rompe el arranque
    }
  }

  /// Marca (nombre/logo/colores) sin sesión iniciada -- para que la
  /// pantalla de login muestre la marca real configurada por el admin en
  /// vez de quedarse con el fallback fijo del código.
  Future<void> loadPublic() async {
    try {
      _applySettings(await ApiService.getPublicSettings());
    } catch (_) {
      // Sin conexión / servidor no configurado aún: se queda con los defaults
    }
  }

  Future<void> reload() => load();
}
