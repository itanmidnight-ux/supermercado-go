# Supermercado GO 🛒

## Identidad pública del repositorio

- **Nombre recomendado:** `supermercado-go` o `supermercado-go-mobile-commerce`
- **Nombre actual:** `supermercado-go`
- **Posicionamiento:** plataforma de supermercado con API, sitio web, app Android, panel admin y bot WhatsApp.

---

Sistema integral para supermercado: sitio web + app Android + panel admin + bot WhatsApp.

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js 20 + Express |
| Base de datos | PostgreSQL 18 |
| Sitio web | Vite + TypeScript + GSAP/ScrollTrigger + Lenis (sin framework, sin Flutter) |
| App móvil | Flutter 3.44 (solo Android) |
| Panel admin | EJS + Express (localhost:3002) |
| Bot WhatsApp | @whiskeysockets/baileys v6 |
| Parser NLU | @nlpjs/basic (sin LLM) |

El sitio web y la app Android son proyectos separados: el sitio (`website/`) es HTML/CSS/TS
real servido directo por Express, la app (`android-app/`) es Flutter nativo solo para Android.
Ambos consumen la misma API REST.

## Requisitos

- Node.js 20+
- PostgreSQL 16+
- Flutter 3.44+ (solo para compilar la app Android)
- Python 3.10+ (solo para dashboard.py) — `pip install -r requirements.txt`
  (además necesita GTK3 del sistema, ver comentario en `requirements.txt`)

## Inicio rápido

```bash
# 1. Iniciar servidor
bash deploy-linux.sh --start

# 2. Abrir en navegador
# Sitio web:   http://localhost:50000/
# Panel admin: http://localhost:3002/login
# API:         http://localhost:50000/api/
```

En entorno local, el seed inicial crea un usuario admin de desarrollo. Cambia esa contraseña antes de exponer el sistema en una red pública o entorno real.

## Despliegue

```bash
./deploy-linux.sh --start    # Iniciar servidor
./deploy-linux.sh --stop     # Detener
./deploy-linux.sh --restart  # Reiniciar
./deploy-linux.sh --status   # Estado
```

El script configura .env, instala dependencias, inicia PostgreSQL, libera el puerto, y verifica que el servidor responda.

## Compilar app Android

```bash
./compilar-apk.sh            # Compila APK desde android-app/
```

## Compilar sitio web

```bash
./compilar-web.sh            # npm install + vite build en website/, copia a server/src/website/
```

Desarrollo local del sitio (con hot-reload, sin pasar por Express):

```bash
cd website && npm install && npm run dev
```

## Estructura

```
supermercado-go/
├── server/            # Backend Node.js + Express
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── app.js             # Express app (rutas API, sitio web, CORS, rate-limit)
│   │   ├── db/                # PostgreSQL (schema, migrations, seed)
│   │   ├── routes/            # API REST (auth, products, orders, cart...)
│   │   ├── middleware/        # JWT, roles, rate-limit, seguridad
│   │   ├── services/          # Lógica de negocio (bot, email, PDF)
│   │   ├── utils/             # Cache, logger, storage, sanitize
│   │   ├── admin-panel/       # Panel admin (EJS + Express, puerto 3002)
│   │   └── website/           # Sitio web compilado (generado por website/, ver compilar-web.sh)
│   └── test/                  # Tests Jest
├── website/           # Fuente del sitio web (Vite + TS, sin framework)
├── android-app/       # App Flutter (solo Android)
├── deploy-linux.sh    # Script de despliegue
├── compilar-apk.sh    # Script de compilación APK (Android)
├── compilar-web.sh    # Script de compilación del sitio web
└── dashboard.py       # Dashboard de control (GTK)
```

## API endpoints principales

| Ruta | Método | Auth | Descripción |
|------|--------|------|-------------|
| `/api/auth/token` | POST | - | Login (email o username + password) |
| `/api/auth/register` | POST | - | Registro de cliente |
| `/api/auth/forgot-password` | POST | - | Solicitar código OTP |
| `/api/auth/reset-password` | POST | - | Reset con código OTP |
| `/api/products` | GET | JWT | Catálogo completo |
| `/api/products/public` | GET | - | Catálogo público |
| `/api/products` | POST | admin | Crear producto |
| `/api/orders` | GET | staff | Listar pedidos |
| `/api/orders` | POST | client | Crear pedido |
| `/api/cart` | GET/POST/DELETE | client | Carrito de compras |
| `/api/analytics/products` | GET | admin | Top vendidos + alertas (`low_stock`/`low_demand`) |

## Alertas de stock bajo

Cada producto puede tener `low_stock_threshold` (admin-panel → editar producto). Cuando
el stock cruza ese umbral hacia abajo, el admin recibe un WhatsApp automático (mismo canal
que las alertas de seguridad) y la alerta queda visible en:
- Admin-panel web: `/alertas` (link en el header)
- `dashboard.py`: badge rojo en "Ventas" + lista en el módulo

## Cache

El servidor usa caché en memoria para productos (TTL 15s) y settings (TTL 30-60s según el
subset). Estadísticas en `/cache-stats`.

## Tests

```bash
cd server && npm test
# 136/141 tests pasan (5 fallos preexistentes sin relación al stock/seed, ver git log)
```

## Seguridad

- JWT + refresh tokens + revoked_tokens
- Rate limiting por endpoint (auth: 10req/15min, api: 120req/min)
- CSRF en panel admin
- Brute-force protection en login
- Helmet headers (CSP, HSTS, X-Frame-Options)
- CORS restrictivo por dominio configurable
- Sanitización de inputs en todos los endpoints
