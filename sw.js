const CACHE = 'walklog-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/manifest.json',
    '/js/storage.js',
    '/js/pwa.js',
    '/js/app.js',
];

// Install — cache core assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — cache first for assets, network first for API calls
self.addEventListener('fetch', e => {
    if (e.request.url.includes('workers.dev') ||
        e.request.url.includes('googleapis.com')) {
        return; // never cache API/font calls
    }
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});