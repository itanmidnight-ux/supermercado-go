#!/usr/bin/env bash
# ============================================================================
# deploy-linux.sh — Supermercados Go — Despliegue universal Linux
# Compatible: Ubuntu, Debian, Kali Linux, CentOS, Fedora, Arch, openSUSE
# ============================================================================
set -euo pipefail

# ── Colores ─────────────────────────────────────────────────────────────────
V='\033[0;32m' Y='\033[1;33m' R='\033[0;31m' B='\033[0;34m'
C='\033[0;36m' M='\033[0;35m' W='\033[1;37m' G='\033[0;90m' N='\033[0m' BLD='\033[1m'

ok()   { echo -e "${V}[✓]${N} $1"; }
warn() { echo -e "${Y}[!]${N} $1"; }
fail() { echo -e "${R}[✗]${N} $1"; }
info() { echo -e "${B}[i]${N} $1"; }
step() { echo -e "\n${C}${BLD}── $1 ──${N}"; }

# ── Rutas ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/server"
ENV_FILE="${SERVER_DIR}/.env"
DATA_DIR="${SERVER_DIR}/data"
APP_NAME="supermercados-go"
REAL_USER="${SUDO_USER:-$(whoami)}"

# Si el script corre como root (via sudo), node_modules/.env/data quedan
# root:root y rompen builds nativos (better-sqlite3) en la próxima corrida
# sin sudo. Se re-asigna dueño al usuario real después de escribir en SERVER_DIR.
fix_ownership() {
  [ "$(id -u)" -eq 0 ] || return 0
  [ -n "${SUDO_USER:-}" ] || return 0
  chown -R "${SUDO_USER}:${SUDO_USER}" "$SERVER_DIR" 2>/dev/null || true
}

# Corre un comando como el usuario real (-i para heredar su PATH/profile, ej.
# ~/.local/bin) en vez de como root, cuando el script se invocó con sudo.
# Así node/npm que compilan e inician el servidor son siempre los mismos que
# usará el usuario después, sin importar si corrió el script con o sin sudo.
as_real_user() {
  if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    sudo -iu "$SUDO_USER" -- bash -c "$1"
  else
    bash -c "$1"
  fi
}

# ── Variables globales ──────────────────────────────────────────────────────
PORT="3777"; HOST="0.0.0.0"; JWT_SECRET=""; API_KEY=""
BUSINESS_NAME="Supermercados Go"; BUSINESS_PHONE="+573044016277"
BUSINESS_EMAIL="contacto@supermercadosgo.com"; BUSINESS_ADDRESS="Cúcuta, Norte de Santander"
BUSINESS_CITY="Cúcuta"; DELIVERY_FEE="4900"; FREE_DELIVERY_MIN="50000"
OPERATING_ZONE="Cúcuta"; DEPLOY_MODE=""

# ── Detección de sistema ───────────────────────────────────────────────────
PKG_MGR=""; SUDO=""

detect_system() {
  if command -v sudo &>/dev/null && [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
  if command -v apt-get &>/dev/null; then PKG_MGR="apt"
  elif command -v dnf &>/dev/null; then PKG_MGR="dnf"
  elif command -v yum &>/dev/null; then PKG_MGR="yum"
  elif command -v pacman &>/dev/null; then PKG_MGR="pacman"
  elif command -v zypper &>/dev/null; then PKG_MGR="zypper"
  fi
  [ -n "$PKG_MGR" ] && ok "Sistema detectado: $PKG_MGR" || warn "Gestor de paquetes no detectado"
}

# ── Instalar paquetes ──────────────────────────────────────────────────────
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

# ── Utilidades ─────────────────────────────────────────────────────────────
detect_ip() {
  local ip=""
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -z "$ip" ] && ip=$(ip addr 2>/dev/null | awk '/inet / && !/127\.0/{print $2;exit}' | cut -d/ -f1)
  [ -z "$ip" ] && ip=$(ifconfig 2>/dev/null | awk '/inet / && !/127\.0/{print $2;exit}' | cut -d: -f2)
  echo "${ip:-127.0.0.1}"
}

