import { resolve } from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function serveNekoNinePlugin() {
  return {
    name: 'serve-neko-nine',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];

        if (pathname === '/neko-nine' || pathname === '/neko-nine/') {
          const indexPath = resolve(__dirname, 'neko-nine/dist/index.html');
          if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(fs.readFileSync(indexPath));
            return;
          }
        } else if (pathname.startsWith('/neko-nine/')) {
          const relPath = pathname.replace(/^\/neko-nine\//, '');
          const filePath = resolve(__dirname, 'neko-nine/dist', relPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.end(fs.readFileSync(filePath));
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [serveNekoNinePlugin()],
  server: {
    host: true,
    port: 3000
  },
  build: {
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
});
