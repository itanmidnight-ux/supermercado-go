<div align="center">

# ⚡ Plataforma de Pedidos por WhatsApp

**Convierte cualquier número de WhatsApp en un canal de ventas completo: bot con lenguaje natural, servidor endurecido en seguridad, app multiplataforma para tu equipo y tus clientes, sitio web público, y panel de análisis nativo de escritorio.**

[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js&logoColor=white)](server/package.json)
[![Flutter](https://img.shields.io/badge/Flutter-3.44+-02569B?logo=flutter&logoColor=white)](android-app/pubspec.yaml)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](server/package.json)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](server/src/db)
[![Security hardened](https://img.shields.io/badge/deploy-security_hardened-success)](deploy-linux.sh)
[![Platform](https://img.shields.io/badge/platform-Android_%7C_Web-informational)](android-app)
[![Tests](https://img.shields.io/badge/tests-passing-success)](server/test)

</div>

---

Pensada para equipos de ventas, distribución y atención al cliente que operan por WhatsApp — sin importar el rubro — y necesitan dejar de gestionar pedidos a mano en el chat. Los clientes piden en lenguaje natural desde WhatsApp o navegan el catálogo desde la web sin necesidad de crear cuenta, el bot interpreta la intención automáticamente, el equipo recibe y gestiona todo desde una app propia con seguimiento GPS en vivo, y la gerencia obtiene analíticas reales de ventas sin depender de terceros.

Cualquier negocio con un flujo de "el cliente escribe, alguien anota el pedido a mano" puede adoptar esta plataforma tal cual o como base para su propio catálogo, marca y reglas de negocio — el nombre, el logo y la paleta de colores se configuran desde el panel de administración, sin tocar una línea de código.

```
Cliente WhatsApp ──► Bot (Baileys, multi-device) ─┐
                                                    ├─► Servidor Express ──► PostgreSQL
Cliente Web (invitado o con sesión) ───────────────┘        │
                                                              ├─► App Flutter (admin / equipo / cliente)
                                                              ├─► Sitio público (catálogo, sin login)
                                                              └─► Panel de análisis nativo (escritorio)
```

---

## Tabla de Contenidos

- [Por qué esta plataforma](#por-qué-esta-plataforma)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Roles de Usuario](#roles-de-usuario)
- [Requisitos](#requisitos)
- [Despliegue del Servidor (Linux)](#despliegue-del-servidor-linux)
- [Panel de Análisis](#panel-de-análisis)
- [Compilar la App Android](#compilar-la-app-android)
- [Seguridad](#seguridad)
- [Respaldo de datos](#respaldo-de-datos)
- [Personalización de marca](#personalización-de-marca)
- [Pruebas](#pruebas)

---

## Por qué esta plataforma

- **Cero fricción para el cliente**: pide por WhatsApp en su propio idioma natural, o navega el catálogo desde la web como invitado — sin instalar nada, sin menús de bot rígidos, sin crear cuenta hasta el momento de pagar.
- **Cero dependencia de terceros**: sin Puppeteer/Chrome headless, sin APIs de pago de WhatsApp Business, sin LLM externo pagado por token — el parser de intenciones corre 100% local.
- **Propiedad total de los datos**: base de datos propia en PostgreSQL, backups diarios automáticos y cifrados, sin enviar conversaciones de clientes a un proveedor externo de IA.
- **Marca propia sin tocar código**: nombre, logo y paleta de colores editables desde el rol admin, y se reflejan en toda la experiencia — incluida la pantalla de login, antes de iniciar sesión.
- **Seguimiento en vivo con privacidad real**: la ubicación del repartidor solo se comparte con el cliente cuando el pedido ya salió a entregar — nunca antes, es información personal del trabajador.
- **Un solo comando instala todo**: servidor, base de datos, firewall, hardening, acceso público seguro — sin ensamblar infraestructura a mano.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Bot WhatsApp | `@whiskeysockets/baileys` (multi-device, sin navegador/Puppeteer) |
| NLP | `@nlpjs/basic` — intención + entidades, 100% local |
| Servidor | Node.js 20 + Express 4 |
| Base de datos | PostgreSQL 16, migraciones automáticas al arrancar |
| Rate limiting distribuido | Redis opcional (`ioredis`) — memoria del proceso si no está configurado |
| Auth | JWT + bcrypt + roles (admin / worker / client), revocación de tokens |
| Correo | `nodemailer` — recuperación de contraseña por código de 6 dígitos |
| Seguridad servidor | helmet, CORS allowlist, rate limiting, validación de magic bytes en uploads (`file-type`), systemd hardening, TLS 1.2/1.3 |
| Reportes | `pdfkit` (PDF) + `exceljs` (Excel) — automáticos y bajo demanda |
| Backups | `pg_dump` cifrado (AES-256-GCM) + verificación de integridad, diario, con retención configurable |
| App | Flutter 3.44+ (Android + Web/PWA), Material 3 |
| Estado app | Provider |
| Sitio público | EJS (catálogo de solo lectura, sin login) |
| Panel admin ligero | EJS (gestión de catálogo por formularios, solo accesible en red local/VPN) |
| Panel de análisis | Python 3 + GTK3 nativo (`dashboard.py`) |
| Deploy Linux | Bash (`deploy-linux.sh`) — systemd, firewall, fail2ban, Tailscale Funnel / Cloudflare Tunnel / nginx + Let's Encrypt |

---

## Estructura del Proyecto

```
.
├── server/                        # Backend Node.js
│   └── src/
│       ├── index.js               # Entry point Express (API principal)
│       ├── app.js                 # App Express: middleware, rutas, seguridad
│       ├── db/                    # PostgreSQL: pool, migraciones, seed de usuarios
│       ├── middleware/auth.js     # JWT + control de roles (admin/worker/client)
│       ├── routes/
│       │   ├── auth.js            # Login / JWT / recuperación de contraseña
│       │   ├── bot.js             # Control del bot WhatsApp
│       │   ├── cart.js            # Carrito + checkout (entrega GPS/dirección, pago)
│       │   ├── chat.js            # Conversaciones + media
│       │   ├── estados.js         # Promociones (publicaciones con descuento automático)
│       │   ├── messages.js        # Mensajería interna, acceso restringido por pedido reclamado
│       │   ├── orders.js          # Pedidos + rastreo de entrega en vivo
│       │   ├── products.js        # Catálogo (admin) + catálogo público sin auth
│       │   ├── payments.js        # Métodos de pago (transferencia, contraentrega)
│       │   ├── settings.js        # Tema/marca (colores, logo, nombre) — endpoint público de solo lectura incluido
│       │   ├── staffLocations.js  # Ubicación en vivo del equipo (privacidad por estado del pedido)
│       │   ├── users.js           # Gestión de usuarios
│       │   ├── analytics.js       # Ventas, productos, empleados, clientes — datos reales
│       │   ├── reports.js         # Exportar rango de fechas a PDF/Excel
│       │   ├── emailConfig.js     # Cuenta de correo emisora (recuperación de contraseña)
│       │   └── webhook.js         # Eventos entrantes del bot
│       ├── services/
│       │   ├── waBot.js           # Bot Baileys + NLP
│       │   ├── pdfGenerator.js / excelGenerator.js   # Reportes
│       │   ├── backupScheduler.js # Backup diario cifrado + verificación
│       │   └── securityMonitor.js # Detección de actividad sospechosa por IP
│       ├── public-site/           # Sitio público EJS: catálogo, sin login
│       └── admin-panel/           # Panel liviano EJS: alta/edición de catálogo por formulario
├── android-app/                   # App Flutter (Android + Web) — cliente, equipo y admin
│   └── lib/
│       ├── screens/                 # admin_*, client_*, worker_*, login, chat, etc.
│       ├── widgets/futuristic_modal.dart, app_logo.dart, animated_tap_scale.dart, …
│       ├── theme/                   # Tokens + ThemeProvider (paleta personalizable en vivo)
│       └── services/api_service.dart
├── dashboard.py                   # Panel nativo GTK3 de análisis y control (standalone)
├── deploy-linux.sh                # Instala, asegura y gestiona el servidor + PostgreSQL en Linux
├── compilar-apk.sh                # Compila el APK release en Linux
├── scripts/                       # block-ip.sh, install-hooks.sh, seed de catálogo
└── .githooks/                     # Escaneo de dominios/secretos hardcodeados en pre-commit/pre-push
```

---

## Funcionalidades

### Bot WhatsApp
- Interpreta pedidos en lenguaje natural — adaptable a cualquier catálogo de productos
- Detección de intenciones: pedido, consulta de precio, reclamo, fiado, cierre/agradecimiento
- Descarga y almacena mensajes de voz, imágenes, video y documentos recibidos
- Envío de media (audio/imagen/video/documento) a clientes desde la app, incluso desde el navegador
- Resuelve el número real del cliente aunque WhatsApp lo identifique por `@lid` (privacidad/multi-device), y fusiona automáticamente conversaciones duplicadas
- Filtra reenvíos de historial en reconexión — no repite respuestas ya enviadas

### App (Flutter — Android/Web) y sitio público
- **Modo invitado en la web**: navegar el catálogo y armar el carrito sin cuenta; el login solo se pide al pagar, y el carrito arma­do como invitado se conserva automáticamente
- **Ventanas emergentes futuristas** en toda la app: fondo desenfocado, bordes curvos, animación de entrada/salida — un único componente compartido, sin diálogos nativos sueltos
- **Checkout en dos pasos**: entrega por ubicación en tiempo real o por dirección escrita, luego método de pago — contraentrega bloqueado hasta compartir ubicación
- **Rastrear mi pedido**: mapa en vivo de la ubicación del repartidor, visible para el cliente únicamente después de que el pedido salió a entregar — antes de eso, jamás
- **Mensajería** estilo WhatsApp: chats activos/archivados, no leídos, audio, imágenes, video, documentos, llamada directa — visibles solo para el trabajador que reclamó ese pedido, y siempre para admins
- **Catálogo de productos**: gestión completa para admin (inventario real por categoría), consulta para todos los roles
- **Promociones**: publicaciones con descuento automático (porcentaje o 2x1), configurables por acordeón desde el rol admin, con notificación push a los clientes
- **Analíticas** (solo admin): ventas reales por día, productos top y con baja rotación, desempeño y hora de entrada de empleados, clientes más frecuentes
- **Personalización de marca**: nombre, paleta de colores y logo editables desde el rol admin — se reflejan en tiempo real en toda la app, incluida la pantalla de login antes de iniciar sesión
- **Diseño responsivo** en PC/tablet/móvil, con animaciones consistentes (Material 3) en cada interacción

### Servidor
- API REST con JWT + bcrypt, revocación de tokens, rate limiting, headers de seguridad (helmet), CORS allowlist
- Validación de magic bytes en archivos subidos — rechaza un ejecutable disfrazado de imagen aunque declare el Content-Type correcto
- Compresión gzip de respuestas HTTP
- Migraciones de base de datos automáticas e idempotentes al arrancar
- Reportes PDF/Excel automáticos y bajo demanda (pedidos + chats, por rango de fechas)
- Backup diario cifrado de la base de datos, con verificación de integridad y retención configurable
- Bind por defecto a `127.0.0.1` (nunca expuesto directo salvo que se configure explícitamente)

---

## Roles de Usuario

| Rol | Acceso |
|-----|--------|
| `admin` | Todo: catálogo, usuarios, analíticas, marca/tema, configuración del bot, respaldos |
| `worker` | Mensajería (solo de sus pedidos reclamados), pedidos, promociones — sin analíticas ni configuración |
| `client` | Catálogo, carrito, pedidos propios, rastreo de entrega, promociones |

Modelo de roles genérico: se adapta a cualquier estructura de equipo (dueño/vendedores/clientes, gerencia/repartidores/clientes, etc.) sin cambios de esquema.

---

## Requisitos

- Linux (Debian/Ubuntu/Kali — el deploy detecta `apt`/`dnf`/`pacman`)
- Node.js 20 (el deploy lo instala aislado en `/opt/nodejs`, sin tocar el Node del sistema)
- PostgreSQL (el deploy lo instala y provisiona automáticamente — no requiere configuración manual)
- Redis — opcional, solo si se despliega más de una instancia del servidor y se necesita rate limiting distribuido
- Python 3 + GTK3 (`python3-gi`) — solo si se quiere usar el panel de análisis
- Flutter 3.44+ y Android SDK — solo para compilar el APK (`compilar-apk.sh` los instala si hacen falta)

---

## Despliegue del Servidor (Linux)

`deploy-linux.sh` instala, asegura y gestiona el servidor de punta a punta, incluida la base de datos. Se auto-eleva con `sudo` — necesita root para crear el usuario de sistema aislado, systemd, firewall y fail2ban. **La primera ejecución hace la instalación y configuración completa**; las siguientes solo verifican que el servicio esté arriba.

```bash
./deploy-linux.sh                # Instalación / despliegue completo (primera vez)
```

Comandos de control (no repiten el wizard de instalación):

| Comando | Acción |
|---------|--------|
| `./deploy-linux.sh --start` | Inicia el servidor (como servicio systemd aislado) |
| `./deploy-linux.sh --stop` | Detiene el servidor |
| `./deploy-linux.sh --localhost` | Cierra el acceso público (Tailscale Funnel/túnel/puertos, según cómo se instaló). El servidor sigue vivo, solo deja de ser alcanzable desde afuera |
| `./deploy-linux.sh --continue` | Reabre el acceso público |
| `./deploy-linux.sh --menu` | Panel de gestión en terminal (estado, logs, secretos, WhatsApp, etc.) |
| `./deploy-linux.sh --uninstall` | Detiene y elimina los servicios instalados (conserva datos) |
| `./deploy-linux.sh -h` / `--help` | Ayuda con todos los comandos y el estado actual de acceso público |

El servidor corre siempre como servicio systemd con un usuario de sistema dedicado, sin login, sin privilegios, `ProtectSystem=strict`, `NoNewPrivileges`, capacidades vacías y demás hardening — nunca como root.

### Acceso público

Por defecto el servidor solo escucha en `127.0.0.1`. El wizard de instalación ofrece cuatro métodos, elegible según la infraestructura de cada negocio:

| Método | Cuándo usarlo |
|--------|---------------|
| **Tailscale Funnel** | URL pública fija de por vida, gratis, HTTPS automático, sin abrir puertos ni IP fija |
| **Cloudflare Tunnel** | URL temporal, sin necesidad de cuenta, sin abrir puertos |
| **Dominio propio + nginx + Let's Encrypt** | Cuando ya se tiene un dominio; TLS 1.2/1.3 forzado con cifrados AEAD modernos |
| **Solo red local / VPN** | Uso interno, sin exposición a internet |

---

## Panel de Análisis

Herramienta de escritorio GTK3 **independiente** del deploy — se abre cuando se necesita, no se lanza automáticamente. Tema oscuro, módulos ordenados por prioridad (control primero, logs al final):

```bash
python3 dashboard.py
```

**Operación**: Monitoreo (estado del servicio, acceso público, gráficas de actividad, control start/stop/restart) · Pedidos activos · Bot WhatsApp (conexión, QR, pausa/reanuda) · Ventas (ingresos reales por día, top productos) · Empleados (desempeño, hora de entrada) · Ubicaciones (mapa en vivo del equipo en campo) · Conexiones (actividad sospechosa por IP, bloqueo a nivel firewall) · Datos (exportar historial completo a PDF/Excel por rango de fechas)

**Configuración**: Dominio · Marca (nombre, logo, colores) · Métodos de pago · Correo (cuenta emisora para recuperación de contraseña) · Configuración general · Seguridad (auditoría en vivo del hardening) · Logs

---

## Compilar la App Android

```bash
chmod +x compilar-apk.sh
./compilar-apk.sh
```

Verifica/instala Java, Flutter y Android SDK si hacen falta (sin tocar el Java del sistema). El APK release queda en la raíz del proyecto, firmado y con símbolos de depuración generados aparte.

---

## Seguridad

- Servicio systemd aislado, sin root, con capacidades y superficie de ataque mínimas
- Firewall deny-by-default (ufw/firewalld/iptables, autodetectado): solo SSH + lo estrictamente necesario
- fail2ban contra fuerza bruta
- TLS 1.2/1.3 forzado con cifrados AEAD modernos en el path nginx+dominio propio; Tailscale Funnel y Cloudflare Tunnel terminan TLS moderno en su propio edge
- JWT con revocación de tokens, contraseñas con bcrypt, códigos de recuperación de un solo uso (hasheados, expiran en 5 minutos)
- Validación de magic bytes en cada archivo subido — el tipo declarado por el cliente nunca se confía a ciegas
- Acceso a conversaciones de WhatsApp restringido: un trabajador solo ve los chats de pedidos que reclamó; los admins ven todo
- Ubicación del equipo en campo nunca visible para el cliente hasta que el pedido sale a entregar
- Secretos (`API_KEY`, `JWT_SECRET`) generados con `openssl rand -hex 32`, regenerables desde el panel
- `.env` nunca se commitea (ver `.gitignore`); usar `server/.env.example` como plantilla
- Hook de pre-commit/pre-push que escanea el diff en busca de dominios reales o secretos hardcodeados antes de que lleguen al repositorio
- Rate limiting y helmet en toda la API, con Redis opcional para que el límite sea real entre varias instancias
- Auditoría de seguridad en vivo disponible desde `deploy-linux.sh --menu` y desde el panel de análisis

---

## Respaldo de datos

Backup diario automático de toda la base de datos (`pg_dump`, formato custom), cifrado con AES-256-GCM y verificado con `pg_restore --list` para confirmar que el archivo no está truncado o corrupto — no solo que existe. Retención configurable por variable de entorno. Se puede disparar manualmente y restaurar desde el panel de análisis o el menú de `deploy-linux.sh`.

---

## Personalización de marca

Cada negocio que adopte la plataforma puede definir su propia identidad sin tocar código, desde el rol admin:

- Nombre del negocio
- Logo (con un distintivo propio de respaldo si todavía no se sube uno)
- Paleta de colores primario/acento (aplicada en tiempo real a toda la app, incluida la pantalla de login)

---

## Pruebas

```bash
cd server
npm test
```

Suite de pruebas de integración contra una base de datos PostgreSQL real (no mocks): control de acceso por rol, seguridad (fuerza bruta, XSS, escalamiento de privilegios), flujo completo de checkout, recuperación de contraseña, rastreo de pedidos, analíticas, y más.