gen_secret() {
  if command -v openssl &>/dev/null; then openssl rand -hex 32
  elif command -v python3 &>/dev/null; then python3 -c "import secrets;print(secrets.token_hex(32))"
  else head -c 32 /dev/urandom | od -A n -t x1 | tr -d ' \n' | head -c 64
  fi
}

ask() {
  local pr="$1" def="${2:-}" var="$3"
  if [ -n "$def" ]; then echo -en "${C}${BLD}${pr}${N} ${G}[${def}]${N}: "
  else echo -en "${C}${BLD}${pr}${N}: "; fi
  local input; read -r input; input="${input:-$def}"
  printf -v "$var" "%s" "$input"
}

ask_yes() {
  local pr="$1" def="${2:-n}"
  echo -en "${C}${BLD}${pr}${N} ${G}[${def}]${N}: "
  local input; read -r input; input="${input:-$def}"
  [[ "$input" =~ ^[YySs]$ ]]
}

# ── Verificar Node.js ──────────────────────────────────────────────────────
check_node() {
  if command -v node &>/dev/null; then
    local v; v=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
    if [ "$v" -ge 18 ] 2>/dev/null; then
      ok "Node.js $(node -v) detectado"; return 0
    else
      warn "Node.js $(node -v) encontrado (se recomienda v20+)"
    fi
  fi
  return 1
}

install_node() {
  step "Instalando Node.js 20 LTS"
  if check_node; then return 0; fi
  case "$PKG_MGR" in
    apt)
      $SUDO apt-get update -qq 2>/dev/null
      $SUDO apt-get install -y -qq curl ca-certificates gnupg 2>/dev/null
      curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - 2>/dev/null
      $SUDO apt-get install -y -qq nodejs 2>&1 | tail -3
      ;;
    dnf)
      $SUDO dnf module reset nodejs -y 2>/dev/null || true
      $SUDO dnf module enable nodejs:20 -y 2>/dev/null || true
      $SUDO dnf install -y nodejs 2>&1 | tail -3
      ;;
    pacman)
      $SUDO pacman -Sy --noconfirm nodejs npm 2>&1 | tail -3
      ;;
    *)
      warn "Instalación automática no disponible para $PKG_MGR"
      info "Instala Node.js 20+ manualmente: https://nodejs.org/"
      if ! command -v node &>/dev/null; then
        fail "Node.js no encontrado. No se puede continuar."; exit 1
      fi
      ;;
  esac
  if check_node; then return 0; fi
  fail "No se pudo instalar Node.js"; exit 1
}

# ── Crear .env ─────────────────────────────────────────────────────────────
create_env() {
  step "Configurando variables de entorno"
  JWT_SECRET=$(gen_secret)
  API_KEY=$(gen_secret)

  ask "Nombre del negocio" "$BUSINESS_NAME" BUSINESS_NAME
  ask "Teléfono del negocio" "$BUSINESS_PHONE" BUSINESS_PHONE
  ask "Correo del negocio" "$BUSINESS_EMAIL" BUSINESS_EMAIL
  ask "Dirección" "$BUSINESS_ADDRESS" BUSINESS_ADDRESS
  ask "Ciudad" "$BUSINESS_CITY" BUSINESS_CITY
  ask "Tarifa de domicilio (COP)" "$DELIVERY_FEE" DELIVERY_FEE
  ask "Pedido mínimo para envío gratis (COP)" "$FREE_DELIVERY_MIN" FREE_DELIVERY_MIN
  ask "Zona de operación" "$OPERATING_ZONE" OPERATING_ZONE
  ask "Puerto del servidor" "$PORT" PORT

  cat > "$ENV_FILE" << ENVEOF
# Generado por deploy-linux.sh — $(date -Iseconds)
NODE_ENV=${DEPLOY_MODE}
PORT=${PORT}
HOST=${HOST}

# Seguridad
JWT_SECRET=${JWT_SECRET}
API_KEY=${API_KEY}

# Base de datos
DB_PATH=./data/supermercados.db

# Negocio
BUSINESS_NAME=${BUSINESS_NAME}
BUSINESS_PHONE=${BUSINESS_PHONE}
BUSINESS_EMAIL=${BUSINESS_EMAIL}
BUSINESS_ADDRESS=${BUSINESS_ADDRESS}
BUSINESS_CITY=${BUSINESS_CITY}
BUSINESS_DEPARTMENT=Norte de Santander
BUSINESS_HOURS=6:00 AM - 9:00 PM
BUSINESS_TAGLINE=Tu supermercado a la puerta de tu casa

# Delivery
DELIVERY_FEE_DEFAULT=${DELIVERY_FEE}
FREE_DELIVERY_MIN=${FREE_DELIVERY_MIN}
OPERATING_ZONE=${OPERATING_ZONE}

# CORS (en producción poner dominios separados por coma, o * para todo)
CORS_ORIGINS=*
ENVEOF
  ok ".env creado en ${ENV_FILE}"
}

