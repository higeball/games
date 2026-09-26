const BASE = self.registration.scope
const CACHE = 'neko-nine-v1'
const CORE = [
  BASE,
  new URL('manifest.webmanifest', BASE).href,
  new URL('icons/neko-nine.svg', BASE).href,
  new URL('assets/characters/yasu-pixel-sheet.png', BASE).href,
  new URL('assets/characters/cat-player-sheet.png', BASE).href
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(BASE)) return
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone()
    caches.open(CACHE).then(cache => cache.put(event.request, copy))
    return response
  }).catch(() => event.request.mode === 'navigate' ? caches.match(BASE) : undefined)))
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
