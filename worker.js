/**
 * ReelDrama — Cloudflare Worker Media Proxy
 * ==========================================
 *
 * Supports:
 *   - HTML
 *   - MP4
 *   - M4S
 *   - AAC
 *   - MP3
 *   - WebM
 *   - TS
 *   - M3U8
 *   - Nested M3U8
 *   - EXT-X-MEDIA
 *   - EXT-X-KEY
 *   - EXT-X-MAP
 *   - EXT-X-I-FRAME-STREAM-INF
 *   - EXT-X-PART
 *   - EXT-X-PRELOAD-HINT
 *   - URI="..."
 *   - HTTP Range requests
 *   - HTTP 206 Partial Content
 *   - CORS
 *
 * Important:
 *
 * Media responses are streamed directly from the upstream
 * server without reading/buffering the media body.
 *
 * Usage:
 *
 * https://YOUR-WORKER.workers.dev/?url=https://example.com/video.mp4
 */

// ================================================================
// FETCH EVENT
// ================================================================

addEventListener("fetch", event => {
    event.respondWith(
        handleRequest(event.request)
    );
});


// ================================================================
// MAIN REQUEST HANDLER
// ================================================================

async function handleRequest(request) {

    // ============================================================
    // CORS PREFLIGHT
    // ============================================================

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders()
        });
    }

    // ============================================================
    // ONLY GET / HEAD
    // ============================================================

    if (
        request.method !== "GET" &&
        request.method !== "HEAD"
    ) {
        return json({
            error: "Method not allowed."
        }, 405);
    }

    // ============================================================
    // REQUEST URL
    // ============================================================

    const reqUrl = new URL(request.url);

    let targetUrl = reqUrl.searchParams.get("url");

    // If client provided unencoded query string after ?url= (e.g. ?url=https://site.com/path?a=1&b=2),
    // reconstruct the full target URL so query parameters aren't truncated
    const urlParamIndex = request.url.indexOf("?url=");
    if (urlParamIndex !== -1) {
        const rawAfterParam = request.url.slice(urlParamIndex + 5);
        if (rawAfterParam.startsWith("http://") || rawAfterParam.startsWith("https://")) {
            targetUrl = rawAfterParam;
        }
    }

    // ============================================================
    // MISSING TARGET
    // ============================================================

    if (!targetUrl) {
        return json({
            error: "Missing ?url= parameter.",
            usage:
                `${reqUrl.origin}/?url=https://example.com/video.mp4`
        }, 400);
    }

    // ============================================================
    // PARSE TARGET
    // ============================================================

    let parsed;

    try {
        parsed = new URL(targetUrl);
    } catch (err) {
        return json({
            error: "Invalid target URL.",
            target: targetUrl
        }, 400);
    }

    // ============================================================
    // HTTP / HTTPS ONLY
    // ============================================================

    if (
        parsed.protocol !== "http:" &&
        parsed.protocol !== "https:"
    ) {
        return json({
            error:
                "Only HTTP and HTTPS URLs are allowed."
        }, 400);
    }

    // ============================================================
    // HOST
    // ============================================================

    const host =
        parsed.hostname.toLowerCase();

    // ============================================================
    // BLOCK PRIVATE HOSTS
    // ============================================================

    if (isPrivateHost(host)) {
        return json({
            error:
                "Private or internal hosts are not allowed."
        }, 403);
    }

    // ============================================================
    // PATH
    // ============================================================

    const pathname =
        parsed.pathname.toLowerCase();

    // ============================================================
    // MEDIA DETECTION
    // ============================================================

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
        host.includes("stream") ||
        host.includes("cdn") ||
        host.includes("video") ||
        host.includes("media");

    // ============================================================
    // RANGE
    // ============================================================

    const rangeHeader =
        request.headers.get("Range");

    // ============================================================
    // BUILD UPSTREAM REQUEST HEADERS
    // ============================================================

    const upstreamHeaders =
        new Headers();

    // ------------------------------------------------------------
    // USER AGENT
    // ------------------------------------------------------------

    upstreamHeaders.set(
        "User-Agent",
        request.headers.get("User-Agent") ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36"
    );

    // ------------------------------------------------------------
    // ACCEPT
    // ------------------------------------------------------------

    const clientAccept = request.headers.get("Accept");

    if (isMediaRequest) {

        upstreamHeaders.set(
            "Accept",
            "*/*"
        );

    } else if (clientAccept && (clientAccept.includes("application/json") || clientAccept.includes("json"))) {

        upstreamHeaders.set(
            "Accept",
            "application/json, text/plain, */*"
        );

    } else {

        upstreamHeaders.set(
            "Accept",
            clientAccept ||
            "text/html,application/xhtml+xml," +
            "application/xml;q=0.9,*/*;q=0.8"
        );
    }

    // ------------------------------------------------------------
    // LANGUAGE
    // ------------------------------------------------------------

    upstreamHeaders.set(
        "Accept-Language",
        request.headers.get(
            "Accept-Language"
        ) || "en-US,en;q=0.9"
    );

    // ------------------------------------------------------------
    // X-REQUESTED-WITH
    // ------------------------------------------------------------

    const xRequestedWith = request.headers.get("X-Requested-With");
    if (xRequestedWith) {
        upstreamHeaders.set("X-Requested-With", xRequestedWith);
    }

    // ------------------------------------------------------------
    // COOKIE / CREDENTIALS
    // ------------------------------------------------------------

    const clientCookie = request.headers.get("Cookie") || request.headers.get("X-ND-Cookie") || reqUrl.searchParams.get("cookie");
    if (clientCookie) {
        upstreamHeaders.set("Cookie", clientCookie);
    }

    // ------------------------------------------------------------
    // REFERER & ORIGIN
    // ------------------------------------------------------------

    // Narto-drama and hakunaymatata require Referer: https://narto-drama.com/
    // For other video CDNs (e.g. shorttv.live, serealplus), send their own origin
    // so they do not reject requests with HTTP 403 Forbidden.
    const isNartoDrama =
        host.includes("narto-drama.com") ||
        host.includes("hakunaymatata.com");

    if (isNartoDrama) {

        upstreamHeaders.set(
            "Referer",
            "https://narto-drama.com/"
        );

        upstreamHeaders.set(
            "Origin",
            "https://narto-drama.com"
        );

    } else {

        upstreamHeaders.set(
            "Referer",
            parsed.origin + "/"
        );

        upstreamHeaders.set(
            "Origin",
            parsed.origin
        );

    }

    // ============================================================
    // RANGE
    // ============================================================

    if (rangeHeader) {

        upstreamHeaders.set(
            "Range",
            rangeHeader
        );
    }

    // ============================================================
    // DO NOT FORWARD CONDITIONAL HEADERS
    //
    // These can cause:
    //
    // 304
    // 412
    // 428
    //
    // especially with CDN video URLs.
    // ============================================================

    // Intentionally NOT forwarding:
    //
    // If-Match
    // If-None-Match
    // If-Modified-Since
    // If-Unmodified-Since
    // If-Range

    // ============================================================
    // FETCH UPSTREAM
    // ============================================================

    let response;

    try {

        const fetchInit = {
            method:
                request.method === "HEAD"
                    ? "HEAD"
                    : "GET",

            headers:
                upstreamHeaders,

            redirect:
                "follow"
        };

        if (!isMediaRequest) {
            fetchInit.cache = "no-store";
        }

        response = await fetch(
            parsed.href,
            fetchInit
        );

    } catch (err) {

        return json({
            error:
                `Fetch failed: ${err.message}`,

            target:
                parsed.href

        }, 502);
    }

    // ============================================================
    // FINAL URL
    // ============================================================

    const finalUrl =
        response.url ||
        parsed.href;

    // ============================================================
    // UPSTREAM RESPONSE INFORMATION
    // ============================================================

    const upstreamContentType =
        response.headers.get(
            "Content-Type"
        ) || "";

    const lowerContentType =
        upstreamContentType.toLowerCase();

    const upstreamContentLength =
        response.headers.get(
            "Content-Length"
        );

    const upstreamContentRange =
        response.headers.get(
            "Content-Range"
        );

    const upstreamAcceptRanges =
        response.headers.get(
            "Accept-Ranges"
        );

    // ============================================================
    // FINAL PATH
    // ============================================================

    let finalPathname = "";

    try {

        finalPathname =
            new URL(finalUrl)
                .pathname
                .toLowerCase();

    } catch (err) {

        finalPathname =
            pathname;
    }

    // ============================================================
    // M3U8 DETECTION
    // ============================================================

    const isM3u8 =
        lowerContentType.includes(
            "mpegurl"
        ) ||
        lowerContentType.includes(
            "m3u8"
        ) ||
        lowerContentType.includes(
            "x-mpegurl"
        ) ||
        finalPathname.endsWith(
            ".m3u8"
        ) ||
        finalPathname.endsWith(
            ".m3u"
        );

    // ============================================================
    // M3U8
    // ============================================================

    if (
        isM3u8 &&
        response.ok &&
        request.method !== "HEAD"
    ) {

        let playlistText;

        try {

            playlistText =
                await response.text();

        } catch (err) {

            return json({
                error:
                    "Unable to read upstream M3U8 playlist.",

                details:
                    err.message,

                target:
                    finalUrl

            }, 502);
        }

        const rewritten =
            rewriteM3u8(
                playlistText,
                finalUrl,
                reqUrl.origin
            );

        const playlistHeaders =
            new Headers();

        playlistHeaders.set(
            "Content-Type",
            "application/vnd.apple.mpegurl"
        );

        playlistHeaders.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate"
        );

        playlistHeaders.set(
            "Pragma",
            "no-cache"
        );

        playlistHeaders.set(
            "X-Proxied-By",
            "ReelDrama-CF-Worker"
        );

        playlistHeaders.set(
            "X-Upstream-Status",
            String(response.status)
        );

        playlistHeaders.set(
            "X-Upstream-URL",
            finalUrl
        );

        applyCors(
            playlistHeaders
        );

        return new Response(
            rewritten,
            {
                status:
                    response.status,

                headers:
                    playlistHeaders
            }
        );
    }

    // ============================================================
    // NORMAL / MEDIA RESPONSE
    // ============================================================

    const responseHeaders =
        new Headers();

    // ============================================================
    // CONTENT TYPE
    // ============================================================

    if (upstreamContentType) {

        responseHeaders.set(
            "Content-Type",
            upstreamContentType
        );
    }

    // ============================================================
    // CONTENT LENGTH
    //
    // IMPORTANT
    //
    // For byte-range media, preserve the upstream length.
    //
    // A 206 response normally describes the size of the returned
    // byte range through Content-Length + Content-Range.
    // ============================================================

    if (
        upstreamContentLength &&
        /^\d+$/.test(
            upstreamContentLength
        )
    ) {

        responseHeaders.set(
            "Content-Length",
            upstreamContentLength
        );
    }

    // ============================================================
    // CONTENT RANGE
    // ============================================================

    if (upstreamContentRange) {

        responseHeaders.set(
            "Content-Range",
            upstreamContentRange
        );
    }

    // ============================================================
    // ACCEPT RANGES
    // ============================================================

    if (upstreamAcceptRanges) {

        responseHeaders.set(
            "Accept-Ranges",
            upstreamAcceptRanges
        );

    } else if (
        response.status === 206 ||
        rangeHeader
    ) {

        responseHeaders.set(
            "Accept-Ranges",
            "bytes"
        );
    }

    // ============================================================
    // CONTENT DISPOSITION
    // ============================================================

    const contentDisposition =
        response.headers.get(
            "Content-Disposition"
        );

    if (contentDisposition) {

        responseHeaders.set(
            "Content-Disposition",
            contentDisposition
        );
    }

    // ============================================================
    // CACHE CONTROL
    //
    // CRITICAL: NEVER send "no-store" or "no-cache" on video/media!
    // In Firefox and other browsers, "no-store" prevents the media
    // decoder from buffering byte ranges. When seeking or buffering
    // ahead, Firefox aborts with NS_ERROR_NET_PARTIAL_TRANSFER
    // ("video playback aborted due to a network error").
    // ============================================================

    if (isMediaRequest) {

        const upstreamCacheControl =
            response.headers.get("Cache-Control");

        if (
            upstreamCacheControl &&
            !upstreamCacheControl.includes("no-store")
        ) {

            responseHeaders.set(
                "Cache-Control",
                upstreamCacheControl
            );

        } else {

            responseHeaders.set(
                "Cache-Control",
                "public, max-age=86400"
            );

        }

    } else {

        const cacheControl =
            response.headers.get(
                "Cache-Control"
            );

        if (cacheControl) {

            responseHeaders.set(
                "Cache-Control",
                cacheControl
            );

        }

    }

    // ============================================================
    // ETAG, LAST-MODIFIED, EXPIRES (Forwarded for media & web)
    // ============================================================

    const etag =
        response.headers.get("ETag");

    if (etag) {

        responseHeaders.set("ETag", etag);

    }

    const lastModified =
        response.headers.get("Last-Modified");

    if (lastModified) {

        responseHeaders.set("Last-Modified", lastModified);

    }

    const expires =
        response.headers.get("Expires");

    if (expires) {

        responseHeaders.set("Expires", expires);

    }

    // ============================================================
    // DEBUG
    // ============================================================

    responseHeaders.set(
        "X-Proxied-By",
        "ReelDrama-CF-Worker"
    );

    responseHeaders.set(
        "X-Upstream-Status",
        String(response.status)
    );

    responseHeaders.set(
        "X-Upstream-URL",
        finalUrl
    );

    responseHeaders.set(
        "X-Upstream-Content-Type",
        upstreamContentType || "unknown"
    );

    responseHeaders.set(
        "X-Upstream-Content-Length",
        upstreamContentLength || "unknown"
    );

    responseHeaders.set(
        "X-Upstream-Content-Range",
        upstreamContentRange || "none"
    );

    responseHeaders.set(
        "X-Client-Range",
        rangeHeader || "none"
    );

    // ============================================================
    // CORS
    // ============================================================

    applyCors(
        responseHeaders
    );

    // ============================================================
    // RETURN STREAM
    //
    // DO NOT:
    //
    //   await response.arrayBuffer()
    //   await response.blob()
    //   await response.text()
    //
    // for media.
    //
    // Keep the upstream ReadableStream intact.
    // ============================================================

    return new Response(
        response.body,
        {
            status:
                response.status,

            statusText:
                response.statusText,

            headers:
                responseHeaders
        }
    );
}