# ── Instalar dependencias del servidor ─────────────────────────────────────
install_server_deps() {
  step "Instalando dependencias del servidor"
  cd "$SERVER_DIR"
  # Verificar compilación nativa de better-sqlite3
  if ! pkg_install build-essential python3 make gcc g++ 2>/dev/null; then
    pkg_install gcc python3 make 2>/dev/null || true
  fi
  npm install --production 2>&1 | tail -5
  # Recompilar módulos nativos contra el Node que ejecuta este script
  # (evita ERR_DLOPEN_FAILED al alternar entre Node de usuario y Node de root/sudo)
  npm rebuild better-sqlite3 2>&1 | tail -5
  fix_ownership
  ok "Dependencias instaladas"
  cd "$SCRIPT_DIR"
}

# ── Ejecutar migraciones ───────────────────────────────────────────────────
run_migrations() {
  step "Ejecutando migraciones de base de datos"
  mkdir -p "$DATA_DIR/uploads"
  cd "$SERVER_DIR"
  node -e "const {runMigrations}=require('./src/migrate');runMigrations();" 2>&1
  fix_ownership
  ok "Migraciones ejecutadas"
  cd "$SCRIPT_DIR"
}

# ═══════════════════════════════════════════════════════════════════════════
# MODO 1: DESPLIEGUE COMO SERVIDOR (Producción)
# ═══════════════════════════════════════════════════════════════════════════
deploy_production() {
  DEPLOY_MODE="production"
  echo -e "\n${V}${BLD}══ MODO PRODUCCIÓN ══${N}"
  info "Se instalará Node.js, PM2, se configurará firewall y systemd"
  echo -e ""

  # 1. Instalar Node.js
  install_node

  # 2. Instalar PM2
  step "Instalando PM2"
  if ! command -v pm2 &>/dev/null; then
    npm install -g pm2 2>&1 | tail -3
    ok "PM2 instalado"
  else
    ok "PM2 ya instalado: $(pm2 -v 2>/dev/null)"
  fi

  # 3. Crear .env interactivo
  create_env

  # 4. Dependencias + migraciones
  install_server_deps
  run_migrations

  # 5. Firewall
  step "Configurando firewall"
  if command -v ufw &>/dev/null; then
    $SUDO ufw allow ${PORT}/tcp 2>/dev/null && ok "Puerto ${PORT} abierto en UFW"
    if ! $SUDO ufw status | grep -q "active"; then
      warn "UFW no está activo. Actívalo con: sudo ufw enable"
    fi
  elif command -v firewall-cmd &>/dev/null; then
    $SUDO firewall-cmd --permanent --add-port=${PORT}/tcp 2>/dev/null
    $SUDO firewall-cmd --reload 2>/dev/null
    ok "Puerto ${PORT} abierto en firewalld"
  else
    warn "No se encontró ufw ni firewalld. Configura el firewall manualmente."
  fi

  # 6. Nginx (opcional)
  if ask_yes "¿Deseas configurar Nginx como proxy inverso?" "n"; then
    setup_nginx
  fi

  # 7. Systemd
  if command -v systemctl &>/dev/null; then
    setup_systemd
  fi

  # 8. Iniciar con PM2
  step "Iniciando servidor con PM2"
  cd "$SERVER_DIR"
  pm2 delete "$APP_NAME" 2>/dev/null || true
   pm2 start src/index.js --name "$APP_NAME" \
    --node-args="--max-old-space-size=512" 2>&1
  pm2 save 2>/dev/null
  pm2 startup 2>/dev/null | tail -1 || true
  cd "$SCRIPT_DIR"
  ok "Servidor iniciado con PM2"

  show_summary
}

