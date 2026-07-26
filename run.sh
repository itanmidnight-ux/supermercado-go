#!/bin/bash

# ==============================================================================
# SUPERMERCADO GO - SCRIPT DE DESPLIEGUE AUTOMÁTICO
# ==============================================================================
# Este script:
# 1. Verifica dependencias (Python, Flutter, Cloudflared).
# 2. Inicia la base de datos y el backend Flask.
# 3. Configura un túnel Cloudflare estático para exposición segura.
# 4. Sirve el frontend web estático.
# ==============================================================================

set -e # Detener si hay error crítico

echo "🚀 Iniciando Supermercado GO..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificación de dependencias
echo -e "${YELLOW}[1/5] Verificando dependencias...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python3 no instalado.${NC}"
    exit 1
fi

if ! command -v flutter &> /dev/null; then
    echo -e "${YELLOW}Advertencia: Flutter no encontrado. La app móvil no podrá compilarse en este paso, pero el servidor funcionará.${NC}"
fi

# Instalar cloudflared si no existe (Linux/Mac)
if ! command -v cloudflared &> /dev/null; then
    echo -e "${YELLOW}Instalando Cloudflared...${NC}"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared.deb
        rm cloudflared.deb
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install cloudflared
    else
        echo -e "${RED}Por favor instale cloudflared manualmente para exposición pública.${NC}"
    fi
fi

# 2. Preparar entorno Python
echo -e "${GREEN}[2/5] Configurando entorno Python...${NC}"
cd /workspace/backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Iniciar Base de Datos y Backend
echo -e "${GREEN}[3/5] Iniciando Servidor Backend (Flask)...${NC}"
# Ejecutar en segundo plano
python3 app.py > /tmp/supermercado.log 2>&1 &
BACKEND_PID=$!
echo "Backend iniciado con PID: $BACKEND_PID"

# Esperar a que el backend esté listo
sleep 5
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}Error al iniciar el backend. Revise /tmp/supermercado.log${NC}"
    cat /tmp/supermercado.log
    exit 1
fi
echo -e "${GREEN}Backend corriendo en http://localhost:5000${NC}"

# 4. Configurar Túnel Cloudflare (Exposición Segura)
echo -e "${YELLOW}[4/5] Configurando Túnel Seguro (Cloudflare)...${NC}"
echo "⚠️  IMPORTANTE: Para un túnel estático, debe tener un dominio configurado en Cloudflare."
echo "    Si solo desea probar localmente, el sistema estará accesible en http://localhost:5000"
echo "    Para exponer públicamente sin dominio, se usará un túnel rápido (argotunnel)."

# Opción A: Túnel rápido (URL temporal pública)
if command -v cloudflared &> /dev/null; then
    echo "Iniciando túnel rápido..."
    # Esto generará una URL tipo https://random-name.trycloudflare.com
    cloudflared tunnel --url http://localhost:5000 > /tmp/cloudflare.log 2>&1 &
    CLOUDFLARE_PID=$!
    sleep 3
    
    # Extraer la URL
    if [ -f /tmp/cloudflare.log ]; then
        PUBLIC_URL=$(grep -o 'https://[^[:space:]]*.trycloudflare.com' /tmp/cloudflare.log | head -n 1)
        if [ ! -z "$PUBLIC_URL" ]; then
            echo -e "${GREEN}✅ SERVICIO DESPLEGADO EXITOSAMENTE${NC}"
            echo -e "${GREEN}URL Pública: ${PUBLIC_URL}${NC}"
            echo -e "${YELLOW}Copie esta URL para configurar su app Flutter (lib/config/api_config.dart)${NC}"
            
            # Guardar URL en archivo para referencia
            echo "$PUBLIC_URL" > /workspace/public_url.txt
            
            # Actualizar config de Flutter automáticamente si es posible
            if [ -f /workspace/mobile_app/lib/config/api_config.dart ]; then
                sed -i "s|http://.*|${PUBLIC_URL}|g" /workspace/mobile_app/lib/config/api_config.dart 2>/dev/null || true
                echo "Configuración de Flutter actualizada."
            fi
        fi
    fi
fi

# 5. Instrucciones Finales
echo -e "${GREEN}[5/5] Sistema Listo.${NC}"
echo "=============================================================================="
echo "  🛒 SUPERMERCADO GO - OPERATIVO"
echo "=============================================================================="
echo "  🔹 Backend API: http://localhost:5000"
if [ ! -z "$PUBLIC_URL" ]; then
    echo "  🔹 Acceso Web Público: $PUBLIC_URL"
else
    echo "  🔹 Acceso Web Local: http://localhost:5000"
fi
echo "  🔹 Admin Default: admin@supermercado.com / admin123"
echo "  🔹 Logs Backend: /tmp/supermercado.log"
echo "=============================================================================="
echo "  Para detener el servicio: kill $BACKEND_PID ${CLOUDFLARE_PID:-}"
echo "=============================================================================="

# Mantener el script corriendo
wait