// ================================================================
// M3U8 REWRITER
// ================================================================

function rewriteM3u8(
    playlistText,
    playlistUrl,
    workerBase
) {

    return playlistText
        .split(/\r?\n/)
        .map(line => {

            const trimmed =
                line.trim();

            // ----------------------------------------------------
            // EMPTY
            // ----------------------------------------------------

            if (!trimmed) {
                return line;
            }

            // ----------------------------------------------------
            // HLS TAG
            //
            // Rewrite URI="..."
            // ----------------------------------------------------

            if (
                trimmed.startsWith("#")
            ) {

                return line.replace(
                    /URI="([^"]+)"/gi,
                    (match, uri) => {

                        const absoluteUrl =
                            resolveUrl(
                                uri,
                                playlistUrl
                            );

                        if (
                            !isHttpUrl(
                                absoluteUrl
                            )
                        ) {
                            return match;
                        }

                        return (
                            `URI="` +
                            buildProxyUrl(
                                workerBase,
                                absoluteUrl
                            ) +
                            `"`
                        );
                    }
                );
            }

            // ----------------------------------------------------
            // SEGMENT / CHILD PLAYLIST
            // ----------------------------------------------------

            const absoluteUrl =
                resolveUrl(
                    trimmed,
                    playlistUrl
                );

            if (
                !isHttpUrl(
                    absoluteUrl
                )
            ) {
                return line;
            }

            return buildProxyUrl(
                workerBase,
                absoluteUrl
            );
        })
        .join("\n");
}


