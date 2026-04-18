/**
 * sw.js — Service worker for Signal Garden.
 * Caches the app shell for offline use; data fetches use network-first strategy.
 */

const CACHE_NAME = 'signal-garden-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './modules/data.js',
  './modules/state-map.js',
  './modules/render-plant.js',
  './modules/render-garden.js',
  './modules/detail-panel.js',
  './modules/add-source.js',
  './modules/filters.js',
  './modules/utils.js',
  './modules/sparkline.js',
  './data/sources.json',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for AlbertAlert live data
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for shell assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
