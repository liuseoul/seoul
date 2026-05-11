// Deheng Seoul — Service Worker
// Strategy: network-first with cache fallback (keeps Supabase data fresh)

const CACHE = 'deheng-v1'

// Static shell pages to pre-cache on install
const PRECACHE_URLS = ['/projects', '/login']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  // Remove old cache versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept GET requests to our own origin
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  // Skip Next.js internal routes and API
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful navigation responses
        if (response.ok && (request.mode === 'navigate' || url.pathname.endsWith('.svg'))) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