setup_nginx() {
  step "Configurando Nginx"
  if ! command -v nginx &>/dev/null; then
    pkg_install nginx 2>/dev/null || { warn "No se pudo instalar Nginx"; return; }
  fi
  ask "Dominio del sitio (ej: mi-supermercado.com, dejar vacío para IP)" "" NGINX_DOMAIN
  local server_name="${NGINX_DOMAIN:-_}"

  $SUDO tee /etc/nginx/sites-available/supermercados-go > /dev/null << EOF
server {
    listen 80;
    server_name ${server_name};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
    }

    location /uploads {
        alias ${SERVER_DIR}/data/uploads;
        expires 24h;
    }
}
EOF

  # Activar sitio
  if [ -d /etc/nginx/sites-enabled ]; then
    $SUDO ln -sf /etc/nginx/sites-available/supermercados-go /etc/nginx/sites-enabled/ 2>/dev/null
    $SUDO rm -f /etc/nginx/sites-enabled/default 2>/dev/null
  elif [ -d /etc/nginx/conf.d ]; then
    $SUDO ln -sf /etc/nginx/sites-available/supermercados-go /etc/nginx/conf.d/supermercados-go.conf 2>/dev/null
  fi

  $SUDO nginx -t 2>/dev/null && {
    $SUDO systemctl reload nginx 2>/dev/null || $SUDO nginx -s reload 2>/dev/null || true
    ok "Nginx configurado"
  }
}

setup_systemd() {
  step "Configurando servicio systemd"
  local service_path="/etc/systemd/system/${APP_NAME}.service"
  $SUDO tee "$service_path" > /dev/null << EOF
[Unit]
Description=Supermercados Go Server
After=network.target

[Service]
Type=simple
User=${REAL_USER}
WorkingDirectory=${SERVER_DIR}
ExecStart=$(which node) src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload 2>/dev/null
  $SUDO systemctl enable ${APP_NAME} 2>/dev/null
  ok "Servicio systemd creado (no se activa si PM2 ya maneja el proceso)"
}

