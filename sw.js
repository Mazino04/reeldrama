/**
 * ReelDrama - Service Worker
 * Designed for 100% compatibility with GitHub Pages (relative paths & subpaths)
 */

const CACHE_NAME = 'reeldrama-cache-v1';

// App shell assets to precache (using relative paths for GitHub Pages subfolder compatibility)
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './parser.js',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'
];

// URLs/patterns that should bypass SW caching (e.g. streaming video chunks, CORS proxies, external APIs)
function isStreamOrProxyRequest(url) {
    return (
        url.includes('.m3u8') ||
        url.includes('.ts') ||
        url.includes('.mp4') ||
        url.includes('allorigins.win') ||
        url.includes('codetabs.com') ||
        url.includes('cloudflarestorage.com') ||
        url.includes('narto-drama.com') ||
        url.includes('/detail/watch/') ||
        url.includes('/search?')
    );
}

// 1. Install Event - Cache Core App Shell
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Add assets individually so one non-critical failure does not fail SW installation
            for (const asset of PRECACHE_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn('[SW Precache Warning]', asset, err.message);
                }
            }
        })
    );
});

// 2. Activate Event - Clean Up Obsolete Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            return caches.delete(key);
                        }
                    })
                );
            })
        ])
    );
});

// 3. Fetch Event - Stale-While-Revalidate for App Shell, Passthrough for Video Streams
self.addEventListener('fetch', (event) => {
    // Only handle standard HTTP/HTTPS GET requests
    if (event.request.method !== 'GET') return;
    const url = event.request.url;

    // Direct passthrough for video manifests, TS chunks, and external proxies
    if (isStreamOrProxyRequest(url)) {
        return; // Handled directly by browser networking
    }

    // Handle HTML Navigation requests (Network-First with offline index fallback)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match('./index.html') || caches.match('./'))
        );
        return;
    }

    // Stale-While-Revalidate strategy for static resources (CSS, JS, Fonts, App Icons)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});

