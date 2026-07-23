const CACHE = 'merge-arcana-v3-0.2.2';
const CORE = [
  './',
  './index.html',
  './wiki.html?v=0.2.2',
  './styles.css?v=0.2.2',
  './manifest.webmanifest?v=0.2.2',
  './assets/icon.svg?v=0.2.2',
  './js/app.js?v=0.2.2',
  './js/data.js?v=0.2.2',
  './js/engine.js?v=0.2.2',
  './js/characters.js?v=0.2.2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('merge-arcana-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(networkFirst(event.request));
});
