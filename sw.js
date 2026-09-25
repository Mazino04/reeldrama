/**
 * ReelDrama - Service Worker
 * Strategy: Network-First for app shell (CSS/JS/HTML) so updates are always
 * picked up immediately without requiring a hard refresh.
 * Fallback to cache when offline.
 */

// ─── BUMP THIS VERSION ON EVERY DEPLOY ───────────────────────────────────────
// Changing this string forces all clients to delete the old cache and
// re-fetch every asset fresh from the network on their next visit.
const CACHE_VERSION = 'v60-' + '2026-09-25-localstorage-restore';
const CACHE_NAME = `reeldrama-cache-${CACHE_VERSION}`;
// ─────────────────────────────────────────────────────────────────────────────

// App shell assets to precache
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './parser.js',
    './firebase-config.js',
    './manifest.webmanifest',
    './icons/reeldrama-logo.png',
    './icons/reeldrama-icon.png',
    './icons/favicon.png',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'
];

// URLs that should bypass SW entirely (video streams, APIs, Firebase, CORS proxies)
function isStreamOrProxyRequest(url) {
    try {
        const reqUrl = new URL(url);
        const isPrecached = PRECACHE_ASSETS.some(asset => url.includes(asset));
        if (reqUrl.origin !== location.origin && !isPrecached) {
            return true;
        }
    } catch (_) {}

    return (
        url.includes('.m3u8') ||
        url.includes('.ts') ||
        url.includes('.mp4') ||
        url.includes('workers.dev') ||
        url.includes('allorigins.win') ||
        url.includes('codetabs.com') ||
        url.includes('cloudflarestorage.com') ||
        url.includes('narto-drama.com') ||
        url.includes('/detail/watch/') ||
        url.includes('/search?') ||
        url.includes('firebase') ||
        url.includes('googleapis.com') ||
        url.includes('google.com') ||
        url.includes('firestore') ||
        url.includes('placeholder')
    );
}

// ─── INSTALL: Pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
    // skipWaiting() makes the new SW take over immediately without waiting
    // for existing tabs to close — critical for mobile where tabs stay open.
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const asset of PRECACHE_ASSETS) {
                try {
                    // Fetch with cache-busting so we always get the latest version
                    const response = await fetch(asset, { cache: 'no-store' });
                    if (response && response.status === 200) {
                        await cache.put(asset, response);
                    }
                } catch (err) {
                    console.warn('[SW] Precache warning:', asset, err.message);
                }
            }
        })
    );
});

// ─── ACTIVATE: Delete ALL old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Take control of all open tabs immediately
            self.clients.claim(),
            // Wipe every cache that isn't the current version
            caches.keys().then((keys) =>
                Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', key);
                            return caches.delete(key);
                        }
                    })
                )
            )
        ])
    );
});

// ─── FETCH: Network-First for app shell, passthrough for streams ───────────────
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = event.request.url;

    // Passthrough: video streams, APIs, external proxies
    if (isStreamOrProxyRequest(url)) return;

    // ── Network-First strategy ──────────────────────────────────────────────
    // Always try the network first. If it succeeds, update the cache and
    // return the fresh response. If the network fails (offline), fall back
    // to the cached version so the app still loads.
    event.respondWith(
        fetch(event.request, { cache: 'no-store' })
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return networkResponse;
            })
            .catch(async () => {
                // Network failed — serve from cache (offline fallback)
                const cached = await caches.match(event.request);
                if (cached) return cached;

                // Navigation fallback: serve index.html for offline SPA routing
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html') || caches.match('./');
                }

                // Image fallback: return a plain dark SVG placeholder
                if (event.request.destination === 'image') {
                    return new Response(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#111522"/></svg>',
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                }

                throw new Error('Network error and no cached version available.');
            })
    );
});