// ================================================================
// RESOLVE URL
// ================================================================

function resolveUrl(
    url,
    baseUrl
) {

    try {

        return new URL(
            url,
            baseUrl
        ).href;

    } catch (err) {

        return url;
    }
}


// ================================================================
// BUILD PROXY URL
// ================================================================

function buildProxyUrl(
    workerBase,
    targetUrl
) {

    return (
        workerBase +
        "/?url=" +
        encodeURIComponent(
            targetUrl
        )
    );
}


// ================================================================
// HTTP URL CHECK
// ================================================================

function isHttpUrl(url) {

    try {

        const parsed =
            new URL(url);

        return (
            parsed.protocol === "http:" ||
            parsed.protocol === "https:"
        );

    } catch (err) {

        return false;
    }
}


// ================================================================
// PRIVATE HOST CHECK
// ================================================================

function isPrivateHost(host) {

    // ------------------------------------------------------------
    // LOCALHOST
    // ------------------------------------------------------------

    if (
        host === "localhost" ||
        host === "localhost.localdomain"
    ) {
        return true;
    }

    // ------------------------------------------------------------
    // IPv4
    // ------------------------------------------------------------

    const ipv4 =
        host.match(
            /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/
        );

    if (!ipv4) {
        return false;
    }

    const a =
        Number(ipv4[1]);

    const b =
        Number(ipv4[2]);

    // ------------------------------------------------------------
    // 10.0.0.0/8
    // ------------------------------------------------------------

    if (a === 10) {
        return true;
    }

    // ------------------------------------------------------------
    // 127.0.0.0/8
    // ------------------------------------------------------------

    if (a === 127) {
        return true;
    }

    // ------------------------------------------------------------
    // 169.254.0.0/16
    // ------------------------------------------------------------

    if (
        a === 169 &&
        b === 254
    ) {
        return true;
    }

    // ------------------------------------------------------------
    // 172.16.0.0/12
    // ------------------------------------------------------------

    if (
        a === 172 &&
        b >= 16 &&
        b <= 31
    ) {
        return true;
    }

    // ------------------------------------------------------------
    // 192.168.0.0/16
    // ------------------------------------------------------------

    if (
        a === 192 &&
        b === 168
    ) {
        return true;
    }

    // ------------------------------------------------------------
    // 0.0.0.0/8
    // ------------------------------------------------------------

    if (a === 0) {
        return true;
    }

    return false;
}


