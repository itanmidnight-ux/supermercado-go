#!/bin/bash
# ========================================
# SCRIPT DE DESPLIEGUE COMPLETO - SUPERMERCADO GO
# Despliega: Backend, Base de Datos, Web Frontend, Cache
# ========================================

set -e  # Detener en caso de error

echo "========================================"
echo "🛒 SUPERMERCADO GO - Despliegue Completo"
echo "========================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con color
print_status() {
    echo -e "${BLUE}[$1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# ========================================
# VERIFICACIÓN DE PRERREQUISITOS
# ========================================

print_status "INFO" "Verificando prerrequisitos..."

# Verificar Python 3
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 no está instalado"
    exit 1
fi
print_success "Python 3 encontrado: $(python3 --version)"

# Verificar pip
if ! command -v pip3 &> /dev/null; then
    print_error "pip3 no está instalado"
    exit 1
fi
print_success "pip3 encontrado"

# Verificar SQLite3
if ! command -v sqlite3 &> /dev/null; then
    print_warning "SQLite3 no está en PATH, pero puede estar disponible mediante Python"
fi

# ========================================
# CONFIGURACIÓN DEL ENTORNO
# ========================================

print_status "INFO" "Configurando entorno virtual..."

cd "$(dirname "$0")/backend" || exit 1

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Entorno virtual creado"
else
    print_success "Entorno virtual ya existe"
fi

# Activar entorno virtual
source venv/bin/activate
print_success "Entorno virtual activado"

# ========================================
# INSTALACIÓN DE DEPENDENCIAS
# ========================================

print_status "INFO" "Instalando dependencias del backend..."

# Actualizar pip
pip install --upgrade pip -q

# Instalar requirements
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt -q
    print_success "Dependencias instaladas desde requirements.txt"
else
    # Instalar dependencias básicas si no existe requirements.txt
    pip install flask flask-cors flask-limiter werkzeug -q
    print_success "Dependencias básicas instaladas"
fi

# ========================================
# CONFIGURACIÓN DE BASE DE DATOS
# ========================================

print_status "INFO" "Configurando base de datos..."

# La base de datos se crea automáticamente al iniciar la app
# Pero podemos pre-crearla para verificación
python3 -c "
import sqlite3
conn = sqlite3.connect('supermercado.db')
print('Base de datos verificada/creada correctamente')
conn.close()
"
print_success "Base de datos lista"

# ========================================
# LIMPIEZA DE CACHE
# ========================================

print_status "INFO" "Limpiando caché..."

# Limpiar cache de Python
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
print_success "Caché de Python limpiada"

# Limpiar cache del sistema (si existe)
if [ -d "/tmp/supermercado_cache" ]; then
    rm -rf /tmp/supermercado_cache
    print_success "Caché temporal limpiada"
fi

# ========================================
# CONFIGURACIÓN DE FIREWALL (OPCIONAL)
# ========================================

print_status "INFO" "Verificando configuración de red..."

# Verificar si el puerto 5000 está disponible
if command -v lsof &> /dev/null; then
    if lsof -i :5000 &> /dev/null; then
        print_warning "El puerto 5000 ya está en uso"
        read -p "¿Desea continuar? (s/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            exit 1
        fi
    fi
fi
print_success "Puerto 5000 disponible"

# ========================================
# INICIO DEL SERVICIO
# ========================================

print_status "INFO" "Iniciando servidor backend..."

# Crear archivo de log si no existe
touch supermercado.log
print_success "Archivo de log listo"

# Iniciar el servidor en segundo plano
nohup python3 app.py > supermercado.log 2>&1 &
SERVER_PID=$!

echo $SERVER_PID > supermercado.pid
print_success "Servidor iniciado con PID: $SERVER_PID"

# Esperar a que el servidor esté listo
print_status "INFO" "Esperando a que el servidor esté listo..."
sleep 3

# Verificar que el servidor esté corriendo
if kill -0 $SERVER_PID 2>/dev/null; then
    print_success "Servidor backend ejecutándose correctamente"
else
    print_error "El servidor no pudo iniciarse. Revisa supermercado.log"
    exit 1
fi

# ========================================
# VERIFICACIÓN DE SERVICIOS
# ========================================

print_status "INFO" "Verificando servicios..."

# Verificar endpoint de salud
sleep 2
if command -v curl &> /dev/null; then
    if curl -s http://localhost:5000/ > /dev/null; then
        print_success "Backend respondiendo en http://localhost:5000"
    else
        print_warning "Backend no responde inmediatamente, puede estar inicializando"
    fi
fi

# ========================================
# RESUMEN DEL DESPLIEGUE
# ========================================

echo ""
echo "========================================"
print_success "¡Despliegue completado exitosamente!"
echo "========================================"
echo ""
echo "📊 Estado del sistema:"
echo "   • Backend:      Activo (PID: $SERVER_PID)"
echo "   • Base de datos: Lista (supermercado.db)"
echo "   • Puerto:       5000"
echo "   • Logs:         supermercado.log"
echo ""
echo "🌐 Accesos:"
echo "   • Web Frontend: http://localhost:5000/"
echo "   • API:          http://localhost:5000/api/"
echo ""
echo "🔑 Credenciales Admin por defecto:"
echo "   • Email: admin@supermercado.com"
echo "   • Password: admin123"
echo ""
echo "📱 App Móvil:"
echo "   • Para compilar: bash compilar-apk.sh"
echo "   • API Endpoint: http://TU_IP:5000/api/"
echo ""
echo "🛑 Comandos útiles:"
echo "   • Detener servidor: kill \$(cat supermercado.pid)"
echo "   • Ver logs: tail -f supermercado.log"
echo "   • Reiniciar: bash deploy-linux.sh"
echo ""
echo "========================================"
echo "✨ Supermercado GO está listo para usar"
echo "========================================"
