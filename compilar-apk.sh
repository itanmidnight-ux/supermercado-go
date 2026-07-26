#!/bin/bash
# ========================================
# SCRIPT DE COMPILACIÓN APK - SUPERMERCADO GO
# Compilación rápida y optimizada para Android
# ========================================

set -e  # Detener en caso de error

echo "========================================"
echo "🛒 SUPERMERCADO GO - Compilación APK"
echo "========================================"
echo ""

# Verificar que Flutter esté instalado
if ! command -v flutter &> /dev/null; then
    echo "❌ Error: Flutter no está instalado o no está en el PATH"
    exit 1
fi

echo "✓ Flutter encontrado: $(flutter --version | head -n 1)"
echo ""

# Navegar al directorio del proyecto móvil
cd "$(dirname "$0")/android-app" || exit 1

echo "📁 Directorio: $(pwd)"
echo ""

# Limpiar build anterior
echo "🧹 Limpiando build anterior..."
flutter clean
echo ""

# Obtener dependencias
echo "📦 Obteniendo dependencias..."
flutter pub get
echo ""

# Verificar estado del proyecto
echo "🔍 Verificando proyecto..."
flutter doctor
echo ""

# Compilar APK release optimizado
echo "🚀 Compilando APK release..."
echo "   Esto puede tomar algunos minutos..."
flutter build apk --release --split-per-abi --target-platform android-arm,android-arm64,android-x64

echo ""
echo "========================================"
echo "✅ ¡Compilación completada exitosamente!"
echo "========================================"
echo ""

# Mostrar ubicación de los APKs generados
APK_DIR="build/app/outputs/flutter-apk"
echo "📱 APKs generados en:"
echo "   $APK_DIR/"
echo ""

if [ -d "$APK_DIR" ]; then
    echo "Archivos APK:"
    ls -lh "$APK_DIR"/*.apk 2>/dev/null || echo "   No se encontraron archivos APK"
    echo ""
    
    # Tamaño de los APKs
    echo "💾 Tamaños:"
    for apk in "$APK_DIR"/*.apk; do
        if [ -f "$apk" ]; then
            size=$(du -h "$apk" | cut -f1)
            name=$(basename "$apk")
            echo "   $name: $size"
        fi
    done
else
    echo "⚠️  Directorio de salida no encontrado"
fi

echo ""
echo "========================================"
echo "📋 Instrucciones de instalación:"
echo "========================================"
echo "1. Conecta tu dispositivo Android vía USB"
echo "2. Ejecuta: flutter install"
echo "   O copia manualmente el APK a tu dispositivo"
echo ""
echo "Para instalar directamente:"
echo "   flutter install --apk-path=$APK_DIR/app-release.apk"
echo "========================================"
echo ""
echo "✨ ¡Listo para distribuir!"
