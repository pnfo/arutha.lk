// The service worker of the website (main.ts): the app's files (hashed /assets/, fonts, icons) from the cache, so
// that the installed site opens fast; pages and /api/ always from the network (the offline dictionary is the app).
// Offline, a page request gets offline.html. KILL = true (and a deploy) removes the caches and unregisters.
const KILL = false
const CACHE = 'arutha-v1'

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/offline.html', '/images/favicon.svg'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (KILL || k !== CACHE) await caches.delete(k)
    if (KILL) {
      await self.registration.unregister()
      return
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', e => {
  if (KILL) return
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/')) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) c.put(req, res.clone())
      return res
    }))
  } else if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
  }
})
