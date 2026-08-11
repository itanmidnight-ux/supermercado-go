# Auditoría de seguridad — Supermercados Go

## Resumen ejecutivo

Se revisó el backend Express/SQLite, los paneles web, la app Flutter, WebSocket, carga de archivos y despliegue Docker/Nginx. Se aplicaron correcciones de alto impacto y se agregaron pruebas unitarias para las defensas nuevas. La sintaxis del backend y `git diff --check` pasan.

## Hallazgos corregidos

### SG-001 — CORS permisivo

- Severidad: Alta.
- Ubicación: `server/src/index.js:35-58`, `server/src/config.js`.
- Evidencia: el origen se derivaba de `CORS_ORIGINS` con fallback `*` y se habilitaban credenciales.
- Impacto: un despliegue mal configurado podía permitir que cualquier sitio web realizara solicitudes cross-origin.
- Corrección: lista explícita de orígenes, prohibición de `*` en producción y `credentials: false`.
- Nota: CORS solo controla navegadores; no puede impedir que una app nativa o un cliente HTTP llame al backend. La autorización real sigue siendo JWT/API key.

### SG-002 — Validación insuficiente de entradas

- Severidad: Alta.
- Ubicación: `server/src/middleware/validate.js`, `server/src/middleware/security.js`.
- Evidencia: la sanitización anterior solo hacía `trim` y eliminaba bytes nulos.
- Impacto: objetos inesperados o claves de prototype pollution podían llegar a rutas y servicios.
- Corrección: rechazo de cuerpos que no sean objetos JSON planos, rechazo de claves peligrosas y límites explícitos para JSON/urlencoded.

### SG-003 — JWT sin restricciones criptográficas

- Severidad: Alta.
- Ubicación: `server/src/middleware/auth.js`, `server/src/routes/auth.js`, `server/src/services/ws.service.js`.
- Evidencia: `jwt.verify(token, config.jwtSecret)` no fijaba algoritmo, issuer ni audience.
- Impacto: tokens emitidos para otro contexto o algoritmo no permitido podían aceptarse si compartían secreto.
- Corrección: HS256 explícito, issuer/audience obligatorios y expiración predeterminada reducida a 2 horas.

### SG-004 — Subidas con validación MIME insuficiente

- Severidad: Alta.
- Ubicación: `server/src/routes/upload.js`.
- Evidencia: se confiaba en `file.mimetype` y en la extensión original.
- Impacto: archivos disfrazados podían almacenarse en el directorio público de uploads.
- Corrección: nombre UUID, límites de partes/campos, MIME permitido y verificación de firma binaria JPEG/PNG/WebP.

### SG-005 — Webhook de WhatsApp sin firma obligatoria

- Severidad: Alta.
- Ubicación: `server/src/index.js:140-168`.
- Evidencia: el POST procesaba el cuerpo sin validar `X-Hub-Signature-256`.
- Impacto: terceros podían enviar eventos falsos al endpoint público.
- Corrección: HMAC-SHA256 contra `WA_APP_SECRET`; en producción, el endpoint responde 503 si no está configurado.

### SG-006 — Importación Excel sin límite de filas

- Severidad: Media.
- Ubicación: `server/src/routes/import-products.js`.
- Evidencia: el archivo estaba limitado por bytes, pero no por filas ni opciones de parsing.
- Impacto: consumo excesivo de CPU/memoria durante procesamiento de hojas grandes.
- Corrección: 10.000 filas máximas, `sheetRows` limitado y desactivación de fórmulas/HTML innecesarios.

### SG-011 — Credenciales iniciales y PIN predecible

- Severidad: Crítica.
- Ubicación: `server/src/migrate.js`.
- Evidencia: la migración histórica imprimía la contraseña generada y asignaba el PIN fijo `9703`.
- Impacto: logs y documentación operativa podían exponer credenciales administrativas conocidas.
- Corrección: la creación inicial exige `INITIAL_ADMIN_PASSWORD`, almacena bcrypt, no imprime secretos y la migración 022 invalida el PIN histórico.

## Riesgos pendientes que requieren infraestructura o trabajo adicional

### SG-007 — HTTPS no activo en la configuración entregada

- Severidad: Alta en producción.
- Ubicación: `nginx.conf`.
- Evidencia: el bloque HTTPS está comentado y el bloque HTTP no redirige a HTTPS.
- Impacto: credenciales, JWT y datos de pedidos podrían viajar sin cifrado.
- Acción: configurar certificado real, activar el bloque HTTPS y redirigir HTTP antes de producción.

### SG-008 — Token WebSocket en query string

- Severidad: Media.
- Ubicación: `server/src/services/ws.service.js` y `app/lib/services/ws_service.dart`.
- Evidencia: conexión con `/ws?token=...`.
- Impacto: el token puede aparecer en logs de proxy, métricas o herramientas de diagnóstico.
- Acción: migrar a `Authorization` durante el handshake o un subprotocolo autenticado y eliminar el fallback por query.

### SG-009 — Token web en localStorage

- Severidad: Media.
- Ubicación: `website/src/store/auth-store.ts`.
- Evidencia: Zustand persiste `token` y lo replica a `localStorage`.
- Impacto: un XSS exitoso podría leer el token.
- Acción: migrar a sesión con cookie HttpOnly/SameSite y protección CSRF, o mantener una arquitectura BFF.

### SG-010 — Cobertura de pruebas y dependencias

- Severidad: Media.
- Evidencia: antes de esta auditoría no había tests en `server/test`; `npm audit` no pudo consultar el registro por un fallo DNS del entorno.
- Acción: mantener los tests agregados, ejecutar `npm audit --omit=dev` en CI con red y actualizar las dependencias vulnerables cuando npm confirme los avisos.

## Verificaciones realizadas

- `node --check` sobre todos los archivos JavaScript del servidor: correcto.
- Tests Jest de middleware de seguridad: agregados; deben ejecutarse con `npm test`.
- `git diff --check`: correcto.
- Build del website Next.js previo a estos cambios: correcto.
