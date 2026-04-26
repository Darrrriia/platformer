import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    target: 'es2022',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    port: 8765,
    strictPort: true,
    host: '127.0.0.1',
    open: false,
  },
});
