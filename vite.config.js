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

function serveSubprojectsPlugin() {
  return {
    name: 'serve-subprojects',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];

        // --- neko-nine ---
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

        // --- mojidan ---
        if (pathname === '/mojidan' || pathname === '/mojidan/') {
          const distIndex = resolve(__dirname, 'mojidan/dist/index.html');
          if (fs.existsSync(distIndex)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(fs.readFileSync(distIndex));
            return;
          }
        } else if (pathname.startsWith('/mojidan/')) {
          const relPath = pathname.replace(/^\/mojidan\//, '');
          const distPath = resolve(__dirname, 'mojidan/dist', relPath);
          if (fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
            const ext = distPath.substring(distPath.lastIndexOf('.')).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.end(fs.readFileSync(distPath));
            return;
          }
          const pubPath = resolve(__dirname, 'mojidan/public', relPath);
          if (fs.existsSync(pubPath) && fs.statSync(pubPath).isFile()) {
            const ext = pubPath.substring(pubPath.lastIndexOf('.')).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.end(fs.readFileSync(pubPath));
            return;
          }
          const srcPath = resolve(__dirname, 'mojidan', relPath);
          if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
            const ext = srcPath.substring(srcPath.lastIndexOf('.')).toLowerCase();
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.end(fs.readFileSync(srcPath));
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
  plugins: [serveSubprojectsPlugin()],
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
