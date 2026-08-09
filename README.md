<div align="center">

# 🛒 Supermercados Go

### Tu supermercado, donde vayas

[![Node.js](https://img.shields.io/badge/Node.js-20_ LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Flutter](https://img.shields.io/badge/Flutter-3.44+-02569B?logo=flutter&logoColor=white)](https://flutter.dev)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_mode-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![License](https://img.shields.io/badge/License-ISC-green.svg)](LICENSE)
![Docker](https://img.shields.io/badge/Docker-24.0-2496ED?logo=docker&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-010101?logo=socket.io&logoColor=white)

---

**Plataforma completa de delivery de supermercado** inspirada en Amazon/UberEats para el mercado colombiano.  
Incluye **app móvil**, **sitio web**, **panel de administración** y **bot de WhatsApp**.

</div>

---

## 📋 Tabla de Contenidos

- [Arquitectura](#-arquitectura)
- [Stack Tecnológico](#-stack-tecnológico)
- [Capturas de Pantalla](#-capturas-de-pantalla)
- [Funcionalidades](#-funcionalidades)
- [Instalación Rápida](#-instalación-rápida)
- [Docker](#-docker)
- [Despliegue en Linux](#-despliegue-en-linux)
- [Compilar APK](#-compilar-apk)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Endpoints](#-api-endpoints)
- [Variables de Entorno](#-variables-de-entorno)
- [Seguridad](#-seguridad)
- [Roadmap](#-roadmap)
- [Licencia](#-licencia)
- [Autor](#-autor)

---

## 🏗️ Arquitectura

```
Cliente ──► App Flutter / Website / WhatsApp Bot
                │
                ▼
        Server Node.js + Express
                │
        ├── SQLite (WAL mode)
        ├── WebSocket (tiempo real)
        ├── Baileys (WhatsApp)
        └── Firebase (push)
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| **Backend** | Node.js + Express | 20 LTS / 4.x |
| **Base de datos** | SQLite (better-sqlite3, WAL mode) | 3.x |
| **Autenticación** | JWT + bcrypt + roles | - |
| **App móvil** | Flutter (Android) | 3.44+ |
| **Website** | HTML/CSS/JS (SPA vanilla + PWA) | - |
| **Panel admin** | Python 3 + GTK3 | 3.x |
| **WhatsApp Bot** | Baileys (multi-device) | 6.x |
| **Tiempo real** | WebSocket (ws) | 8.x |
| **Despliegue** | Docker + systemd + PM2 | - |
| **Proxy** | Nginx (Let's Encrypt TLS) | - |
| **Documentación** | Swagger (OpenAPI) | - |

---

## 📱 Capturas de Pantalla

> Las capturas están disponibles en la carpeta [`/docs/screenshots/`](docs/screenshots/)

| Cliente | Trabajador | Administrador |
|:---:|:---:|:---:|
| ![Cliente](docs/screenshots/client.png) | ![Trabajador](docs/screenshots/worker.png) | ![Admin](docs/screenshots/admin.png) |

---

## ✨ Funcionalidades

### 🧑‍💻 Cliente
- 🔍 Catálogo de productos con búsqueda y filtros
- 🛒 Carrito de compras persistente
- 💳 Checkout con múltiples opciones de pago
- 📍 Seguimiento de pedido en tiempo real (WebSocket)
- ❤️ Lista de favoritos
- 🔔 Notificaciones push (Firebase)
- 🗺️ Selección de dirección con mapa integrado
- ⭐ Calificación y reseñas de pedidos
- 🧾 Visualización de facturas
- 🏷️ Códigos de descuento y promociones

### 🏃 Trabajador
- 📋 Vista de pedidos disponibles y asignados
- 📦 Picking optimizado
- 📱 Escáner de códigos de barras
- 🔄 Sistema de sustituciones de productos
- 🗺️ Ruta de entrega optimizada
- ✍️ Firma digital y foto de comprobante de entrega
- 💰 Panel de ganancias diarias/semanales
- 💵 Control de caja (apertura/cierre)

### 👨‍💼 Administrador
- 📊 Dashboard con métricas en tiempo real
- 🏷️ Gestión completa de productos
- 📂 Categorías y subcategorías
- 📦 Gestión de pedidos (historial, estados, reasignación)
- 👥 Gestión de usuarios y trabajadores
- 📦 Inventario y kardex completo
- 🛒 Registro de compras a proveedores
- 🧾 Facturación electrónica DIAN
- 📄 Generación de reportes PDF
- 🎯 Sistema de promociones y descuentos
- 📝 Log de auditoría completo
- 🖼️ Gestión de banners publicitarios
- 🎁 Programa de fidelización por puntos
- 🏪 Gestión de proveedores
- 👀 Rendimiento de trabajadores

### 🤖 WhatsApp Bot
- 💬 Pedidos en lenguaje natural
- 🧠 Procesamiento de lenguaje natural (NLP)
- ⚡ Respuesta automática 24/7
- 🔗 Integración con catálogo de productos

### 💬 Mensajería Interna
- 💬 Chats estilo WhatsApp entre clientes, trabajadores y admin
- 📸 Envío de imágenes y archivos
- 🔔 Notificaciones en tiempo real

---

## 🚀 Instalación Rápida

### Prerrequisitos
- [Node.js](https://nodejs.org/) 20+
- [Flutter SDK](https://flutter.dev/) 3.44+
- [Docker](https://www.docker.com/) (opcional)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/SupermercadosGo-App-Completa.git
cd SupermercadosGo-App-Completa
```

### 2. Instalar dependencias del servidor

```bash
cd server
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 4. Ejecutar el servidor

```bash
# Modo desarrollo (con hot-reload)
npm run dev

# Modo producción
npm start
```

El servidor estará disponible en: `http://localhost:3777`

---

## 🐳 Docker

```bash
# Construir y levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

**Servicios incluidos:**
- `server` — Backend Node.js (puerto 3777)
- `nginx` — Proxy inverso (puertos 80/443)
- `certbot` — Certificados SSL automáticos

---

## 🖥️ Despliegue en Linux

```bash
chmod +x deploy-linux.sh
./deploy-linux.sh
```

El script configura automáticamente:
- Servidor Node.js con systemd
- Nginx como proxy inverso
- Certificados SSL con Let's Encrypt
- fail2ban para protección
- Firewall (UFW)

---

## 📱 Compilar APK

```bash
chmod +x compilar-apk.sh
./compilar-apk.sh
```

Genera el archivo APK en `app/build/app/outputs/flutter-apk/`

---

## 📁 Estructura del Proyecto

```
SupermercadosGo-App-Completa/
│
├── server/                  # Backend Node.js
│   ├── src/
│   │   ├── routes/          # 23 rutas API REST
│   │   ├── services/        # 8 servicios business logic
│   │   ├── middleware/       # Auth, rate-limit, CORS
│   │   ├── db/              # SQLite + migraciones
│   │   └── index.js         # Entry point
│   ├── data/                # Base de datos + uploads
│   ├── tests/               # Tests unitarios (Jest)
│   ├── Dockerfile
│   └── package.json
│
├── app/                     # App Flutter (Android)
│   └── lib/
│       ├── screens/         # 68 pantallas
│       │   ├── client/      # 21 pantallas cliente
│       │   ├── worker/      # 10 pantallas trabajador
│       │   └── admin/       # 37 pantallas admin
│       ├── models/          # Modelos de datos
│       ├── providers/       # State management
│       ├── services/        # API y servicios
│       ├── widgets/         # Componentes reutilizables
│       └── theme/           # Tema claro/oscuro
│
├── website/                 # SPA Web + PWA
│   ├── js/views/            # 11 vistas SPA
│   ├── css/                 # Estilos + animaciones
│   ├── images/              # Assets estáticos
│   ├── manifest.json        # PWA manifest
│   └── sw.js                # Service Worker
│
├── dashboard/               # Panel admin (Python/GTK3)
├── docs/                    # Documentación
│
├── deploy-linux.sh          # Despliegue universal Linux
├── compilar-apk.sh          # Compilador APK
├── docker-compose.yml       # Orquestación Docker
├── nginx.conf               # Configuración Nginx
└── .github/workflows/ci.yml # CI/CD GitHub Actions
```

---

## 📡 API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/refresh` | Refrescar token |
| GET | `/api/auth/profile` | Obtener perfil |

### Productos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/products` | Listar productos |
| GET | `/api/products/:id` | Detalle de producto |
| POST | `/api/products` | Crear producto (admin) |
| PUT | `/api/products/:id` | Actualizar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| GET | `/api/categories` | Listar categorías |

### Pedidos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/orders` | Crear pedido |
| GET | `/api/orders` | Listar pedidos |
| GET | `/api/orders/:id` | Detalle de pedido |
| PUT | `/api/orders/:id/status` | Actualizar estado |
| PUT | `/api/orders/:id/assign` | Asignar trabajador |

### Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/users` | Listar usuarios (admin) |
| PUT | `/api/users/:id` | Actualizar usuario |
| GET | `/api/users/:id/addresses` | Direcciones del usuario |
| POST | `/api/users/:id/addresses` | Agregar dirección |

### Inventario
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/inventory` | Consultar inventario |
| GET | `/api/inventory/kardex` | Kardex de producto |
| POST | `/api/inventory/adjust` | Ajustar stock |

### Facturación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/invoices` | Listar facturas |
| POST | `/api/invoices` | Crear factura |
| GET | `/api/invoices/:id` | Detalle de factura |

### Compras
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/purchases` | Listar compras |
| POST | `/api/purchases` | Registrar compra |
| GET | `/api/suppliers` | Listar proveedores |

### Otros
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/analytics` | Métricas dashboard |
| GET | `/api/reports` | Generar reportes |
| POST | `/api/upload` | Subir archivos |
| GET | `/api/banners` | Banners publicitarios |
| POST | `/api/promotions` | Crear promoción |
| GET | `/api/loyalty/points` | Puntos de fidelidad |
| POST | `/api/messaging` | Enviar mensaje |

> 📖 Documentación Swagger disponible en: `http://localhost:3777/api-docs`

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `NODE_ENV` | Entorno de ejecución | `development` |
| `PORT` | Puerto del servidor | `3777` |
| `HOST` | Host de escucha | `0.0.0.0` |
| `JWT_SECRET` | Secreto para JWT (generar uno seguro) | - |
| `API_KEY` | Clave de API interna | - |
| `DB_PATH` | Ruta de la base de datos SQLite | `./data/supermercados.db` |
| `BUSINESS_NAME` | Nombre del negocio | `Supermercados Go` |
| `BUSINESS_PHONE` | Teléfono del negocio | `+573044016277` |
| `BUSINESS_EMAIL` | Email del negocio | `contacto@supermercadosgo.com` |
| `BUSINESS_ADDRESS` | Dirección del negocio | `Cúcuta, Norte de Santander` |
| `BUSINESS_CITY` | Ciudad | `Cúcuta` |
| `BUSINESS_DEPARTMENT` | Departamento | `Norte de Santander` |
| `BUSINESS_HOURS` | Horario de atención | `6:00 AM - 9:00 PM` |
| `DELIVERY_FEE_DEFAULT` | Tarifa de delivery por defecto | `4900` |
| `FREE_DELIVERY_MIN` | Mínimo para envío gratis | `50000` |
| `OPERATING_ZONE` | Zona de operación | `Cúcuta` |
| `CORS_ORIGINS` | Orígenes permitidos (CORS) | `*` |
| `WA_ENABLED` | Habilitar WhatsApp Bot | `false` |
| `WA_BUSINESS_NUMBER` | Número de WhatsApp Business | - |
| `WA_ACCESS_TOKEN` | Token de acceso WhatsApp | - |
| `WA_PHONE_ID` | ID del teléfono WhatsApp | - |

---

## 🔒 Seguridad

| Medida | Implementación |
|--------|----------------|
| **Autenticación** | JWT tokens + bcrypt (12 rounds) |
| **Rate Limiting** | express-rate-limit (configurable) |
| **CORS** | Configurable por origen |
| **Headers** | Helmet.js ( CSP, HSTS, X-Frame-Options ) |
| **Sistema** | systemd hardening (sandboxing, no-new-privileges) |
| **Firewall** | fail2ban + UFW |
| **TLS** | Let's Encrypt (TLS 1.2/1.3 vía Nginx) |
| **SQL Injection** | Prepared statements (better-sqlite3) |
| **Archivos** | Validación de tipo y tamaño (Multer) |

---

## 🗺️ Roadmap

### ✅ Completado
- [x] Backend Node.js + Express completo
- [x] Base de datos SQLite con WAL mode
- [x] API REST con 23+ endpoints
- [x] Autenticación JWT + roles
- [x] App Flutter (Android) - 68 pantallas
- [x] Sitio Web SPA + PWA
- [x] Panel de administración Python/GTK3
- [x] Bot de WhatsApp (Baileys multi-device)
- [x] WebSocket para tiempo real
- [x] Sistema de mensajería interna
- [x] Programa de fidelización por puntos
- [x] Facturación electrónica DIAN
- [x] Generación de reportes PDF
- [x] Gestión de inventario y kardex
- [x] Sistema de compras y proveedores
- [x] Docker + docker-compose
- [x] Despliegue automático Linux
- [x] Compilador APK automático
- [x] CI/CD con GitHub Actions
- [x] Documentación Swagger

### 🔜 Próximamente
- [ ] App iOS
- [ ] Pasarela de pagos real (Stripe/PayU)
- [ ] Integración DIAN real (certificado digital)
- [ ] Monitoreo con Prometheus + Grafana
- [ ] Integración con Google Maps Directions API
- [ ] Sistema de recomendaciones con IA
- [ ] App para repartidores (iOS/Android)

---

## 📄 Licencia

Este proyecto está bajo la licencia **ISC** - ver el archivo [LICENSE](LICENSE) para detalles.

```
ISC License

Copyright (c) 2026 Supermercados Go

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

---

## 👨‍💻 Autor

**Supermercados Go** — Cúcuta, Norte de Santander, Colombia 🇨🇴

> Tu supermercado, donde vayas

---

<div align="center">

**¿Necesitas ayuda?** Abre un [Issue](https://github.com/tu-usuario/SupermercadosGo-App-Completa/issues) o contáctanos en [contacto@supermercadosgo.com](mailto:contacto@supermercadosgo.com)

</div>
