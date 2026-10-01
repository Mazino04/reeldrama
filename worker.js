/**
 * ReelDrama — High-Performance Cloudflare Worker Media Proxy
 * ==========================================================
 *
 * Features & Optimizations:
 *   - Universal CORS (Preflight OPTIONS, Wildcard/Dynamic headers, Private Network Access)
 *   - Zero-Uncaught-Exceptions: Every error returns full CORS headers (no browser CORS masking)
 *   - Edge CDN Caching: Media chunks (.ts, .m4s, .mp4, .key) cached at Cloudflare edge
 *   - Low-latency Streaming: Passes upstream ReadableStream without memory buffering
 *   - Socket Protection: AbortController with upstream timeout prevents browser connection pool exhaustion
 *   - Full HTTP Range Support: Seamless seeking with HTTP 206 Partial Content
 *   - Dynamic M3U8 Playlist Rewriting for HLS streams and AES-128 keys
 *   - Dual Export: Supports both Service Worker and ES Module Worker formats
 */

// ================================================================
// EVENT LISTENERS & MODULE EXPORTS
// ================================================================

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env, ctx);
    }
};

// ================================================================
// MAIN REQUEST HANDLER (WITH TOP-LEVEL ERROR GUARD)
// ================================================================

async function handleRequest(request, env, ctx) {
    try {
        return await processRequest(request, env, ctx);
    } catch (err) {
        console.error("[Worker Crash Guard]:", err.message || err);
        return json({
            error: "Proxy error occurred",
            details: err.message || String(err),
            target: request.url
        }, 500, request);
    }
}

// ================================================================
// REQUEST PROCESSING PIPELINE
// ================================================================