// ================================================================
// CORS HEADERS
// ================================================================

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin":
            "*",

        "Access-Control-Allow-Methods":
            "GET, HEAD, OPTIONS",

        "Access-Control-Allow-Headers":
            [
                "Content-Type",
                "Range",
                "Cache-Control",
                "Pragma",
                "X-Requested-With"
            ].join(", "),

        "Access-Control-Expose-Headers":
            [
                "Content-Length",
                "Content-Range",
                "Accept-Ranges",
                "Content-Type",
                "Content-Disposition",
                "Cache-Control",
                "Expires",
                "X-Upstream-Status",
                "X-Upstream-URL",
                "X-Upstream-Content-Type",
                "X-Upstream-Content-Length",
                "X-Upstream-Content-Range",
                "X-Client-Range"
            ].join(", "),

        "Access-Control-Max-Age":
            "86400"
    };
}


// ================================================================
// APPLY CORS
// ================================================================

function applyCors(headers) {

    const cors =
        corsHeaders();

    for (
        const [key, value]
        of Object.entries(cors)
    ) {

        headers.set(
            key,
            value
        );
    }
}


// ================================================================
// JSON RESPONSE
// ================================================================

function json(
    data,
    status = 200
) {

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json",

                ...corsHeaders()
            }
        }
    );
}