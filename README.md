# Supermercados Go

Plataforma de delivery de supermercado tipo Uber/InDrive para **Supermercados Go** — Cúcuta, Norte de Santander, Colombia.

Moneda: COP (Pesos Colombianos) | Idioma: Español | Zona horaria: America/Bogota

## Arquitectura

```
supermercados-go/
├── server/              # Backend Node.js 20 + Express + SQLite
│   ├── src/
│   │   ├── index.js          # Bootstrap
│   │   ├── config.js         # Configuración centralizada
│   │   ├── migrate.js        # Migraciones (13 tablas)
│   │   ├── db/               # Conexión a base de datos
│   │   ├── middleware/       # Auth, validación, errores
│   │   ├── routes/           # 16 archivos de rutas
│   │   ├── services/         # 5 servicios de negocio
│   │   └── utils/            # Utilidades
│   ├── .env.example
│   └── package.json
├── app/                # App Flutter 3 (Android)
│   ├── lib/
│   │   ├── main.dart         # Punto de entrada + rutas
│   │   ├── models/           # 10 modelos de datos
│   │   ├── services/         # API, WebSocket, Storage
│   │   ├── providers/        # 6 providers (State)
│   │   ├── widgets/          # 12 widgets reutilizables
│   │   ├── screens/
│   │   │   ├── client/       # 13 pantallas de cliente
│   │   │   ├── worker/       # 8 pantallas de repartidor
│   │   │   └── admin/        # 12 pantallas de administrador
│   │   └── utils/            # Constantes, formateadores
│   ├── assets/images/
│   ├── android/              # Configuración Android
│   └── pubspec.yaml
├── dashboard/          # Panel de escritorio GTK3 (Python)
│   └── main.py               # 17 pestañas
├── deploy-linux.sh     # Instalador automático para Linux
└── compilar-apk.sh    # Compilador de APK Android
```

## Inicio rápido

### 1. Desplegar servidor (Linux)

```bash
chmod +x deploy-linux.sh
sudo ./deploy-linux.sh
```

Esto instala todo: Node.js, dependencias, base de datos, servicio systemd, firewall, respaldos.

### 2. Compilar APK Android

```bash
chmod +x compilar-apk.sh
./compilar-apk.sh
```

El APK se genera en `build/supermercados-go-1.0.0-release.apk`.

### 3. Panel de administración (escritorio Linux)

```bash
python3 /opt/supermercados-go/dashboard/main.py
```

## Roles del sistema

| Rol | Funciones |
|---|---|
| **admin** | Dashboard, productos, categorías, pedidos, usuarios, inventario, compras, facturación, reportes, promociones, auditoría |
| **worker** | Pedidos disponibles, alistamiento, escáner, sustituciones, entrega con prueba, ruta, ganancias, caja |
| **client** | Catálogo, carrito, pedido (domicilio/recoger), seguimiento en vivo, pagos, calificación, favoritos, notificaciones |

## Endpoints públicos (sin autenticación)

- `GET /api/health`
- `GET /api/products`
- `GET /api/categories`
- `GET /api/settings/public`
- `POST /api/auth/login`
- `POST /api/auth/register`

## Seguridad

- JWT para autenticación
- API Key para webhooks
- Contraseña admin aleatoria en primer arranque (`data/PRIMER_ACCESO.txt`)
- WebSocket autenticado
- GPS de repartidores solo visible para admin y cliente del pedido
- Cumplimiento Ley 1581/2012 (Habeas Data)
- Valores monetarios en enteros (COP)
- Todas las fechas en America/Bogota

## Datos del negocio

- **Nombre:** Supermercados Go
- **Ubicación:** Cúcuta, Norte de Santander, Colombia
- **Dirección:** KDX 1-2B Los Mangos
- **Teléfono:** +57 304 401 6277
- **Email:** carrierjawerly@gmail.com
- **Horario:** 6:00 AM - 6:00 PM
- **Colores:** Verde #00B860, Naranja #FF8C00, Dorado #FFD93D

## Stack técnico

| Componente | Tecnología |
|---|---|
| Backend | Node.js 20, Express 4, better-sqlite3, JWT, WebSocket (ws) |
| App móvil | Flutter 3, Dart, Provider, http, shared_preferences |
| Panel escritorio | Python 3, GTK3 (PyGObject) |
| Despliegue | Bash, systemd, ufw/firewalld |
| Base de datos | SQLite (WAL mode) |
