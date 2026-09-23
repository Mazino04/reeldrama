/**
 * ReelDrama — Cloudflare Worker CORS Proxy
 * ==========================================
 * Deploy this at https://workers.cloudflare.com (free account, no credit card needed)
 * Free tier: 100,000 requests/day — more than enough for a drama app.
 *
 * How it works:
 *   Browser → GET https://YOUR-WORKER.workers.dev/?url=https://narto-drama.com/...
 *   Worker  → fetches narto-drama.com server-side (no CORS restrictions on servers)
 *   Worker  → returns HTML with Access-Control-Allow-Origin: * header ✓
 *
 * After deploying, set CF_WORKER_URL in app.js (see comment at top of app.js).
 */

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    // ── CORS preflight (OPTIONS) ──────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return json({ error: 'Missing ?url= parameter. Usage: ?url=https://narto-drama.com/...' }, 400);
    }

    // ── Validate target URL ───────────────────────────────────────────────────
    let parsed;
    try {
        parsed = new URL(decodeURIComponent(targetUrl));
    } catch {
        return json({ error: 'Invalid target URL' }, 400);
    }

    // Only proxy allowed domains to prevent abuse
    const ALLOWED_HOSTS = ['narto-drama.com', 'www.narto-drama.com'];
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        return json({ error: `Domain "${parsed.hostname}" is not allowed.` }, 403);
    }

    // ── Fetch target URL server-side (no CORS restrictions on Cloudflare) ─────
    try {
        const response = await fetch(parsed.href, {
            method: 'GET',
            headers: {
                // Mimic a real browser request to avoid bot-detection blocks
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer':         'https://narto-drama.com/',
                'Cache-Control':   'no-cache',
            },
            redirect: 'follow',
            cf: {
                // Ask Cloudflare's edge to cache successful responses for 60s
                cacheTtl: 60,
                cacheEverything: true,
            }
        });

        const contentType = response.headers.get('Content-Type') || 'text/html; charset=utf-8';
        const body = await response.text();

        return new Response(body, {
            status: response.status,
            headers: {
                'Content-Type': contentType,
                'X-Proxied-By': 'ReelDrama-CF-Worker',
                'X-Source-Status': String(response.status),
                ...corsHeaders(),
            }
        });

    } catch (err) {
        return json({ error: `Fetch failed: ${err.message}` }, 502);
    }
}

/** Always-allowed CORS headers */
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Access-Control-Max-Age':       '86400',
    };
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

