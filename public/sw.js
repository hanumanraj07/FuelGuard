const CACHE_NAME = 'fuelguard-cache-v2'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/vite.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key)
        }
        return null
      }))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const request = event.request
  const url = new URL(request.url)
  const isNavigation = request.mode === 'navigate'
  const isApiRequest = url.pathname.startsWith('/api/')
  const isCrossOrigin = url.origin !== self.location.origin

  if (isApiRequest || isCrossOrigin) {
    event.respondWith(fetch(request))
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response.ok) return response
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (isNavigation) {
          return caches.match('/index.html')
        }
        return caches.match('/vite.svg')
      })
  )
})
