const https = require('https');
const DramaParser = require('./parser.js');

const CF_WORKER_URL = 'https://reeldrama.proxy-3b8.workers.dev';

async function fetchFastHtml(targetUrl) {
    const proxyUrl = `${CF_WORKER_URL.replace(/\/+$/, '')}/?url=${encodeURIComponent(targetUrl)}`;
    return new Promise((resolve, reject) => {
        https.get(proxyUrl, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ html: data, status: res.statusCode }));
        }).on('error', reject);
    });
}

async function resolveDynamicRefreshSource(refreshContext, epNum, fallbackWatchUrl) {
    if (!refreshContext || !refreshContext.token) return null;

    try {
        const rc = refreshContext;
        let refreshUrl = '';
        const baseTarget = rc.baseUrl || fallbackWatchUrl || 'https://narto-drama.com';
        const targetObj = new URL(baseTarget, 'https://narto-drama.com');
        
        let cleanPath = targetObj.pathname.replace(/\/+$/, '').replace(/\/\d+$/, '');
        cleanPath = `${cleanPath}/${Math.max(1, Number(epNum || 1))}/refresh-source`;
        targetObj.pathname = cleanPath;
        targetObj.searchParams.set('rs_ctx', rc.token);

        if (rc.useEdge && rc.edgeBase) {
            refreshUrl = rc.edgeBase.replace(/\/+$/, '') + '/e/rs' + targetObj.pathname + targetObj.search;
        } else {
            refreshUrl = targetObj.toString();
        }

        const proxyBase = CF_WORKER_URL.replace(/\/+$/, '');
        const fetchTarget = `${proxyBase}/?url=${encodeURIComponent(refreshUrl)}`;

        console.log('[Testing Dynamic Refresh URL]:', refreshUrl);

        return new Promise((resolve) => {
            const req = https.get(fetchTarget, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }, res => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    let payload = null;
                    try { payload = JSON.parse(body); } catch (_) {}
                    if (res.statusCode !== 200 || (payload && payload.ok === false)) {
                        console.log('Result: upstream unavailable ->', payload?.message || res.statusCode);
                        resolve({ unavailable: true, message: payload?.message || 'stream_temporarily_unavailable' });
                        return;
                    }
                    console.log('Result: dynamic stream resolved!', payload);
                    resolve({ streamUrl: payload.play_url || payload.direct_play_url, unavailable: false });
                });
            });
            req.on('error', (e) => {
                console.error('Request error:', e.message);
                resolve(null);
            });
        });
    } catch (err) {
        console.error('Error:', err.message);
        return null;
    }
}

async function test() {
    const watchUrl = 'https://narto-drama.com/detail/watch/exile-road-the-empress-s-miracle-rv/2?lang=en-US';
    const { html } = await fetchFastHtml(watchUrl);
    
    // Test regex extraction
    const tokenMatch = html.match(/(?:const|let|var)?\s*["']?refreshSourceContextToken["']?\s*[:=]\s*["']([^"']+)["']/i);
    const edgeBaseMatch = html.match(/(?:const|let|var)?\s*["']?refreshSourceEdgeBase["']?\s*[:=]\s*["']([^"']+)["']/i);
    const baseUrlMatch = html.match(/(?:const|let|var)?\s*["']?refreshSourceBaseUrl["']?\s*[:=]\s*["']([^"']+)["']/i);
    const useEdgeMatch = html.match(/(?:const|let|var)?\s*["']?refreshSourceUseEdge["']?\s*[:=]\s*(true|false)/i);

    const refreshContext = tokenMatch ? {
        token: tokenMatch[1].replace(/\\\//g, '/'),
        edgeBase: edgeBaseMatch ? edgeBaseMatch[1].replace(/\\\//g, '/') : 'https://edge.narto-drama.com',
        baseUrl: baseUrlMatch ? baseUrlMatch[1].replace(/\\\//g, '/') : '',
        useEdge: useEdgeMatch ? useEdgeMatch[1] === 'true' : true
    } : null;

    console.log('Extracted refreshContext:', refreshContext ? { ...refreshContext, token: refreshContext.token.slice(0, 20) + '...' } : null);

    const res = await resolveDynamicRefreshSource(refreshContext, 2, watchUrl);
    console.log('Final resolution:', res);
}

test();
