import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 3000
  },
  build: {
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        nekoNine: resolve(__dirname, 'neko-nine/index.html')
      }
    }
  }
});
