import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/games/neko-nine/" : "/",
  plugins: [
    react(),
    {
      name: "owner-offline-bundle",
      apply: "build",
      generateBundle(_options, bundle) {
        const base = "/games/neko-nine/";
        const files = [
          "index.html",
          ...Object.keys(bundle),
          "manifest.webmanifest",
          "icons/neko-nine.svg",
          "assets/characters/yasu-pixel-sheet.png",
          "assets/characters/cat-player-sheet.png",
          "assets/characters/dog-player-sheet.png",
          "assets/characters/foomy-secretary-pixel.png",
          "characters/invited/shiroxler.png",
          "characters/invited/moji.png",
          "characters/invited/yasu.png",
          "characters/invited/hin.png",
        ];
        const version = createHash("sha256")
          .update(JSON.stringify(files))
          .digest("hex")
          .slice(0, 12);
        const source = `const CACHE='neko-owner-${version}';const BASE=${JSON.stringify(base)};const FILES=${JSON.stringify(files.map((f) => base + f))};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('neko-owner-')||key==='neko-nine-v1')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;event.respondWith(caches.open(CACHE).then(async cache=>{const request=event.request.mode==='navigate'?BASE+'index.html':event.request;return await cache.match(request)||fetch(event.request)}))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});`;
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
}));
