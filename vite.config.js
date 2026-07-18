import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build works at any mount path (GitHub Pages subpath, etc.)
  base: './',
});
