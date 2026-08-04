#!/usr/bin/env bash
# ============================================================================
# compilar-apk.sh — Compilar Supermercados Go (Flutter) a APK
# Compatible: Ubuntu, Debian, Kali Linux, CentOS, Fedora, Arch
# ============================================================================
set -euo pipefail

# ── Colores ─────────────────────────────────────────────────────────────────
V='\033[0;32m' Y='\033[1;33m' R='\033[0;31m' B='\033[0;34m'
C='\033[0;36m' W='\033[1;37m' G='\033[0;90m' N='\033[0m' BLD='\033[1m'

ok()   { echo -e "${V}[✓]${N} $1"; }
warn() { echo -e "${Y}[!]${N} $1"; }
fail() { echo -e "${R}[✗]${N} $1"; }
info() { echo -e "${B}[i]${N} $1"; }
step() { echo -e "\n${C}${BLD}── $1 ──${N}"; }

# ── Variables ───────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR}/app"
BUILD_DIR="${SCRIPT_DIR}/build"
LOG_FILE="/tmp/supermercados-go-apk-$(date +%Y%m%d-%H%M%S).log"
KEYSTORE_FILE="${SCRIPT_DIR}/android.keystore"
FLUTTER_DIR=""
PKG_MGR=""; SUDO=""

# ── Detección de sistema ───────────────────────────────────────────────────
detect_system() {
  if command -v sudo &>/dev/null && [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
  if command -v apt-get &>/dev/null; then PKG_MGR="apt"
  elif command -v dnf &>/dev/null; then PKG_MGR="dnf"
  elif command -v yum &>/dev/null; then PKG_MGR="yum"
  elif command -v pacman &>/dev/null; then PKG_MGR="pacman"
  elif command -v zypper &>/dev/null; then PKG_MGR="zypper"
  fi
  [ -n "$PKG_MGR" ] && ok "Paquetes: $PKG_MGR" || warn "Gestor no detectado"
}

pkg_install() {
  [ -z "$PKG_MGR" ] && { warn "No se puede instalar: $*"; return 0; }
  case "$PKG_MGR" in
    apt)  $SUDO apt-get update -qq 2>/dev/null; $SUDO apt-get install -y -qq "$@" 2>&1 | tail -3 ;;
    dnf)  $SUDO dnf install -y "$@" 2>&1 | tail -3 ;;
    yum)  $SUDO yum install -y "$@" 2>&1 | tail -3 ;;
    pacman) $SUDO pacman -Sy --noconfirm "$@" 2>&1 | tail -3 ;;
    zypper) $SUDO zypper --non-interactive install "$@" 2>&1 | tail -3 ;;
  esac
}

# ── Verificar/Instalar Flutter ─────────────────────────────────────────────
find_flutter() {
  # Buscar en PATH
  if command -v flutter &>/dev/null; then
    FLUTTER_DIR=$(dirname "$(dirname "$(which flutter)")")
    return 0
  fi
  # Buscar en ubicaciones comunes
  local paths=(
    "$HOME/flutter" "$HOME/flutter-sdk" "$HOME/snap/flutter/common/flutter"
    "$HOME/development/flutter" "/opt/flutter" "/usr/lib/flutter"
    "$HOME/Android/flutter" "$HOME/Documents/flutter"
    "$HOME/Descargas/flutter"
  )
  for p in "${paths[@]}"; do
    if [ -x "$p/bin/flutter" ]; then
      FLUTTER_DIR="$p"
      export PATH="$p/bin:$PATH"
      return 0
    fi
  done
  return 1
}

