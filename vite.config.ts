import { defineConfig } from 'vite';

// Build estático pensado para itch.io / GitHub Pages / Cloudflare Pages.
// base relativa para que funcione servido desde un subdirectorio.
export default defineConfig({
  base: './',
  server: {
    open: true,
  },
  preview: {
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