async function processRequest(request, env, ctx) {
    // ------------------------------------------------------------
    // 1. CORS PREFLIGHT
    // ------------------------------------------------------------
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders(request)
        });
    }

    // ------------------------------------------------------------
    // 2. ALLOW ONLY GET / HEAD / POST
    // ------------------------------------------------------------
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405, request);
    }

    // ------------------------------------------------------------
    // 3. TARGET URL EXTRACTION
    // ------------------------------------------------------------
    const reqUrl = new URL(request.url);
    let targetUrl = reqUrl.searchParams.get("url");

    // Support unencoded query strings after ?url= (e.g. ?url=https://site.com/path?a=1&b=2)
    const urlParamIndex = request.url.indexOf("?url=");
    if (urlParamIndex !== -1) {
        const rawAfterParam = request.url.slice(urlParamIndex + 5);
        if (rawAfterParam.startsWith("http://") || rawAfterParam.startsWith("https://")) {
            targetUrl = rawAfterParam;
        }
    }

    if (!targetUrl) {
        return json({
            error: "Missing ?url= parameter.",
            usage: `${reqUrl.origin}/?url=https://example.com/video.mp4`
        }, 400, request);
    }

    // ------------------------------------------------------------
    // 4. PARSE & VALIDATE TARGET
    // ------------------------------------------------------------
    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch (err) {
        return json({
            error: "Invalid target URL.",
            target: targetUrl
        }, 400, request);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return json({
            error: "Only HTTP and HTTPS URLs are allowed."
        }, 400, request);
    }

    const host = parsed.hostname.toLowerCase();
    if (isPrivateHost(host)) {
        return json({
            error: "Private or internal hosts are not allowed."
        }, 403, request);
    }

    const pathname = parsed.pathname.toLowerCase();

    // ------------------------------------------------------------
    // 5. MEDIA & ROUTE DETECTION
    // ------------------------------------------------------------
    const isMediaRequest =
        pathname.includes(".m3u8") ||
        pathname.includes(".m3u") ||
        pathname.includes(".mp4") ||
        pathname.includes(".m4s") ||
        pathname.includes(".ts") ||
        pathname.includes(".aac") ||
        pathname.includes(".m4a") ||
        pathname.includes(".mp3") ||
        pathname.includes(".webm") ||
        pathname.includes(".mp2t") ||
        pathname.includes(".key") ||
        pathname.includes(".jpg") ||
        pathname.includes(".jpeg") ||
        pathname.includes(".png") ||
        pathname.includes(".webp") ||
        host.includes("stream") ||
        host.includes("cdn") ||
        host.includes("video") ||
        host.includes("media");

    const rangeHeader = request.headers.get("Range");

    // ------------------------------------------------------------
    // 6. BUILD UPSTREAM HEADERS
    // ------------------------------------------------------------
    const upstreamHeaders = new Headers();

    // User Agent
    upstreamHeaders.set(
        "User-Agent",
        request.headers.get("User-Agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    );

    // Accept Header
    const clientAccept = request.headers.get("Accept");
    if (isMediaRequest) {
        upstreamHeaders.set("Accept", "*/*");
    } else if (clientAccept && clientAccept.includes("json")) {
        upstreamHeaders.set("Accept", "application/json, text/plain, */*");
    } else {
        upstreamHeaders.set(
            "Accept",
            clientAccept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        );
    }

    // Accept-Language
    upstreamHeaders.set(
        "Accept-Language",
        request.headers.get("Accept-Language") || "en-US,en;q=0.9"
    );

    // X-Requested-With
    const xRequestedWith = request.headers.get("X-Requested-With");
    if (xRequestedWith) {
        upstreamHeaders.set("X-Requested-With", xRequestedWith);
    }

    // Cookies & Credentials (Narto Drama Authentication)
    let clientCookie = request.headers.get("Cookie") || request.headers.get("X-ND-Cookie") || reqUrl.searchParams.get("cookie") || "";
    const isNartoDrama = host.includes("narto-drama.com") || host.includes("hakunaymatata.com");

    const DEFAULT_ND_COOKIES = [
        'remember_frontend_59ba36addc2b2f9401580f014c7f58ea4e30989d=eyJpdiI6IlhOV2dDTld5bWEvYjJhcTVpNEV5Rnc9PSIsInZhbHVlIjoiSFFZV3YrRForcWRqaGw1NThXdWtBT0tNaGxUdlpuMkZnVUhjVEdKNEdvclNOY1RtZ3hNd2U4OXRBODFJbG1HZnFlN2t6dUZEb3YrNGVlNUFjQWw3MGtieFc2dFh3dDNGdnhwbjVHbHV1WEozM0VtV2s2eGVQa1gybzdKY3dPaTJDL3c5T3IzdEZNZ21KZDBaYmR1bWcrbE11N25WelZJUFlZKy9CbDdMR0llbjhiSmxydGR5dEk3WXNBekNjcktqUS9qQzRTSkhUd2dSSU4wRFowLzltaTA0ZmFoc3RGNUp4S0NaQ3g0YU55MD0iLCJtYWMiOiJjYmJlM2UzZTg2ZTdiYmQxMTA5OWQ2OWUyZGQ5ZjU1ZjhlNWI3ZWJlNzFiMWExNDU0ZTE1MWMxMmNiMGFmYmRjIiwidGFnIjoiIn0=',
        'laravel-session=eyJpdiI6InhHUWpubTI1Vzl4YlZqalFOOVFZUUE9PSIsInZhbHVlIjoiU2NaVytaZFZyVU5YbVhKZi9QNFhJYTA0MzdxRy8xK2pubWJFODlORnV3L09uUnM5czVjTy80bDRXS3MwdUpreGI2a1AvdXdwdVcyNW5jUmFZOWllek1WbDVKRnY5M2svRzVUQUY1a1pkNEkweEpRbGdqNFNDVHJuSFNwZ3o5MlkiLCJtYWMiOiI3YjA2ZWNlMTY1NzdkMmJkNzQ1ZWIyNTFmNTlkZGJmMThlNWY4ZGNiYzA0OGZiMDk1MDFlNDc3NGIzMGE1NTA4IiwidGFnIjoiIn0=',
        'XSRF-TOKEN=eyJpdiI6IllGR3VwdFpubjJiQ2RRMXVhQzFIYlE9PSIsInZhbHVlIjoiREFBUXE1ZDN5K0hqcEhEbTN2T25NZkpoWDNNQ3I2MVFmejdGM3BFa2tKYUR2dlJoM3BoOG9DdFlSUk95dVczT09iTlBBMWVaR0ZRN1JvUHIyVWp1MUkzdzgyWXFrY1hxQ2prcVlNSmxEcEJxRmpGS29Kb3BCb3QyNzFBSnVwMk0iLCJtYWMiOiIwZTNhNmZhYWU0NzFhNDY0N2NlNjdlOGE5ODJhZWIzYjVkNTY3ZTI3Nzk1NTEzZjY1MTAxZGMwYzE4MzY2OWNjIiwidGFnIjoiIn0='
    ];

    if (isNartoDrama) {
        for (const cookiePair of DEFAULT_ND_COOKIES) {
            const cookieName = cookiePair.split('=')[0];
            if (!clientCookie.includes(`${cookieName}=`)) {
                clientCookie = clientCookie ? `${clientCookie}; ${cookiePair}` : cookiePair;
            }
        }
        if (!clientCookie.includes("nd_ck=")) {
            const autoNdCk = `nd_ck=${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            clientCookie = clientCookie ? `${clientCookie}; ${autoNdCk}` : autoNdCk;
        }
    }

    if (clientCookie) {
        upstreamHeaders.set("Cookie", clientCookie);
    }

    // Referer & Origin (Prevents 403 Forbidden on CDNs & Narto Drama)
    if (isNartoDrama) {
        upstreamHeaders.set("Referer", "https://narto-drama.com/");
        upstreamHeaders.set("Origin", "https://narto-drama.com");
    } else {
        upstreamHeaders.set("Referer", "https://narto-drama.com/");
        const clientOrigin = request.headers.get("Origin");
        if (clientOrigin && clientOrigin !== "null") {
            upstreamHeaders.set("Origin", clientOrigin);
        }
    }

    // HTTP Byte-Range Forwarding
    if (rangeHeader) {
        upstreamHeaders.set("Range", rangeHeader);
    }

    // ------------------------------------------------------------
    // 7. FETCH UPSTREAM WITH EDGE CACHING & TIMEOUT
    // ------------------------------------------------------------
    const fetchInit = {
        method: request.method === "HEAD" ? "HEAD" : (request.method === "POST" ? "POST" : "GET"),
        headers: upstreamHeaders,
        redirect: "follow"
    };

    if (request.method === "POST" && request.body) {
        fetchInit.body = request.body;
    }

    // Edge Caching configuration: Cache media chunks for 24h, search/sections for 60s
    if (isMediaRequest) {
        fetchInit.cf = {
            cacheEverything: true,
            cacheTtlByStatus: {
                "200-299": 86400,
                "404": 1,
                "500-599": 0
            }
        };
    } else if ((pathname.includes("/home/providers/sections") || pathname.includes("/search")) && !pathname.includes("/search/import")) {
        fetchInit.cf = {
            cacheEverything: true,
            cacheTtlByStatus: {
                "200-299": 60,
                "404": 1,
                "500-599": 0
            }
        };
    } else {
        fetchInit.cache = "no-store";
    }

    // Wire Client Abort Signal & Connection Timeout to Prevent Socket Exhaustion
    const isImportOrScrape =
        pathname.includes("/search/import") ||
        pathname.includes("/detail/watch") ||
        pathname.includes("/watch");

    const abortCtrl = new AbortController();
    if (request.signal) {
        request.signal.addEventListener("abort", () => {
            try { abortCtrl.abort(); } catch (_) {}
        });
    }

    // Upstream handshake timeout:
    // - Media requests: 35s
    // - Search/import & watch pages: 45s (remote provider scraping takes 15-25s)
    // - Standard APIs / browse: 25s
    const timeoutMs = isMediaRequest ? 35000 : (isImportOrScrape ? 50000 : 25000);
    const timeoutId = setTimeout(() => {
        try { abortCtrl.abort(); } catch (_) {}
    }, timeoutMs);

    let response;
    try {
        fetchInit.signal = abortCtrl.signal;
        response = await fetch(parsed.href, fetchInit);

        // Retry search/import if upstream scraping gave initial 502/504
        if ((response.status === 502 || response.status === 504) && isImportOrScrape && !abortCtrl.signal.aborted) {
            for (let retry = 0; retry < 2 && (response.status === 502 || response.status === 504) && !abortCtrl.signal.aborted; retry++) {
                await new Promise(r => setTimeout(r, 2500));
                if (!abortCtrl.signal.aborted) {
                    response = await fetch(parsed.href, fetchInit);
                }
            }
        }
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            return json({
                error: "Upstream request timed out or client aborted.",
                target: parsed.href
            }, 504, request);
        }
        return json({
            error: `Fetch failed: ${err.message}`,
            target: parsed.href
        }, 502, request);
    } finally {
        clearTimeout(timeoutId);
    }

    const finalUrl = response.url || parsed.href;
    const upstreamContentType = response.headers.get("Content-Type") || "";
    const lowerContentType = upstreamContentType.toLowerCase();
    const upstreamContentLength = response.headers.get("Content-Length");
    const upstreamContentRange = response.headers.get("Content-Range");
    const upstreamAcceptRanges = response.headers.get("Accept-Ranges");

    let finalPathname = "";
    try {
        finalPathname = new URL(finalUrl).pathname.toLowerCase();
    } catch (_) {
        finalPathname = pathname;
    }

    // ------------------------------------------------------------
    // 8. M3U8 PLAYLIST PROCESSING & REWRITING
    // ------------------------------------------------------------
    const isM3u8 =
        lowerContentType.includes("mpegurl") ||
        lowerContentType.includes("m3u8") ||
        lowerContentType.includes("x-mpegurl") ||
        finalPathname.endsWith(".m3u8") ||
        finalPathname.endsWith(".m3u");

    if (isM3u8 && response.ok && request.method !== "HEAD") {
        let playlistText;
        try {
            playlistText = await response.text();
        } catch (err) {
            return json({
                error: "Unable to read upstream M3U8 playlist.",
                target: finalUrl
            }, 502, request);
        }

        const rewritten = rewriteM3u8(playlistText, finalUrl, reqUrl.origin);
        const playlistHeaders = new Headers();

        playlistHeaders.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
        playlistHeaders.set("Cache-Control", "public, max-age=15");
        playlistHeaders.set("X-Proxied-By", "ReelDrama-CF-Worker");
        playlistHeaders.set("X-Upstream-Status", String(response.status));
        playlistHeaders.set("X-Upstream-URL", finalUrl);

        applyCors(playlistHeaders, request);

        return new Response(rewritten, {
            status: response.status,
            headers: playlistHeaders
        });
    }

    // ------------------------------------------------------------
    // 9. NORMAL / MEDIA STREAM RESPONSE
    // ------------------------------------------------------------
    const responseHeaders = new Headers();

    if (upstreamContentType) {
        responseHeaders.set("Content-Type", upstreamContentType);
    }

    if (upstreamContentLength && /^\d+$/.test(upstreamContentLength)) {
        responseHeaders.set("Content-Length", upstreamContentLength);
    }

    if (upstreamContentRange) {
        responseHeaders.set("Content-Range", upstreamContentRange);
    }

    if (upstreamAcceptRanges) {
        responseHeaders.set("Accept-Ranges", upstreamAcceptRanges);
    } else if (response.status === 206 || rangeHeader || isMediaRequest) {
        responseHeaders.set("Accept-Ranges", "bytes");
    }

    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
        responseHeaders.set("Content-Disposition", contentDisposition);
    }

    // Cache Control (Keep media cacheable for fast seeking and playback)
    if (isMediaRequest) {
        const upstreamCacheControl = response.headers.get("Cache-Control");
        if (upstreamCacheControl && !upstreamCacheControl.includes("no-store")) {
            responseHeaders.set("Cache-Control", upstreamCacheControl);
        } else {
            responseHeaders.set("Cache-Control", "public, max-age=86400");
        }
    } else {
        const cacheControl = response.headers.get("Cache-Control");
        if (cacheControl) {
            responseHeaders.set("Cache-Control", cacheControl);
        }
    }

    // Forward caching tags if present
    const etag = response.headers.get("ETag");
    if (etag) responseHeaders.set("ETag", etag);

    const lastModified = response.headers.get("Last-Modified");
    if (lastModified) responseHeaders.set("Last-Modified", lastModified);

    // Diagnostics
    responseHeaders.set("X-Proxied-By", "ReelDrama-CF-Worker");
    responseHeaders.set("X-Upstream-Status", String(response.status));
    responseHeaders.set("X-Upstream-URL", finalUrl);

    // Apply CORS
    applyCors(responseHeaders, request);

    // Guard bodyless responses (204, 205, 304, HEAD) to prevent TypeError
    const isBodyless = response.status === 204 || response.status === 205 || response.status === 304 || request.method === "HEAD";
    const bodyToSend = isBodyless ? null : response.body;

    // Sanitize statusText
    let safeStatusText = undefined;
    if (response.statusText && /^[a-zA-Z0-9 ]+$/.test(response.statusText)) {
        safeStatusText = response.statusText;
    }

    return new Response(bodyToSend, {
        status: response.status,
        statusText: safeStatusText,
        headers: responseHeaders
    });
}

// ================================================================
// HIGH-EFFICIENCY M3U8 REWRITER
// ================================================================

function rewriteM3u8(playlistText, playlistUrl, workerBase) {
    const workerPrefix = `${workerBase}/?url=`;

    return playlistText
        .split(/\r?\n/)
        .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            // Handle HLS tag lines (e.g. #EXT-X-KEY:METHOD=...,URI="...")
            if (trimmed.startsWith("#")) {
                if (trimmed.includes('URI="')) {
                    return line.replace(/URI="([^"]+)"/gi, (match, uri) => {
                        const absoluteUrl = resolveUrl(uri, playlistUrl);
                        if (!isHttpUrl(absoluteUrl)) return match;
                        return `URI="${workerPrefix}${encodeURIComponent(absoluteUrl)}"`;
                    });
                }
                return line;
            }

            // Handle segment / child playlist lines
            const absoluteUrl = resolveUrl(trimmed, playlistUrl);
            if (!isHttpUrl(absoluteUrl)) return line;
            return `${workerPrefix}${encodeURIComponent(absoluteUrl)}`;
        })
        .join("\n");
}

// ================================================================
// URL UTILITIES
// ================================================================

function resolveUrl(url, baseUrl) {
    try {
        return new URL(url, baseUrl).href;
    } catch (_) {
        return url;
    }
}

function isHttpUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (_) {
        return false;
    }
}

function isPrivateHost(host) {
    if (host === "localhost" || host === "localhost.localdomain") {
        return true;
    }
    const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!ipv4) return false;

    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;

    return false;
}

// ================================================================
// CORS HEADERS
// ================================================================

function corsHeaders(request) {
    const requestedHeaders = request && request.headers.get("Access-Control-Request-Headers");

    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": requestedHeaders || "*",
        "Access-Control-Expose-Headers": [
            "Content-Length",
            "Content-Range",
            "Accept-Ranges",
            "Content-Type",
            "Content-Disposition",
            "Cache-Control",
            "Expires",
            "X-Proxied-By",
            "X-Upstream-Status",
            "X-Upstream-URL",
            "X-Upstream-Content-Type",
            "X-Upstream-Content-Length",
            "X-Upstream-Content-Range",
            "X-Client-Range"
        ].join(", "),
        "Access-Control-Max-Age": "86400",
        "Access-Control-Allow-Private-Network": "true"
    };
}

function applyCors(headers, request) {
    const cors = corsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
        headers.set(key, value);
    }
}

// ================================================================
// JSON RESPONSE HELPER
// ================================================================

function json(data, status = 200, request = null) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(request)
        }
    });
}