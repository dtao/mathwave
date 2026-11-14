// Basic offline support. Bump CACHE to drop everything cached by older versions.
const CACHE = 'mathwave-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['./', './manifest.webmanifest'])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const store = (response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  };

  if (request.mode === 'navigate') {
    // Pages: network first so updates arrive, cache when offline.
    event.respondWith(
      fetch(request)
        .then(store)
        .catch(() => caches.match(request, { ignoreVary: true }).then((hit) => hit || caches.match('./', { ignoreVary: true }))),
    );
    return;
  }

  // Assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => {
      const fresh = fetch(request).then(store);
      if (!hit) return fresh;
      fresh.catch(() => {});
      return hit;
    }),
  );
});

// The page sends the files it loaded before this worker took control.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((url) => new URL(url).origin === self.location.origin);
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))));
});