install_flutter() {
  step "Instalando Flutter SDK"
  info "Descargando Flutter 3.24.x (estable)..."
  local url="https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.24.5-stable.tar.xz"
  local tmpf="/tmp/flutter-sdk.tar.xz"

  if command -v wget &>/dev/null; then
    wget -q --show-progress -O "$tmpf" "$url" 2>&1
  elif command -v curl &>/dev/null; then
    curl -L -o "$tmpf" "$url" 2>&1
  else
    pkg_install wget curl
    wget -q --show-progress -O "$tmpf" "$url" 2>&1
  fi

  mkdir -p "$HOME/development"
  tar xf "$tmpf" -C "$HOME/development" 2>&1
  rm -f "$tmpf"
  FLUTTER_DIR="$HOME/development/flutter"
  export PATH="$FLUTTER_DIR/bin:$PATH"
  ok "Flutter instalado en $FLUTTER_DIR"

  warn "Agrega Flutter a tu PATH para futuras sesiones:"
  echo -e "  ${C}echo 'export PATH=\"\$HOME/development/flutter/bin:\$PATH\"' >> ~/.bashrc${N}"
}

# ── Verificar/Instalar Android SDK ─────────────────────────────────────────
find_android_sdk() {
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then return 0; fi
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"; return 0
  fi
  local paths=(
    "$HOME/Android/Sdk" "$HOME/android-sdk" "$HOME/AndroidSDK"
    "$HOME/development/android-sdk" "/opt/android-sdk"
    "$HOME/Library/Android/sdk"
  )
  for p in "${paths[@]}"; do
    if [ -d "$p/platforms" ]; then
      export ANDROID_HOME="$p"
      return 0
    fi
  done
  return 1
}

install_android_sdk() {
  step "Instalando Android SDK (cmdline-tools)"

  # Verificar Java
  if ! command -v java &>/dev/null; then
    info "Instalando JDK 17..."
    case "$PKG_MGR" in
      apt)  pkg_install openjdk-17-jdk-headless ;;
      dnf)  pkg_install java-17-openjdk-devel ;;
      pacman) pkg_install jdk17-openjdk ;;
      *)    pkg_install java-17-openjdk-headless 2>/dev/null || pkg_install java-openjdk ;;
    esac
  fi

  local sdk_dir="$HOME/Android/Sdk"
  mkdir -p "$sdk_dir/cmdline-tools"

  info "Descargando Android cmdline-tools..."
  local url="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
  local tmpf="/tmp/cmdline-tools.zip"
  if command -v wget &>/dev/null; then wget -q -O "$tmpf" "$url" 2>&1
  elif command -v curl &>/dev/null; then curl -L -o "$tmpf" "$url" 2>&1
  fi

  unzip -qo "$tmpf" -d "$sdk_dir/cmdline-tools" 2>/dev/null
  mv "$sdk_dir/cmdline-tools/cmdline-tools" "$sdk_dir/cmdline-tools/latest" 2>/dev/null || true
  rm -f "$tmpf"

  export ANDROID_HOME="$sdk_dir"
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

  yes | sdkmanager --licenses 2>/dev/null || true
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" 2>&1 | tail -5

  ok "Android SDK instalado"
  warn "Agrega a tu PATH:"
  echo -e "  ${C}export ANDROID_HOME=\"\$HOME/Android/Sdk\"${N}"
  echo -e "  ${C}export PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\"${N}"
}

# ── Configurar proyecto Flutter ───────────────────────────────────────────
configure_project() {
  step "Configurando proyecto Flutter"
  cd "$APP_DIR"

  flutter config --no-analytics 2>/dev/null || true
  flutter pub get 2>&1 | tail -5

  ok "Dependencias Flutter resueltas"
  cd "$SCRIPT_DIR"
}

# ── Compilar APK ───────────────────────────────────────────────────────────
build_apk() {
  local build_type="${1:-release}"
  step "Compilando APK ($build_type)"
  cd "$APP_DIR"

  # Crear keystore para firmar si no existe
  if [ "$build_type" = "release" ] && [ ! -f "$KEYSTORE_FILE" ]; then
    warn "No se encontró keystore. Creando uno para desarrollo..."
    keytool -genkeypair -v \
      -storetype PKCS12 \
      -keystore "$KEYSTORE_FILE" \
      -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass supermercados \
      -keypass supermercados \
      -alias supermercados \
      -dname "CN=Supermercados Go, O=Supermercados Go, L=Cucuta, ST=Norte de Santander, C=CO" 2>&1
  fi

  if [ "$build_type" = "release" ]; then
    flutter build apk --release \
      --build-number="$(date +%Y%m%d%H%M)" \
      2>&1 | tee "$LOG_FILE"
  else
    flutter build apk --debug 2>&1 | tee "$LOG_FILE"
  fi

  cd "$SCRIPT_DIR"
}

