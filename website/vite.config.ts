import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page app: cada .html es una entry point independiente. Agregá acá
// cada página nueva (catalogo.html, carrito.html, cuenta.html, etc.) a medida
// que se crean -- Vite las buildea todas a website/dist/ manteniendo la
// misma ruta relativa que tienen acá.
export default defineConfig({
  root: __dirname,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        catalogo: resolve(__dirname, 'catalogo.html'),
        producto: resolve(__dirname, 'producto.html'),
        carrito: resolve(__dirname, 'carrito.html'),
        cuenta: resolve(__dirname, 'cuenta.html'),
        login: resolve(__dirname, 'login.html'),
        contacto: resolve(__dirname, 'contacto.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});
