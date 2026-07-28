# Supermercado GO — sitio web

Sitio multi-página (Vite + TS vanilla, sin framework). Reemplaza la versión
Flutter Web servida antes en `/app`. Consume la API existente de `server/`
(no la toca, no la modifica).

## Correr en dev

```bash
cd website
npm install
npm run dev
```

Sirve en `http://localhost:5173`. La API (`/api/...`) debe correr aparte
(server Express, puerto propio) — configurar proxy en `vite.config.ts` si
hace falta durante desarrollo.

## Build

```bash
npm run build
```

Type-checks con `tsc` y buildea con Vite a `website/dist/`. Cada página es
un entry point declarado en `vite.config.ts` → `build.rollupOptions.input`.

## Estructura

```
website/
├── index.html              # una entrada por página (agregar acá + en vite.config.ts)
├── vite.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── styles/
    │   ├── tokens.css       # custom properties: color, spacing, tipografía, sombra
    │   ├── layout.css       # header/footer
    │   └── components.css   # botón, card de producto, badge, skeleton
    ├── scripts/
    │   ├── animations.ts    # GSAP + ScrollTrigger + Lenis (helpers reusables)
    │   ├── layout.ts         # inyecta header/footer, cart count, contacto footer
    │   └── main.ts           # entry script de esta página
    └── partials/
        ├── header.html
        └── footer.html
```

## Páginas

Producto/venta: `index.html`, `catalogo.html`, `producto.html`, `carrito.html`,
`cuenta.html`, `login.html`, `contacto.html`.

Contenido informativo (linkeadas desde el footer, no del nav principal):
`sobre-nosotros.html`, `preguntas-frecuentes.html`, `envios-y-devoluciones.html`,
`terminos.html`, `privacidad.html`. Comparten estilos de texto largo en
`src/styles/paginas-info.css` (`.info-page`, `.prose`, `.accordion`, etc.).

## Patrón de header/footer para páginas nuevas

Ver comentario completo al inicio de `src/scripts/layout.ts`. Resumen:

1. En el `.html` de la página nueva, dejar `<div id="site-header"></div>` y
   `<div id="site-footer"></div>` donde van a ir.
2. Crear `src/scripts/<pagina>.ts` que importe los CSS base y llame a
   `mountLayout()` desde `./layout`.
3. Agregar el `.html` nuevo a `vite.config.ts` → `build.rollupOptions.input`.

Los partials se embeben en build time vía `import html from '../partials/header.html?raw'`
(soportado nativo por Vite) — no hay fetch en runtime ni parpadeo de layout.

## Animaciones

`src/scripts/animations.ts` exporta:

- `initSmoothScroll()` — scroll suave (Lenis) sincronizado con GSAP ticker
- `initScrollReveal()` — auto-anima elementos `data-reveal="up|fade|stagger"`
- `fadeInUp(selector, opts?)`
- `staggerReveal(selector, opts?)`

`mountLayout()` ya llama a `initSmoothScroll()` e `initScrollReveal()` —
no hace falta repetirlo en cada página, solo usar los atributos `data-reveal`.

## Paleta

Ver `src/styles/tokens.css`. Toda la paleta de marca (fondo, superficie,
texto, ámbar, oliva, azul) viene de `dashboard.py`/admin-panel. El único
color nuevo del sitio es `--highlight` (verde-lima eléctrico), reservado
para conversión (CTA agregar al carrito, badges de oferta) — no usarlo
como color de marca genérico.