# ── Verificar el APK generado ─────────────────────────────────────────────
check_apk() {
  step "Verificando APK"
  local apk_path="${APP_DIR}/build/app/outputs/flutter-apk/app-release.apk"
  if [ ! -f "$apk_path" ]; then
    apk_path="${APP_DIR}/build/app/outputs/flutter-apk/app-debug.apk"
  fi
  if [ -f "$apk_path" ]; then
    local size=$(du -h "$apk_path" | cut -f1)
    mkdir -p "$BUILD_DIR"
    cp "$apk_path" "${BUILD_DIR}/supermercados-go.apk"
    ok "APK generado: ${BUILD_DIR}/supermercados-go.apk (${size})"
  else
    fail "No se encontró el APK. Revisa el log: $LOG_FILE"
    exit 1
  fi
}

# ── Menú principal ─────────────────────────────────────────────────────────
main_menu() {
  echo -e ""
  echo -e "${V}╔══════════════════════════════════════════════════════════════╗${N}"
  echo -e "${V}║${N}  ${W}${BLD}🛒 Supermercados Go — Compilar APK${N}                           ${V}║${N}"
  echo -e "${V}║${N}  ${G}Compatible: Ubuntu · Debian · Kali · CentOS · Fedora · Arch${N}     ${V}║${N}"
  echo -e "${V}╚══════════════════════════════════════════════════════════════╝${N}"
  echo -e ""
  echo -e "  ${V}1)${N} ${BLD}Compilar APK Release${N} (optimizado, firmado)"
  echo -e "  ${Y}2)${N} ${BLD}Compilar APK Debug${N} (rápido, para pruebas)"
  echo -e "  ${B}3)${N} ${BLD}Instalar en dispositivo conectado${N} (adb)"
  echo -e "  ${G}0)${N} Salir"
  echo -e ""
  echo -en "  ${C}${BLD}Opción:${N} "
  local opt; read -r opt
  case "$opt" in
    1) build_apk release; check_apk ;;
    2) build_apk debug; check_apk ;;
    3)
      if command -v adb &>/dev/null; then
        local apk="${APP_DIR}/build/app/outputs/flutter-apk/app-release.apk"
        [ ! -f "$apk" ] && apk="${APP_DIR}/build/app/outputs/flutter-apk/app-debug.apk"
        if [ -f "$apk" ]; then
          adb install -r "$apk" 2>&1
          ok "APK instalado en el dispositivo"
        else
          fail "No hay APK. Compila primero (opción 1 o 2)"
        fi
      else
        fail "adb no encontrado. Instala platform-tools del Android SDK"
      fi
      ;;
    0) exit 0 ;;
    *) fail "Opción inválida"; exit 1 ;;
  esac
}

# ═══════════════════════════════════════════════════════════════════════════
# INICIO
# ═══════════════════════════════════════════════════════════════════════════
detect_system

# Verificar Java
if ! command -v java &>/dev/null; then
  step "Instalando JDK"
  case "$PKG_MGR" in
    apt)  pkg_install openjdk-17-jdk-headless 2>/dev/null || pkg_install default-jdk-headless ;;
    dnf)  pkg_install java-17-openjdk-devel 2>/dev/null || pkg_install java-openjdk-devel ;;
    pacman) pkg_install jdk17-openjdk 2>/dev/null || pkg_install jdk-openjdk ;;
    *)    pkg_install openjdk-17-jdk 2>/dev/null || pkg_install java-17-openjdk 2>/dev/null || pkg_install default-jdk ;;
  esac
  ok "JDK instalado"
fi

# Verificar Flutter
if ! find_flutter; then
  install_flutter
fi

# Verificar Android SDK
if ! find_android_sdk; then
  install_android_sdk
fi

# Configurar y compilar
configure_project
main_menu