# ═══════════════════════════════════════════════════════════════════════════
# MODO 2: DESARROLLO / PRUEBA
# ═══════════════════════════════════════════════════════════════════════════
deploy_dev() {
  DEPLOY_MODE="development"
  echo -e "\n${Y}${BLD}══ MODO DESARROLLO / PRUEBA ══${N}"
  info "Solo se instalarán dependencias mínimas y se iniciará el servidor"
  info "NO se configurará: firewall, Nginx, systemd, PM2"
  echo -e ""

  # 1. Node.js
  install_node

  # 2. .env con defaults de desarrollo
  step "Creando .env de desarrollo"
  JWT_SECRET=$(gen_secret)
  API_KEY=$(gen_secret)
  mkdir -p "$DATA_DIR/uploads"

  cat > "$ENV_FILE" << ENVEOF
# Generado por deploy-linux.sh — Modo Desarrollo — $(date -Iseconds)
NODE_ENV=development
PORT=${PORT}
HOST=${HOST}
JWT_SECRET=${JWT_SECRET}
API_KEY=${API_KEY}
DB_PATH=./data/supermercados.db
BUSINESS_NAME=${BUSINESS_NAME}
BUSINESS_PHONE=${BUSINESS_PHONE}
BUSINESS_EMAIL=${BUSINESS_EMAIL}
BUSINESS_ADDRESS=${BUSINESS_ADDRESS}
BUSINESS_CITY=${BUSINESS_CITY}
BUSINESS_DEPARTMENT=Norte de Santander
BUSINESS_HOURS=6:00 AM - 9:00 PM
BUSINESS_TAGLINE=Tu supermercado a la puerta de tu casa
DELIVERY_FEE_DEFAULT=${DELIVERY_FEE}
FREE_DELIVERY_MIN=${FREE_DELIVERY_MIN}
OPERATING_ZONE=${OPERATING_ZONE}
CORS_ORIGINS=*
ENVEOF
  fix_ownership
  ok ".env de desarrollo creado"

  # 3. Dependencias (siempre como el usuario real, nunca como root:
  #    node/npm de root pueden ser una versión distinta a la del usuario,
  #    y eso rompe el binario nativo de better-sqlite3 en la próxima corrida)
  step "Instalando dependencias"
  # Intentar instalar build tools para better-sqlite3 (esto sí requiere root)
  pkg_install build-essential python3 make gcc 2>/dev/null || \
    pkg_install gcc python3 make 2>/dev/null || true
  as_real_user "cd '$SERVER_DIR' && npm install 2>&1 | tail -5 && npm rebuild better-sqlite3 2>&1 | tail -5"
  fix_ownership
  ok "Dependencias instaladas"

  # 4. Migraciones (como el usuario real, mismo motivo)
  step "Ejecutando migraciones de base de datos"
  mkdir -p "$DATA_DIR/uploads"
  as_real_user "cd '$SERVER_DIR' && node -e \"const {runMigrations}=require('./src/migrate');runMigrations();\""
  fix_ownership
  ok "Migraciones ejecutadas"

  # 5. Iniciar servidor en primer plano (como el usuario real)
  step "Iniciando servidor en modo desarrollo"
  echo -e "\n${V}${BLD}Servidor iniciando en http://0.0.0.0:${PORT}${N}"
  echo -e "${Y}Presiona Ctrl+C para detener${N}"
  echo -e ""
  if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ]; then
    exec sudo -iu "$SUDO_USER" -- bash -c "cd '$SERVER_DIR' && exec node src/index.js"
  else
    cd "$SERVER_DIR"
    exec node src/index.js
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# MODO 3: DETENER SERVICIOS
# ═══════════════════════════════════════════════════════════════════════════
stop_services() {
  step "Deteniendo servicios de ${APP_NAME}"
  local stopped=0

  # PM2
  if command -v pm2 &>/dev/null; then
    if pm2 describe "$APP_NAME" &>/dev/null; then
      pm2 stop "$APP_NAME" 2>/dev/null
      pm2 delete "$APP_NAME" 2>/dev/null
      pm2 save 2>/dev/null
      ok "Servicio PM2 detenido"
      stopped=1
    fi
  fi

  # systemd
  if command -v systemctl &>/dev/null; then
    if $SUDO systemctl is-active --quiet "${APP_NAME}.service" 2>/dev/null; then
      $SUDO systemctl stop "${APP_NAME}" 2>/dev/null
      ok "Servicio systemd detenido"
      stopped=1
    fi
  fi

  # Proceso directo
  local pids
  pids=$(pgrep -f "node.*supermercados" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    ok "Procesos node detenidos"
    stopped=1
  fi

  [ $stopped -eq 0 ] && warn "No se encontraron servicios activos"
}

# ═══════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════════════════
show_summary() {
  local ip
  ip=$(detect_ip)
  local admin_pass=""
  local cred_file="${DATA_DIR}/PRIMER_ACCESO.txt"
  [ -f "$cred_file" ] && admin_pass=$(grep -oP '(?<=Contraseña: ).*' "$cred_file" 2>/dev/null || true)

  echo -e ""
  echo -e "${V}╔══════════════════════════════════════════════════════════════╗${N}"
  echo -e "${V}║${N}  ${W}${BLD}${BUSINESS_NAME} — Despliegue Exitoso${N}                       ${V}║${N}"
  echo -e "${V}╠══════════════════════════════════════════════════════════════╣${N}"
  echo -e "${V}║${N}  ${BLD}🔗 URLs de acceso:${N}                                        ${V}║${N}"
  echo -e "${V}║${N}                                                              ${V}║${N}"
  echo -e "${V}║${N}  Sitio Web:  ${C}http://${ip}:${PORT}${N}" | head -c 56; echo "${V}║${N}"
  echo -e "${V}║${N}  API:        ${C}http://${ip}:${PORT}/api${N}" | head -c 56; echo "${V}║${N}"
  echo -e "${V}║${N}  Health:     ${C}http://${ip}:${PORT}/api/health${N}" | head -c 56; echo "${V}║${N}"
  echo -e "${V}╠══════════════════════════════════════════════════════════════╣${N}"
  echo -e "${V}║${N}  ${BLD}📱 Configurar la app Flutter:${N}                               ${V}║${N}"
  echo -e "${V}║${N}                                                              ${V}║${N}"
  echo -e "${V}║${N}  1. Abre la app Supermercados Go                            ${V}║${N}"
  echo -e "${V}║${N}  2. En la pantalla de login pulsa                                ${V}║${N}"
  echo -e "${V}║${N}     ${Y}"Conectar con servidor"${N}                                     ${V}║${N}"
  echo -e "${V}║${N}  3. Ingresa esta URL:                                          ${V}║${N}"
  echo -e "${V}║${N}     ${BLD}${C}http://${ip}:${PORT}${N}" | head -c 56; echo "${V}║${N}"
  echo -e "${V}║${N}                                                              ${V}║${N}"
  echo -e "${V}║${N}  ${BLD}👤 Cuenta Admin:${N}                                             ${V}║${N}"
  echo -e "${V}║${N}     Email:    ${C}admin@supermercadosgo.com${N}" | head -c 56; echo "${V}║${N}"
  if [ -n "$admin_pass" ]; then
    echo -e "${V}║${N}     Password: ${C}${admin_pass}${N}" | head -c 56; echo "${V}║${N}"
  else
    echo -e "${V}║${N}     Password: ${C}ver ${cred_file}${N}" | head -c 56; echo "${V}║${N}"
  fi
  echo -e "${V}║${N}     ${R}⚠ Cambia la contraseña después del primer inicio${N}" | head -c 56; echo "${V}║${N}"
  echo -e "${V}╚══════════════════════════════════════════════════════════════╝${N}"
  echo -e ""
}

# ═══════════════════════════════════════════════════════════════════════════
# MENÚ PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════
main_menu() {
  echo -e ""
  echo -e "${V}╔══════════════════════════════════════════════════════════════╗${N}"
  echo -e "${V}║${N}  ${W}${BLD}🛒 Supermercados Go — Despliegue en Linux${N}                    ${V}║${N}"
  echo -e "${V}║${N}  ${G}Compatible: Ubuntu · Debian · Kali · CentOS · Fedora · Arch${N}     ${V}║${N}"
  echo -e "${V}╚══════════════════════════════════════════════════════════════╝${N}"
  echo -e ""
  echo -e "  ${BLD}Selecciona el modo de despliegue:${N}"
  echo -e ""
  echo -e "  ${V}1)${N} ${BLD}🖥️  Servidor (Producción)${N}"
  echo -e "     Instala todo: Node.js, PM2, firewall, Nginx, systemd"
  echo -e "     Ideal para el servidor real de la app y el sitio web"
  echo -e ""
  echo -e "  ${Y}2)${N} ${BLD}🧪 Desarrollo / Prueba${N}"
  echo -e "     Solo lo necesario: Node.js, base de datos, servidor"
  echo -e "     Sin firewall, sin Nginx, sin systemd"
  echo -e ""
  echo -e "  ${R}3)${N} ${BLD}🛑 Detener servicios${N}"
  echo -e "     Detiene PM2, systemd y procesos del servidor"
  echo -e ""
  echo -e "  ${G}0)${N} Salir"
  echo -e ""
  echo -en "  ${C}${BLD}Opción [0-3]:${N} "
  local opt; read -r opt
  case "$opt" in
    1) deploy_production ;;
    2) deploy_dev ;;
    3) stop_services; show_summary ;;
    0) echo -e "${G}¡Hasta luego!${N}"; exit 0 ;;
    *) fail "Opción inválida"; exit 1 ;;
  esac
}

# ═══════════════════════════════════════════════════════════════════════════
# INICIO
# ═══════════════════════════════════════════════════════════════════════════
detect_system
main_menu
