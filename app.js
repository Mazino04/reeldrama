/**
 * ReelDrama — Main Application Controller
 *
 * CORS Proxy Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * If you have deployed the Cloudflare Worker (worker.js), paste your Worker URL
 * below. This makes the app fully reliable on GitHub Pages with zero CORS errors.
 *
 * Example:
 *   const CF_WORKER_URL = 'https://reeldrama-proxy.YOUR-NAME.workers.dev';
 *
 * Leave as empty string ('') to use the built-in public proxy fallback chain.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const CF_WORKER_URL = 'https://bold-hill-9a84.aleperaza45.workers.dev'; // ← Paste your Cloudflare Worker URL here after deploying

// Domains that supply their own CORS headers (Access-Control-Allow-Origin: *)
// or reject worker proxying with 403 (due to auth_key or Referer validation).
// URLs from these hosts will play DIRECTLY without going through the Cloudflare Worker.
const EXCLUDED_PROXY_HOSTS = [
    'shorttv.live',
    'volcengine-forward.shorttv.live',
    'volces.com',
    'serealplus.com',
    'byte-nginx'
];

function shouldBypassProxy(url) {
    if (!url) return false;
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        return EXCLUDED_PROXY_HOSTS.some(excluded => host === excluded || host.endsWith('.' + excluded));
    } catch (_) {
        return false;
    }
}

// Allowed Short Drama Providers (6 Dedicated Providers)
const ALLOWED_PROVIDERS = [
    { key: 'dramabox', label: 'DramaBox', icon: '📦' },
    { key: 'reelshort', label: 'ReelShort', icon: '⚡' },
    { key: 'flickreels', label: 'FlickReels', icon: '🍿' },
    { key: 'netshort', label: 'NetShort', icon: '🌐' },
    { key: 'goodshort', label: 'GoodShort', icon: '✨' },
    { key: 'dramashorts', label: 'DramaShorts', icon: '🎬' }
];

// Bookmark Button Icons (Filled for saved/My List, Outline for unsaved)
const ICON_BOOKMARK_OUTLINE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const ICON_BOOKMARK_FILLED_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
const ICON_PLAY_SVG = `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;
const ICON_REWATCH_SVG = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4v6h6"></path><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;

// Aliases for backwards compatibility
const ICON_PLUS_SVG = ICON_BOOKMARK_OUTLINE_SVG;
const ICON_TRASH_SVG = ICON_BOOKMARK_FILLED_SVG;

// Player Floating Rail Bookmark SVGs (26x26)
const PLAYER_BOOKMARK_OUTLINE_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
const PLAYER_BOOKMARK_FILLED_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

function getProviderLabel(key) {
    if (!key) return 'DramaBox';
    const clean = String(key).trim().toLowerCase();
    const found = ALLOWED_PROVIDERS.find(p => p.key === clean || p.label.toLowerCase() === clean);
    return found ? found.label : (String(key).trim() || 'DramaBox');
}

/**
 * Extract human-readable provider name for an item
 */
function getItemProviderName(item) {
    if (!item) return getProviderLabel(AppState.activeProvider || 'dramabox');
    // 1. Explicit category_name from API
    if (item.category_name && typeof item.category_name === 'string' && item.category_name.trim()) {
        return getProviderLabel(item.category_name.trim());
    }
    // 2. Explicit provider field
    if (item.provider && typeof item.provider === 'string' && item.provider.trim()) {
        return getProviderLabel(item.provider.trim());
    }
    // 3. ID prefix (e.g. 'dramabox:42000027406')
    if (item.id && typeof item.id === 'string' && item.id.includes(':')) {
        const idProv = item.id.split(':')[0].trim();
        if (idProv && idProv.length > 2) {
            return getProviderLabel(idProv);
        }
    }
    // 4. URL query parameter (e.g. ?provider=dramabox)
    if (item.url && typeof item.url === 'string') {
        try {
            const urlObj = new URL(item.url, 'https://narto-drama.com');
            const provParam = urlObj.searchParams.get('provider');
            if (provParam) {
                return getProviderLabel(provParam);
            }
        } catch (_) {}
    }
    // 5. Fallback to active provider
    return getProviderLabel(AppState.activeProvider || 'dramabox');
}

// Allowed Search Languages (en-US / es-ES)
const ALLOWED_LANGS = [
    { code: 'en-US', label: 'English', flag: '🇺🇸' },
    { code: 'es-ES', label: 'Español', flag: '🇪🇸' }
];

function getLanguageLabel(code) {
    const found = ALLOWED_LANGS.find(l => l.code === code);
    return found ? `${found.flag} ${found.label}` : '🇺🇸 English';
}

// Validate saved provider & language from localStorage, defaulting strictly to dramabox & en-US
const savedProvider = localStorage.getItem('nd_active_provider');
const initialProvider = (savedProvider && ALLOWED_PROVIDERS.some(p => p.key === savedProvider.toLowerCase())) 
    ? savedProvider.toLowerCase() 
    : 'dramabox';

const savedLang = localStorage.getItem('nd_search_lang');
const initialLang = (savedLang && ALLOWED_LANGS.some(l => l.code === savedLang)) 
    ? savedLang 
    : 'en-US';

// Application State & Caches
const AppState = {
    mode: 'home', // 'home' | 'results'
    currentQuery: '',
    activeProvider: initialProvider,
    currentLang: initialLang,
    sortOrder: localStorage.getItem('nd_sort_order') || 'default',
    results: [],
    selectedDrama: null,
    proxyMethod: localStorage.getItem('nd_proxy_method') || 'auto',
    customProxy: localStorage.getItem('nd_custom_proxy') || '',
    currentSearchSessionId: 0
};

// In-Memory Caches for Blazing Fast Performance
const SearchCache = new Map();
const DetailCache = new Map();
const StreamCache = new Map();

// Streaming Player State
const PlayerState = {
    currentDrama: null,
    currentEpisodeNumber: 1,
    currentEpisodeUrl: '',
    currentStreamUrl: '',
    currentStreamKey: null,
    currentStreamExp: null,
    episodes: [],
    hls: null,
    isLoading: false,
    isPlaying: false,
    isMuted: false,
    isLiked: false,
    likeCounts: {},
    isDraggingScrub: false,
    touchStartY: 0,
    touchStartX: 0,
    touchStartTime: 0,
    lastTapTime: 0,
    episodeMarkedWatched: false,
    controlsHideTimer: null,
    controlsWereHiddenOnTouch: false
};

/**
 * Format and sanitize poster URLs
 * 1. Unpacks base64 direct CDN URLs from /media/image/{base64}
/**
 * Generate a standalone offline SVG placeholder data URI (no external network requests)
 */
function getPlaceholderSvgDataUri(title) {
    const safeTitle = (title || 'No Poster').replace(/[<>&"]/g, '').slice(0, 26);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="#111522"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="16" font-weight="700">${safeTitle}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Format Poster URLs safely:
 * 1. Unpacks base64 encoded direct CDN image URLs (/media/image/{base64})
 * 2. Unpacks any nested/duplicate worker proxy URLs to prevent double-proxying
 * 3. Resolves relative URLs (/assets/...) with https://narto-drama.com
 * 4. Proxies any remaining narto-drama.com image requests once through CF Worker
 */
function formatPosterUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let url = rawUrl.trim();
    if (!url || /^file:/i.test(url) || url.includes('file:///')) return '';

    // If accidentally double-wrapped (e.g. ?url=https://...workers.dev/?url=...), unwrap to innermost URL
    while (url.includes('workers.dev/?url=')) {
        const idx = url.indexOf('?url=');
        if (idx !== -1) {
            const nextPart = decodeURIComponent(url.substring(idx + 5));
            if (nextPart.includes('workers.dev/?url=')) {
                url = nextPart;
            } else {
                url = nextPart;
                break;
            }
        } else {
            break;
        }
    }

    // 1. Unpack Narto Drama /media/image/{base64} URLs to direct CDN URLs
    const mediaImageMatch = url.match(/\/media\/image\/([A-Za-z0-9+/=_-]+)/);
    if (mediaImageMatch && mediaImageMatch[1]) {
        try {
            let b64 = mediaImageMatch[1].replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const decoded = atob(b64);
            if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://')) && !/^file:/i.test(decoded)) {
                return decoded;
            }
        } catch (_) {}
    }

    // 2. Relative URLs
    if (url.startsWith('/')) {
        url = `https://narto-drama.com${url}`;
    }

    // 3. Prevent double-wrapping if already proxied
    if (typeof CF_WORKER_URL === 'string' && CF_WORKER_URL.trim() && url.startsWith(CF_WORKER_URL)) {
        return url;
    }
    if (url.includes('allorigins.win') || url.includes('codetabs.com')) {
        return url;
    }

    // 4. If it's targeting narto-drama.com (e.g. /assets/poster/...),
    // route it cleanly ONCE through the Cloudflare Worker proxy
    if (url.includes('narto-drama.com') && typeof CF_WORKER_URL === 'string' && CF_WORKER_URL.trim()) {
        const workerBase = CF_WORKER_URL.replace(/\/+$/, '');
        return `${workerBase}/?url=${encodeURIComponent(url)}`;
    }

    return url;
}

// Safe DOM Element Selector
function getEl(id) {
    return document.getElementById(id);
}

/**
 * DATA MANAGER: Bookmarks ("Watch Later") & Episode Progress Tracking
 * Backed by Firebase Firestore (Cloud Sync with Google Sign-In)
 * All saved reels are stored in Firebase instead of localStorage.
 */
const UserDataManager = {
    currentUser: null,
    isAuthResolved: false,
    bookmarksUnsubscribe: null,
    progressUnsubscribe: null,
    data: {
        bookmarks: {},  // dramaKey -> { id, title, poster, url, tags, episodes, savedAt }
        progress: {}    // dramaKey -> { lastWatchedEp, lastWatchedAt, watchedList: [] }
    },

    init() {
        // Load locally cached progress so progress persists immediately
        try {
            const cachedProg = localStorage.getItem('reeldrama_progress');
            if (cachedProg) {
                const parsed = JSON.parse(cachedProg);
                this.parseAndApplyProgress(parsed);
            }
        } catch (_) {}

        this.updateBadge();

        // Listen for Firebase Auth changes
        if (window.FirebaseService) {
            window.FirebaseService.onAuthStateChanged((user) => {
                this.isAuthResolved = true;
                handleAuthStateChange(user);
            });
        } else {
            this.isAuthResolved = true;
        }
    },

    isGenericIdentifier(str) {
        if (!str || typeof str !== 'string') return true;
        const s = str.trim().toLowerCase();
        if (!s || s === '/' || s === 'undefined' || s === 'null' || s === '[object object]') return true;
        if (/^file:/i.test(s) || s.includes('file:///')) return true;
        if (s === 'watch' || s === 'detail' || s === 'search' || s === 'import' || s === 'book' || s === 'drama') return true;
        if (s === '/search/import' || s === '/import' || s === '/search' || s === '/detail/watch' || s === '/watch') return true;
        if (s.startsWith('https://narto-drama.com') && (s.endsWith('/search/import') || s.endsWith('/search') || s.endsWith('/watch') || s.endsWith('/detail/watch') || s === 'https://narto-drama.com' || s === 'https://narto-drama.com/')) return true;
        if (s === 'watch_' || s === 'book_' || s === 'detail_' || s === 'title_' || s === 'dramabox_' || s === 'reelshort_' || s === 'flickreels_' || s === 'shortmax_') return true;
        return false;
    },

    extractCoreId(target) {
        if (!target) return '';
        if (typeof target === 'object') {
            if (target.book_id && !this.isGenericIdentifier(String(target.book_id))) return String(target.book_id).trim();
            if (target.drama_id && !this.isGenericIdentifier(String(target.drama_id))) return String(target.drama_id).trim();
            if (target.id && !String(target.id).startsWith('watch_') && !String(target.id).startsWith('title_') && !String(target.id).startsWith('detail_') && !String(target.id).startsWith('book_')) {
                const sId = String(target.id).trim();
                if (!this.isGenericIdentifier(sId)) return sId;
            }
        }
        const urlStr = typeof target === 'string' ? target : (target.url || target.canonicalUrl || '');
        if (!urlStr) return '';

        try {
            let parsed;
            try {
                parsed = new URL(urlStr, 'https://narto-drama.com');
            } catch (_) {
                parsed = null;
            }
            if (parsed) {
                const qId = (parsed.searchParams.get('book_id') || parsed.searchParams.get('drama_id') || parsed.searchParams.get('id') || '').trim();
                if (qId && !this.isGenericIdentifier(qId)) return qId;

                const m = parsed.pathname.match(/\/(?:detail\/)?(?:watch\/)?([a-zA-Z0-9_-]+)(?:\/\d+)?$/i);
                if (m && m[1] && !this.isGenericIdentifier(m[1])) {
                    return m[1].trim();
                }
            }
        } catch (_) {}

        const fallbackMatch = String(urlStr).match(/(?:book_id=|drama_id=|watch\/|detail\/)([a-zA-Z0-9_-]+)/i);
        if (fallbackMatch && fallbackMatch[1] && !this.isGenericIdentifier(fallbackMatch[1])) {
            return fallbackMatch[1].trim();
        }
        return '';
    },

    getAllDramaKeys(target) {
        const keys = new Set();
        if (!target) return [];

        const primaryKey = this.getDramaKey(target);
        if (primaryKey && !this.isGenericIdentifier(primaryKey)) keys.add(primaryKey);

        const primaryDocId = this.getDramaDocId(target);
        if (primaryDocId && !this.isGenericIdentifier(primaryDocId)) keys.add(primaryDocId);

        const coreId = this.extractCoreId(target);
        if (coreId && !this.isGenericIdentifier(coreId)) {
            keys.add(coreId);
            keys.add(`watch_${coreId.toLowerCase()}`);
            keys.add(`book_${coreId.toLowerCase()}`);
            keys.add(`detail_${coreId.toLowerCase()}`);

            const providers = ['dramabox', 'reelshort', 'shortmax', 'goodshort', 'sereal', 'netshort', 'flickreels', 'moboreels', 'stardust'];
            const targetProv = (typeof target === 'object' ? (target.provider || target.category_name) : '') || '';
            if (targetProv) {
                const cleanProv = targetProv.toLowerCase().replace(/\s+/g, '');
                if (!this.isGenericIdentifier(cleanProv)) {
                    keys.add(`${cleanProv}_${coreId}`);
                    keys.add(`${cleanProv}_${coreId.toLowerCase()}`);
                }
            }
            providers.forEach(p => {
                keys.add(`${p}_${coreId}`);
                keys.add(`${p}_${coreId.toLowerCase()}`);
            });
        }

        const title = (typeof target === 'string' ? '' : (target.title || '')).toLowerCase().trim();
        if (title && title.length >= 3 && !this.isGenericIdentifier(title)) {
            keys.add(`title_${title}`);
        }

        const url = (typeof target === 'string' ? target : (target.url || target.canonicalUrl || '')).toLowerCase().trim();
        if (url && !this.isGenericIdentifier(url)) {
            keys.add(url);
        }

        return Array.from(keys).filter(k => !this.isGenericIdentifier(k));
    },

    indexProgressRecord(record) {
        if (!record) return;
        const aliases = new Set();
        if (record.key && !this.isGenericIdentifier(record.key)) aliases.add(record.key);
        if (record.docId && !this.isGenericIdentifier(record.docId)) aliases.add(record.docId);
        if (record.url && !this.isGenericIdentifier(record.url)) aliases.add(record.url);
        if (record.canonicalUrl && !this.isGenericIdentifier(record.canonicalUrl)) aliases.add(record.canonicalUrl);
        if (record.title && record.title.length >= 3 && !this.isGenericIdentifier(record.title)) aliases.add(`title_${record.title.toLowerCase().trim()}`);
        if (record.decodedKeyOrUrl && !this.isGenericIdentifier(record.decodedKeyOrUrl)) aliases.add(record.decodedKeyOrUrl);

        const coreId = record.book_id || this.extractCoreId(record.url || record.key);
        if (coreId && !this.isGenericIdentifier(coreId)) {
            aliases.add(coreId);
            aliases.add(`watch_${coreId.toLowerCase()}`);
            aliases.add(`book_${coreId.toLowerCase()}`);
            aliases.add(`detail_${coreId.toLowerCase()}`);
            if (record.provider) {
                const prov = record.provider.toLowerCase().replace(/\s+/g, '');
                if (!this.isGenericIdentifier(prov)) aliases.add(`${prov}_${coreId}`);
            }
            ['dramabox', 'reelshort', 'shortmax', 'goodshort', 'sereal', 'netshort', 'flickreels', 'moboreels', 'stardust'].forEach(p => {
                aliases.add(`${p}_${coreId}`);
            });
        }

        aliases.forEach(alias => {
            if (alias && typeof alias === 'string' && alias.trim() && !this.isGenericIdentifier(alias)) {
                this.data.progress[alias.trim()] = record;
            }
        });
    },

    findMatchingBookmark(target) {
        if (!target || !this.data.bookmarks) return null;

        // 1. Direct canonical key lookups
        const key = this.getDramaKey(target);
        if (key && !this.isGenericIdentifier(key) && this.data.bookmarks[key]) {
            return this.data.bookmarks[key];
        }
        const docId = this.getDramaDocId(target);
        if (docId && !this.isGenericIdentifier(docId) && this.data.bookmarks[docId]) {
            return this.data.bookmarks[docId];
        }

        // 2. Target specific keys (only non-generic)
        const targetKeys = this.getAllDramaKeys(target);
        for (const k of targetKeys) {
            if (k && !this.isGenericIdentifier(k) && this.data.bookmarks[k]) {
                return this.data.bookmarks[k];
            }
        }

        // 3. Precise matching against unique saved bookmarks list
        const bookmarksList = this.getBookmarksList();
        if (bookmarksList.length === 0) return null;

        const targetCoreId = this.extractCoreId(target);
        const targetTitle = (typeof target === 'string' ? '' : (target.title || '')).toLowerCase().trim();
        const targetUrl = (typeof target === 'string' ? target : (target.url || target.canonicalUrl || '')).toLowerCase().trim();

        for (const b of bookmarksList) {
            if (!b) continue;

            // Match by Core ID (book_id / drama_id / numeric slug)
            if (targetCoreId && !this.isGenericIdentifier(targetCoreId)) {
                const bCoreId = b.book_id || this.extractCoreId(b);
                if (bCoreId && !this.isGenericIdentifier(bCoreId) && bCoreId.toLowerCase() === targetCoreId.toLowerCase()) {
                    return b;
                }
            }

            // Match by exact URL (NEVER use .includes which matches generic domain/paths)
            if (targetUrl && !this.isGenericIdentifier(targetUrl)) {
                const bUrl = (b.url || b.canonicalUrl || '').toLowerCase().trim();
                if (bUrl && !this.isGenericIdentifier(bUrl) && bUrl === targetUrl) {
                    return b;
                }
            }

            // Match by exact Title (minimum 3 characters, ignoring case and whitespace)
            if (targetTitle && targetTitle.length >= 3 && !this.isGenericIdentifier(targetTitle)) {
                const bTitle = (b.title || '').toLowerCase().trim();
                if (bTitle && bTitle === targetTitle) {
                    return b;
                }
            }
        }
        return null;
    },

    syncProgressToBookmark(drama, progressRecord) {
        if (!drama || !progressRecord) return;
        const bookmark = this.findMatchingBookmark(drama);
        if (!bookmark) return;

        bookmark.lastWatchedEp = progressRecord.lastWatchedEp || 1;
        bookmark.watchedList = progressRecord.watchedList || [];
        bookmark.watchedCount = (progressRecord.watchedList || []).length;
        bookmark.lastWatchedAt = progressRecord.lastWatchedAt || Date.now();
        if (progressRecord.episodes && (!bookmark.episodes || bookmark.episodes < progressRecord.episodes)) {
            bookmark.episodes = progressRecord.episodes;
        }

        if (this.currentUser && window.FirebaseService && window.FirebaseService.isReady()) {
            const bookmarkDocId = bookmark.docId || this.getDramaDocId(bookmark);
            const rtdb = window.FirebaseService.getRtdb();
            const db = window.FirebaseService.getDb();
            const updatePayload = {
                lastWatchedEp: bookmark.lastWatchedEp,
                watchedList: bookmark.watchedList,
                watchedCount: bookmark.watchedCount,
                lastWatchedAt: bookmark.lastWatchedAt,
                episodes: bookmark.episodes || 0
            };
            if (rtdb) {
                rtdb.ref(`users/${this.currentUser.uid}/bookmarks/${bookmarkDocId}`).update(updatePayload).catch(() => {});
            } else if (db) {
                db.collection('users').doc(this.currentUser.uid).collection('bookmarks').doc(bookmarkDocId).set(updatePayload, { merge: true }).catch(() => {});
            }
        }
    },

    ingestBookmarkProgress(bookmarkItem, docId) {
        if (!bookmarkItem) return;
        const coreId = bookmarkItem.book_id || this.extractCoreId(bookmarkItem);
        const lastWatchedEp = Number(bookmarkItem.lastWatchedEp) || 1;
        let watchedList = [];
        if (Array.isArray(bookmarkItem.watchedList)) {
            watchedList = bookmarkItem.watchedList.map(Number).filter(n => !isNaN(n) && n > 0);
        } else if (bookmarkItem.watchedList && typeof bookmarkItem.watchedList === 'object') {
            watchedList = Object.values(bookmarkItem.watchedList).map(Number).filter(n => !isNaN(n) && n > 0);
        }

        if (watchedList.length === 0 && lastWatchedEp > 1) {
            for (let i = 1; i <= lastWatchedEp; i++) watchedList.push(i);
        }

        const progRecord = {
            key: bookmarkItem.id || this.getDramaKey(bookmarkItem),
            url: bookmarkItem.url || '',
            canonicalUrl: bookmarkItem.canonicalUrl || bookmarkItem.url || '',
            docId: docId || bookmarkItem.docId || this.getDramaDocId(bookmarkItem),
            book_id: coreId,
            provider: bookmarkItem.provider || bookmarkItem.category_name || '',
            title: bookmarkItem.title || '',
            lastWatchedEp: lastWatchedEp,
            lastWatchedAt: Number(bookmarkItem.lastWatchedAt) || Date.now(),
            watchedList: watchedList,
            watchedCount: watchedList.length,
            episodes: Number(bookmarkItem.episodes) || 0
        };

        this.indexProgressRecord(progRecord);
    },

    getDramaKey(target) {
        if (!target) return '';
        if (typeof target === 'string') {
            const trimmed = target.trim();
            if (trimmed.startsWith('watch_')) return trimmed.toLowerCase();
            if (!trimmed.includes('/') && !trimmed.includes('?') && !trimmed.includes('.')) {
                return `watch_${trimmed.toLowerCase()}`;
            }
        }
        const dramaUrl = typeof target === 'string' ? target : (target.url || '');
        if (!dramaUrl) {
            if (target && typeof target === 'object') {
                const bid = target.book_id || target.id;
                const prov = target.provider || target.category_name || '';
                if (bid) return (prov ? prov.toLowerCase().replace(/\s+/g, '') + '_' : '') + bid;
                if (target.title) return 'title_' + target.title.toLowerCase().trim();
            }
            return '';
        }
        try {
            let parsed;
            try {
                parsed = new URL(dramaUrl, 'https://narto-drama.com');
            } catch (_) {
                parsed = null;
            }

            if (parsed) {
                const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '');
                const params = parsed.searchParams;
                const bookId = (params.get('book_id') || params.get('drama_id') || params.get('id') || (target && typeof target === 'object' ? (target.book_id || target.id) : '') || '').trim();
                const provider = (params.get('provider') || (target && typeof target === 'object' ? (target.provider || target.category_name) : '') || '').trim().toLowerCase().replace(/\s+/g, '');

                // 1. If it has a book_id (like /search/import?provider=...&book_id=...)
                if (bookId) {
                    return provider ? `${provider}_${bookId}` : `book_${bookId}`;
                }

                // 2. If it's a watch path: /detail/watch/:dramaId or /detail/watch/:dramaId/:epNum or /watch/:dramaId
                const watchMatch = pathname.match(/\/(?:detail\/)?watch\/([^/]+)(?:\/\d+)?$/i);
                if (watchMatch && watchMatch[1] && watchMatch[1] !== 'watch') {
                    return `watch_${watchMatch[1]}`;
                }

                // 3. If it has a specific drama slug/id in path: /detail/:id
                const detailMatch = pathname.match(/\/detail\/([^/]+)$/i);
                if (detailMatch && detailMatch[1] && detailMatch[1] !== 'watch') {
                    return `detail_${detailMatch[1]}`;
                }

                // 4. If it's search/import without book_id, check title + provider
                const title = (params.get('title') || (target && typeof target === 'object' ? target.title : '') || '').trim().toLowerCase();
                if (title && (pathname.includes('/search/import') || pathname.includes('/import'))) {
                    return provider ? `${provider}_title_${title}` : `title_${title}`;
                }

                // 5. Fallback: pathname without trailing episode number
                let cleanPath = pathname;
                const epMatch = cleanPath.match(/^(.*\/watch\/[^/]+)\/\d+$/);
                if (epMatch) cleanPath = epMatch[1];
                if (cleanPath === '/search/import' || cleanPath === '/import' || cleanPath === '/detail/watch' || cleanPath === '/watch') {
                    return '';
                }
                return cleanPath;
            }
            return String(dramaUrl).trim().toLowerCase();
        } catch (_) {
            return String(dramaUrl).trim().toLowerCase();
        }
    },

    getDramaDocId(target) {
        const key = this.getDramaKey(target);
        if (!key || this.isGenericIdentifier(key)) return '';
        try {
            // Base64url safe string without slashes for Firebase key / Firestore document ID
            return btoa(unescape(encodeURIComponent(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').substring(0, 100);
        } catch (_) {
            return key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
        }
    },

    onUserSignedIn(user) {
        this.currentUser = user;
        this.subscribeToDatabase(user);
    },

    onUserSignedOut() {
        if (this.rtdbBookmarksRef) {
            this.rtdbBookmarksRef.off();
            this.rtdbBookmarksRef = null;
        }
        if (this.rtdbProgressRef) {
            this.rtdbProgressRef.off();
            this.rtdbProgressRef = null;
        }
        if (typeof this.bookmarksUnsubscribe === 'function') {
            this.bookmarksUnsubscribe();
            this.bookmarksUnsubscribe = null;
        }
        if (typeof this.progressUnsubscribe === 'function') {
            this.progressUnsubscribe();
            this.progressUnsubscribe = null;
        }
        this.currentUser = null;
        this.data.bookmarks = {};
        this.data.progress = {};
        this.updateBadge();
        updateVisibleBookmarkButtons();
        updateVisibleCardProgress();
        if (AppState.mode === 'bookmarks') {
            renderBookmarksView();
        }
    },

    subscribeToDatabase(user) {
        if (!window.FirebaseService || !window.FirebaseService.isReady()) return;

        // Perform one-time migration of any old localStorage bookmarks into Firebase
        if (this._pendingMigration) {
            this.migrateOldData(user, this._pendingMigration);
            this._pendingMigration = null;
        }

        // 1. Prefer Realtime Database if available
        const rtdb = window.FirebaseService.getRtdb();
        if (rtdb) {
            try {
                const bookmarksRef = rtdb.ref(`users/${user.uid}/bookmarks`);
                this.rtdbBookmarksRef = bookmarksRef;
                bookmarksRef.on('value', (snapshot) => {
                    const raw = snapshot.val() || {};
                    const newBookmarks = {};
                    for (const [docKey, item] of Object.entries(raw)) {
                        if (item && (item.url || item.id || item.title)) {
                            const key = this.getDramaKey(item);
                            // Purge corrupt keys that point to raw endpoints or file:/// protocols
                            const isCorrupt = this.isGenericIdentifier(key) || 
                                              this.isGenericIdentifier(docKey) || 
                                              key === '/search/import' || 
                                              key === 'https://narto-drama.com/search/import' || 
                                              key.endsWith('/detail/watch') || 
                                              key.endsWith('/watch') ||
                                              (item.url && (/^file:/i.test(item.url.trim()) || item.url.includes('file:///'))) ||
                                              (item.poster && (/^file:/i.test(item.poster.trim()) || item.poster.includes('file:///'))) ||
                                              /^file:/i.test(docKey);
                            if (!isCorrupt) {
                                item.poster = formatPosterUrl(item.poster || '');
                                item.docId = item.docId || docKey;
                                newBookmarks[docKey] = item;
                                if (key && key !== docKey && !this.isGenericIdentifier(key)) {
                                    newBookmarks[key] = item;
                                }
                                if ((item.watchedList && (Array.isArray(item.watchedList) ? item.watchedList.length > 0 : Object.keys(item.watchedList).length > 0)) || item.lastWatchedEp) {
                                    this.ingestBookmarkProgress(item, docKey);
                                }
                            } else {
                                // Automatically purge corrupt legacy bookmark from RTDB
                                try {
                                    rtdb.ref(`users/${user.uid}/bookmarks/${docKey}`).remove();
                                } catch (_) {}
                            }
                        }
                    }
                    this.data.bookmarks = newBookmarks;
                    this.updateBadge();
                    updateVisibleBookmarkButtons();
                    updateVisibleCardProgress();
                    if (AppState.mode === 'bookmarks') {
                        renderBookmarksView();
                    }
                }, (err) => {
                    console.warn('[Realtime Database] Bookmarks listener notice:', err);
                });

                const progressRef = rtdb.ref(`users/${user.uid}/progress`);
                this.rtdbProgressRef = progressRef;
                progressRef.on('value', (snapshot) => {
                    const rawData = snapshot.val() || {};
                    this.parseAndApplyProgress(rawData);
                }, (err) => {
                    console.warn('[Realtime Database] Progress listener notice:', err);
                });
                return;
            } catch (rtdbErr) {
                console.warn('[Realtime Database] Error attaching listener, trying Firestore:', rtdbErr);
            }
        }

        // 2. Cloud Firestore Fallback
        const db = window.FirebaseService.getDb();
        if (!db) return;

        if (typeof this.bookmarksUnsubscribe === 'function') this.bookmarksUnsubscribe();
        if (typeof this.progressUnsubscribe === 'function') this.progressUnsubscribe();

        try {
            const bookmarksRef = db.collection('users').doc(user.uid).collection('bookmarks');
            this.bookmarksUnsubscribe = bookmarksRef.onSnapshot((snapshot) => {
                const newBookmarks = {};
                snapshot.forEach((doc) => {
                    const d = doc.data();
                    if (d && (d.url || d.id || d.title)) {
                        const key = this.getDramaKey(d);
                        const isCorrupt = this.isGenericIdentifier(key) || 
                                          this.isGenericIdentifier(doc.id) || 
                                          key === '/search/import' || 
                                          key === 'https://narto-drama.com/search/import' || 
                                          key.endsWith('/detail/watch') || 
                                          key.endsWith('/watch') ||
                                          (d.url && (/^file:/i.test(d.url.trim()) || d.url.includes('file:///'))) ||
                                          (d.poster && (/^file:/i.test(d.poster.trim()) || d.poster.includes('file:///'))) ||
                                          /^file:/i.test(doc.id);
                        if (!isCorrupt) {
                            d.poster = formatPosterUrl(d.poster || '');
                            d.docId = d.docId || doc.id;
                            newBookmarks[doc.id] = d;
                            if (key && key !== doc.id && !this.isGenericIdentifier(key)) {
                                newBookmarks[key] = d;
                            }
                            if ((d.watchedList && (Array.isArray(d.watchedList) ? d.watchedList.length > 0 : Object.keys(d.watchedList).length > 0)) || d.lastWatchedEp) {
                                this.ingestBookmarkProgress(d, doc.id);
                            }
                        } else {
                            try {
                                doc.ref.delete();
                            } catch (_) {}
                        }
                    }
                });
                this.data.bookmarks = newBookmarks;
                this.updateBadge();
                updateVisibleBookmarkButtons();
                updateVisibleCardProgress();
                if (AppState.mode === 'bookmarks') {
                    renderBookmarksView();
                }
            }, (err) => {
                console.warn('[Firestore] Bookmarks snapshot listener warning:', err);
            });
        } catch (err) {
            console.error('[Firestore] Failed to attach bookmarks listener:', err);
        }

        try {
            const progressRef = db.collection('users').doc(user.uid).collection('progress');
            this.progressUnsubscribe = progressRef.onSnapshot((snapshot) => {
                const rawData = {};
                snapshot.forEach((doc) => {
                    rawData[doc.id] = doc.data();
                });
                this.parseAndApplyProgress(rawData);
            }, (err) => {
                console.warn('[Firestore] Progress snapshot listener warning:', err);
            });
        } catch (err) {
            console.error('[Firestore] Failed to attach progress listener:', err);
        }
    },

    async migrateOldData(user, oldData) {
        try {
            const rtdb = window.FirebaseService.getRtdb();
            if (rtdb) {
                if (oldData.bookmarks && typeof oldData.bookmarks === 'object') {
                    for (const item of Object.values(oldData.bookmarks)) {
                        if (item && item.url && !/^file:/i.test(item.url)) {
                            const docId = this.getDramaDocId(item.url);
                            await rtdb.ref(`users/${user.uid}/bookmarks/${docId}`).set(item);
                        }
                    }
                }
                localStorage.removeItem('reeldrama_user_data');
                return;
            }

            const db = window.FirebaseService.getDb();
            if (!db) return;
            const batch = db.batch();
            let count = 0;

            if (oldData.bookmarks && typeof oldData.bookmarks === 'object') {
                for (const item of Object.values(oldData.bookmarks)) {
                    if (item && item.url && !/^file:/i.test(item.url)) {
                        const docId = this.getDramaDocId(item.url);
                        const docRef = db.collection('users').doc(user.uid).collection('bookmarks').doc(docId);
                        batch.set(docRef, item, { merge: true });
                        count++;
                    }
                }
            }

            if (count > 0) {
                await batch.commit();
                console.log(`[Firebase] Successfully migrated ${count} saved reels to Firebase.`);
            }
            localStorage.removeItem('reeldrama_user_data');
        } catch (err) {
            console.warn('[Firebase] Migration warning:', err);
            localStorage.removeItem('reeldrama_user_data');
        }
    },

    updateBadge() {
        const count = this.getBookmarksList().length;
        if (elements.navBookmarkCount) {
            if (count > 0 && this.currentUser) {
                elements.navBookmarkCount.textContent = count > 99 ? '99+' : count;
                elements.navBookmarkCount.style.display = 'inline-block';
            } else {
                elements.navBookmarkCount.style.display = 'none';
            }
        }
        if (elements.dropdownSavedCount) {
            if (count > 0 && this.currentUser) {
                elements.dropdownSavedCount.textContent = count > 99 ? '99+' : count;
                elements.dropdownSavedCount.style.display = 'inline-block';
            } else {
                elements.dropdownSavedCount.style.display = 'none';
            }
        }
        if (elements.m3SavedBadge) {
            elements.m3SavedBadge.style.display = 'none';
        }
        if (elements.railSavedBadge) {
            if (count > 0 && this.currentUser) {
                elements.railSavedBadge.textContent = count > 99 ? '99+' : count;
                elements.railSavedBadge.style.display = 'inline-block';
            } else {
                elements.railSavedBadge.style.display = 'none';
            }
        }
        if (elements.bookmarksCountBadge) {
            elements.bookmarksCountBadge.textContent = this.currentUser ? `${count} saved` : 'Sign in';
        }
    },

    isBookmarked(target) {
        if (!this.currentUser) return false;
        return Boolean(this.findMatchingBookmark(target));
    },

    async toggleBookmark(drama) {
        if (!this.currentUser) {
            showToast('Sign in with Google to save reels', 'info');
            handleGoogleSignIn();
            return false;
        }

        if (!drama || /^file:/i.test(drama.url || '')) return false;
        const key = this.getDramaKey(drama);
        if (!key || this.isGenericIdentifier(key)) return false;

        const docId = this.getDramaDocId(drama);
        if (!docId || this.isGenericIdentifier(docId)) return false;

        const rtdb = window.FirebaseService.getRtdb();
        const db = window.FirebaseService.getDb();
        if (!rtdb && !db) {
            showToast('Firebase connection not available', 'error');
            return false;
        }

        const existingBookmark = this.findMatchingBookmark(drama);
        const isCurrentlySaved = Boolean(existingBookmark);

        if (isCurrentlySaved) {
            const targetDocId = existingBookmark.docId || docId;
            const targetKey = existingBookmark.id || key;
            // Optimistic in-memory update
            for (const [k, v] of Object.entries(this.data.bookmarks)) {
                if (v === existingBookmark || (v && targetDocId && v.docId === targetDocId) || k === targetDocId || k === docId || k === targetKey || k === key) {
                    delete this.data.bookmarks[k];
                }
            }

            this.updateBadge();
            try {
                if (rtdb) {
                    await rtdb.ref(`users/${this.currentUser.uid}/bookmarks/${targetDocId}`).remove();
                } else if (db) {
                    await db.collection('users').doc(this.currentUser.uid).collection('bookmarks').doc(targetDocId).delete();
                }
            } catch (err) {
                console.error('[Firebase] Failed to delete bookmark:', err);
                if (docId) this.data.bookmarks[docId] = existingBookmark;
                if (key) this.data.bookmarks[key] = existingBookmark;
                this.updateBadge();
                throw err;
            }
            return false;
        } else {
            const safePoster = formatPosterUrl(drama.poster || '');
            const currentProg = this.getDramaProgress(drama);
            const coreId = this.extractCoreId(drama);
            const bookmarkData = {
                id: key,
                docId: docId,
                title: drama.title || 'Untitled Drama',
                poster: safePoster,
                url: drama.url,
                canonicalUrl: drama.canonicalUrl || drama.url,
                book_id: coreId,
                tags: Array.isArray(drama.tags) ? drama.tags : [],
                category_name: drama.category_name || getItemProviderName(drama),
                episodes: drama.episodes || (drama.episodeList ? drama.episodeList.length : (currentProg.episodes || 0)),
                savedAt: Date.now(),
                // TIE PROGRESS DIRECTLY TO BOOKMARK
                lastWatchedEp: currentProg.lastWatchedEp || 1,
                watchedList: currentProg.watchedList || [],
                watchedCount: (currentProg.watchedList || []).length,
                lastWatchedAt: currentProg.lastWatchedAt || 0
            };

            // Optimistic in-memory update
            if (docId) this.data.bookmarks[docId] = bookmarkData;
            if (key && key !== docId && !this.isGenericIdentifier(key)) {
                this.data.bookmarks[key] = bookmarkData;
            }

            this.updateBadge();
            try {
                if (rtdb) {
                    await rtdb.ref(`users/${this.currentUser.uid}/bookmarks/${docId}`).set(bookmarkData);
                } else if (db) {
                    await db.collection('users').doc(this.currentUser.uid).collection('bookmarks').doc(docId).set(bookmarkData);
                }
            } catch (err) {
                console.error('[Firebase] Failed to save bookmark:', err);
                if (docId) delete this.data.bookmarks[docId];
                if (key) delete this.data.bookmarks[key];
                this.updateBadge();
                throw err;
            }
            return true;
        }
    },

    getBookmarksList() {
        const uniqueMap = new Map();
        for (const item of Object.values(this.data.bookmarks || {})) {
            if (!item || (!item.url && !item.id && !item.title)) continue;
            // Disallow any corrupt bookmarks pointing to local file:/// URIs
            if ((item.url && (/^file:/i.test(item.url.trim()) || item.url.includes('file:///'))) ||
                (item.id && (/^file:/i.test(item.id.trim()) || item.id.includes('file:///')))) {
                continue;
            }
            const key = this.getDramaKey(item);
            if (this.isGenericIdentifier(key)) continue;

            const uid = item.docId || item.id || key || item.url;
            if (uid && !uniqueMap.has(uid)) {
                if (item.poster) item.poster = formatPosterUrl(item.poster);
                uniqueMap.set(uid, item);
            }
        }
        const list = Array.from(uniqueMap.values());
        return list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    },

    async clearAllBookmarks() {
        if (!this.currentUser) return;
        const rtdb = window.FirebaseService.getRtdb();
        const db = window.FirebaseService.getDb();
        if (!rtdb && !db) return;

        try {
            if (rtdb) {
                await rtdb.ref(`users/${this.currentUser.uid}/bookmarks`).remove();
            } else if (db) {
                const bookmarksRef = db.collection('users').doc(this.currentUser.uid).collection('bookmarks');
                const snapshot = await bookmarksRef.get();
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
            this.data.bookmarks = {};
            this.updateBadge();
            updateVisibleBookmarkButtons();
            updateVisibleCardProgress();
        } catch (err) {
            console.error('[Firebase] Clear all error:', err);
            throw err;
        }
    },

    parseAndApplyProgress(rawData) {
        if (!rawData || typeof rawData !== 'object') {
            this.data.progress = {};
            return;
        }

        for (const [docIdKey, val] of Object.entries(rawData)) {
            if (!val || typeof val !== 'object') continue;

            // 1. Normalize watchedList (Array, Object { "0": 1 }, or String)
            let watchedList = [];
            if (Array.isArray(val.watchedList)) {
                watchedList = val.watchedList.map(Number).filter(n => !isNaN(n) && n > 0);
            } else if (val.watchedList && typeof val.watchedList === 'object') {
                watchedList = Object.values(val.watchedList).map(Number).filter(n => !isNaN(n) && n > 0);
            } else if (typeof val.watchedList === 'string') {
                watchedList = val.watchedList.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
            } else if (typeof val.watchedList === 'number' && val.watchedList > 0) {
                watchedList = [val.watchedList];
            }

            // 2. Normalize lastWatchedEp
            let lastWatchedEp = Number(val.lastWatchedEp || val.lastEpNum || val.lastEp || val.ep || val.episode) || 0;
            if (!lastWatchedEp && watchedList.length > 0) {
                lastWatchedEp = Math.max(...watchedList);
            }
            watchedList = Array.from(new Set(watchedList)).sort((a, b) => a - b);

            // Legacy backfill ONLY if watchedList was completely empty
            if (lastWatchedEp > 1 && watchedList.length === 0) {
                const backfilled = [];
                for (let i = 1; i <= lastWatchedEp; i++) backfilled.push(i);
                watchedList = backfilled;
            }

            if (!lastWatchedEp) lastWatchedEp = watchedList.length > 0 ? Math.max(...watchedList) : 1;

            const lastWatchedAt = Number(val.lastWatchedAt) || Date.now();

            // 3. Decode docIdKey if base64
            let decoded = '';
            try {
                let b64 = docIdKey.replace(/-/g, '+').replace(/_/g, '/');
                while (b64.length % 4) b64 += '=';
                decoded = decodeURIComponent(escape(atob(b64)));
            } catch (_) {
                try {
                    let b64 = docIdKey.replace(/-/g, '+').replace(/_/g, '/');
                    while (b64.length % 4) b64 += '=';
                    decoded = atob(b64);
                } catch (_) {}
            }

            const cleanRecord = {
                key: val.key || '',
                url: val.url || val.dramaUrl || '',
                canonicalUrl: val.canonicalUrl || '',
                docId: docIdKey,
                decodedKeyOrUrl: decoded,
                title: val.title || '',
                book_id: val.book_id || this.extractCoreId(val.url || val.key || decoded),
                provider: val.provider || '',
                episodes: Number(val.episodes) || 0,
                lastWatchedEp,
                lastWatchedAt,
                watchedList,
                watchedCount: watchedList.length
            };

            this.indexProgressRecord(cleanRecord);

            // Cross-update any matching bookmark in memory
            const matchingBookmark = this.findMatchingBookmark(cleanRecord);
            if (matchingBookmark) {
                matchingBookmark.lastWatchedEp = lastWatchedEp;
                matchingBookmark.watchedList = watchedList;
                matchingBookmark.watchedCount = watchedList.length;
                matchingBookmark.lastWatchedAt = lastWatchedAt;
                if (cleanRecord.episodes && (!matchingBookmark.episodes || matchingBookmark.episodes < cleanRecord.episodes)) {
                    matchingBookmark.episodes = cleanRecord.episodes;
                }
            }
        }

        try {
            localStorage.setItem('reeldrama_progress', JSON.stringify(this.data.progress));
        } catch (_) {}

        updateVisibleCardProgress();
        if (AppState.selectedDrama && (AppState.mode === 'detail' || (elements.quickViewModal && elements.quickViewModal.classList.contains('active')))) {
            if (AppState.selectedDrama.episodeList && AppState.selectedDrama.episodeList.length > 0) {
                renderEpisodesList(AppState.selectedDrama.episodeList, AppState.selectedDrama.episodes);
            }
        }
        if (PlayerState.currentDrama && elements.reelEpisodesSheet && elements.reelEpisodesSheet.classList.contains('active')) {
            renderEpisodesSheet(PlayerState.episodes, PlayerState.currentEpisodeNumber);
        }
    },

    getDramaProgress(target) {
        if (!target) return { lastWatchedEp: 1, lastWatchedAt: 0, watchedList: [], episodes: 0 };

        const returnValid = (item) => {
            if (!item || typeof item !== 'object') return null;
            let list = [];
            if (Array.isArray(item.watchedList)) {
                list = item.watchedList.map(Number).filter(n => !isNaN(n) && n > 0);
            } else if (item.watchedList && typeof item.watchedList === 'object') {
                list = Object.values(item.watchedList).map(Number).filter(n => !isNaN(n) && n > 0);
            }
            let lastEp = Number(item.lastWatchedEp || item.lastEpNum || item.ep || 0);
            if (!lastEp && list.length > 0) lastEp = Math.max(...list);
            list = Array.from(new Set(list)).sort((a, b) => a - b);

            // Legacy backfill ONLY if watchedList is empty
            if (lastEp > 1 && list.length === 0) {
                for (let i = 1; i <= lastEp; i++) list.push(i);
            }

            const epCount = Number(item.episodes) || 0;
            const isComp = Boolean(item.isCompleted) || (epCount > 0 && (list.length >= epCount || (lastEp >= epCount && list.includes(epCount))));

            return {
                lastWatchedEp: lastEp || 1,
                lastWatchedAt: Number(item.lastWatchedAt) || 0,
                watchedList: list,
                episodes: epCount,
                isCompleted: isComp,
                title: item.title || ''
            };
        };

        // 1. Direct object matching via multiple aliases
        if (typeof target === 'object' && target !== null) {
            const allKeys = this.getAllDramaKeys(target);
            for (const k of allKeys) {
                if (k && this.data.progress[k]) {
                    const res = returnValid(this.data.progress[k]);
                    if (res && (res.watchedList.length > 0 || res.lastWatchedAt > 0 || res.lastWatchedEp > 1)) {
                        if (!res.episodes) {
                            const b = this.findMatchingBookmark(target);
                            if (b && b.episodes > 0) {
                                res.episodes = Number(b.episodes);
                                if (res.watchedList.length >= res.episodes) res.isCompleted = true;
                            }
                        }
                        return res;
                    }
                }
            }

            // Check bookmark matching
            const bookmark = this.findMatchingBookmark(target);
            if (bookmark && (bookmark.watchedList || bookmark.lastWatchedEp)) {
                const res = returnValid(bookmark);
                if (res && (res.watchedList.length > 0 || res.lastWatchedAt > 0 || res.lastWatchedEp > 1)) return res;
            }
        }

        // 2. String target matching
        const str = typeof target === 'string' ? target.trim() : '';
        if (str) {
            const allKeys = this.getAllDramaKeys(str);
            for (const k of allKeys) {
                if (k && this.data.progress[k]) {
                    const res = returnValid(this.data.progress[k]);
                    if (res) return res;
                }
            }

            const strLower = str.toLowerCase();
            for (const item of Object.values(this.data.progress)) {
                if (!item) continue;
                if (item.key && item.key.toLowerCase() === strLower) {
                    const res = returnValid(item);
                    if (res) return res;
                }
                if (item.url && (item.url.toLowerCase() === strLower || strLower.includes(item.url.toLowerCase()) || item.url.toLowerCase().includes(strLower))) {
                    const res = returnValid(item);
                    if (res) return res;
                }
                if (item.title && strLower.includes(item.title.toLowerCase())) {
                    const res = returnValid(item);
                    if (res) return res;
                }
            }
        }

        return { lastWatchedEp: 1, lastWatchedAt: 0, watchedList: [], episodes: 0, isCompleted: false };
    },

    isProgressCompleted(drama) {
        if (!drama) return false;
        const prog = this.getDramaProgress(drama);
        if (!prog) return false;
        if (prog.isCompleted) return true;
        const watchedList = Array.isArray(prog.watchedList) ? prog.watchedList : [];
        const watchedCount = watchedList.length > 0
            ? watchedList.length
            : (prog.lastWatchedEp && prog.lastWatchedEp > 1 ? prog.lastWatchedEp : 0);
        let totalEps = (typeof drama === 'object' && drama.episodes && drama.episodes > 0)
            ? drama.episodes
            : (drama.episodeList ? drama.episodeList.length : (prog.episodes || 0));
        if (!totalEps) {
            const bookmark = this.findMatchingBookmark(drama);
            if (bookmark && bookmark.episodes > 0) totalEps = bookmark.episodes;
        }
        if (totalEps > 0 && (watchedList.length >= totalEps || (watchedCount >= totalEps && Math.round((watchedCount / totalEps) * 100) >= 100))) {
            return true;
        }
        return false;
    },

    setLastWatchedEpisode(drama, epNum) {
        if (!drama) return;
        const key = this.getDramaKey(drama);
        if (!key) return;

        // If progress is already completed (100% watched / rewatching), do not overwrite progress
        if (this.isProgressCompleted(drama)) {
            return;
        }

        const ep = parseInt(epNum, 10) || 1;
        const currentProg = this.getDramaProgress(drama);
        const watchedList = Array.isArray(currentProg.watchedList) ? [...currentProg.watchedList] : [];
        const docId = this.getDramaDocId(drama);
        const rawUrl = typeof drama === 'string' ? drama : (drama.url || '');
        const dramaTitle = typeof drama === 'object' ? (drama.title || '') : '';
        const coreId = this.extractCoreId(drama);
        const providerName = typeof drama === 'object' ? (drama.provider || drama.category_name || '') : '';

        let totalEps = (typeof drama === 'object' && drama.episodes && Number(drama.episodes) > 0)
            ? Number(drama.episodes)
            : (drama && Array.isArray(drama.episodeList) && drama.episodeList.length > 0 ? drama.episodeList.length : 0);

        if (!totalEps && typeof PlayerState !== 'undefined' && PlayerState.episodes && PlayerState.episodes.length > 0) {
            totalEps = PlayerState.episodes.length;
        }
        if (!totalEps && currentProg.episodes && Number(currentProg.episodes) > 0) {
            totalEps = Number(currentProg.episodes);
        }
        if (!totalEps) {
            const bookmark = this.findMatchingBookmark(drama);
            if (bookmark && bookmark.episodes > 0) totalEps = Number(bookmark.episodes);
        }

        // Offset-of-1 progress range logic:
        // Watching episode N means episodes 1 through N-1 are marked watched.
        // Episode N is not added until episode N+1.
        // Final episode exception: When at or reaching the final episode (ep >= totalEps),
        // all episodes 1 through totalEps (including the final episode) are marked watched.
        let upToEp = ep - 1;
        if (totalEps > 0 && ep >= totalEps) {
            upToEp = totalEps;
        }

        if (upToEp > 0) {
            for (let i = 1; i <= upToEp; i++) {
                if (!watchedList.includes(i)) {
                    watchedList.push(i);
                }
            }
            watchedList.sort((a, b) => a - b);
        }

        const isCompleted = (totalEps > 0 && watchedList.length >= totalEps) || Boolean(currentProg.isCompleted);

        const updatedRecord = {
            key: key,
            url: rawUrl,
            canonicalUrl: (typeof drama === 'object' ? drama.canonicalUrl : '') || rawUrl,
            docId: docId,
            book_id: coreId,
            provider: providerName,
            title: dramaTitle,
            lastWatchedEp: ep,
            lastWatchedAt: Date.now(),
            watchedList: watchedList,
            watchedCount: watchedList.length,
            episodes: totalEps,
            isCompleted: isCompleted
        };

        this.indexProgressRecord(updatedRecord);

        // If this drama is bookmarked and we now know real episode count, sync it
        if (this.data.bookmarks[key] && totalEps > 0) {
            this.data.bookmarks[key].episodes = totalEps;
        }

        try {
            localStorage.setItem('reeldrama_progress', JSON.stringify(this.data.progress));
        } catch (_) {}

        this.syncProgressToBookmark(drama, updatedRecord);

        if (this.currentUser && window.FirebaseService && window.FirebaseService.isReady()) {
            const rtdb = window.FirebaseService.getRtdb();
            const db = window.FirebaseService.getDb();
            const payload = {
                key: key,
                url: rawUrl,
                title: dramaTitle,
                book_id: coreId,
                lastWatchedEp: ep,
                lastWatchedAt: Date.now(),
                watchedList: watchedList,
                watchedCount: watchedList.length,
                episodes: totalEps
            };
            if (rtdb) {
                rtdb.ref(`users/${this.currentUser.uid}/progress/${docId}`).set(payload).catch(() => {});
            } else if (db) {
                db.collection('users').doc(this.currentUser.uid).collection('progress').doc(docId).set(payload, { merge: true }).catch(() => {});
            }
        }

        updateVisibleCardProgress();
        if (AppState.selectedDrama && (AppState.mode === 'detail' || (elements.quickViewModal && elements.quickViewModal.classList.contains('active')))) {
            if (AppState.selectedDrama.episodeList && AppState.selectedDrama.episodeList.length > 0) {
                renderEpisodesList(AppState.selectedDrama.episodeList, AppState.selectedDrama.episodes);
            } else {
                updateDetailPagePlayCta(AppState.selectedDrama);
            }
        }
        if (PlayerState.currentDrama && elements.reelEpisodesSheet && elements.reelEpisodesSheet.classList.contains('active')) {
            renderEpisodesSheet(PlayerState.episodes, PlayerState.currentEpisodeNumber);
        }
    },

    recordEpisodeWatched(drama, epNum) {
        if (!drama) return;
        const key = this.getDramaKey(drama);
        if (!key) return;

        // If progress is already completed (100% watched / rewatching), do not overwrite progress
        if (this.isProgressCompleted(drama)) {
            return;
        }

        const ep = parseInt(epNum, 10) || 1;
        const currentProg = this.getDramaProgress(drama);
        let watchedList = Array.isArray(currentProg.watchedList) ? [...currentProg.watchedList] : [];

        let totalEps = (typeof drama === 'object' && drama.episodes && Number(drama.episodes) > 0)
            ? Number(drama.episodes)
            : (drama && Array.isArray(drama.episodeList) && drama.episodeList.length > 0 ? drama.episodeList.length : 0);

        if (!totalEps && typeof PlayerState !== 'undefined' && PlayerState.episodes && PlayerState.episodes.length > 0) {
            totalEps = PlayerState.episodes.length;
        }
        if (!totalEps && currentProg.episodes && Number(currentProg.episodes) > 0) {
            totalEps = Number(currentProg.episodes);
        }
        if (!totalEps) {
            const bookmark = this.findMatchingBookmark(drama);
            if (bookmark && bookmark.episodes > 0) totalEps = Number(bookmark.episodes);
        }

        // Offset-of-1 rule: episode ep is not added until ep + 1, unless it's the final episode
        let upToEp = ep - 1;
        if (totalEps > 0 && ep >= totalEps) {
            upToEp = totalEps;
        }

        if (upToEp > 0) {
            for (let i = 1; i <= upToEp; i++) {
                if (!watchedList.includes(i)) {
                    watchedList.push(i);
                }
            }
            watchedList.sort((a, b) => a - b);
        }

        const docId = this.getDramaDocId(drama);
        const rawUrl = typeof drama === 'string' ? drama : (drama.url || '');
        const dramaTitle = typeof drama === 'object' ? (drama.title || '') : '';
        const coreId = this.extractCoreId(drama);
        const providerName = typeof drama === 'object' ? (drama.provider || drama.category_name || '') : '';

        const isCompleted = (totalEps > 0 && watchedList.length >= totalEps) || Boolean(currentProg.isCompleted);

        const updatedRecord = {
            key: key,
            url: rawUrl,
            canonicalUrl: (typeof drama === 'object' ? drama.canonicalUrl : '') || rawUrl,
            docId: docId,
            book_id: coreId,
            provider: providerName,
            title: dramaTitle,
            lastWatchedEp: ep,
            lastWatchedAt: Date.now(),
            watchedList: watchedList,
            watchedCount: watchedList.length,
            episodes: totalEps,
            isCompleted: isCompleted
        };

        this.indexProgressRecord(updatedRecord);

        // If this drama is bookmarked and we now know real episode count, sync it
        if (this.data.bookmarks[key] && totalEps > 0) {
            this.data.bookmarks[key].episodes = totalEps;
        }

        try {
            localStorage.setItem('reeldrama_progress', JSON.stringify(this.data.progress));
        } catch (_) {}

        this.syncProgressToBookmark(drama, updatedRecord);

        if (this.currentUser && window.FirebaseService && window.FirebaseService.isReady()) {
            const rtdb = window.FirebaseService.getRtdb();
            const db = window.FirebaseService.getDb();
            const payload = {
                key: key,
                url: rawUrl,
                title: dramaTitle,
                book_id: coreId,
                lastWatchedEp: ep,
                lastWatchedAt: Date.now(),
                watchedList: watchedList,
                watchedCount: watchedList.length,
                episodes: totalEps
            };
            if (rtdb) {
                rtdb.ref(`users/${this.currentUser.uid}/progress/${docId}`).set(payload).catch(() => {});
            } else if (db) {
                db.collection('users').doc(this.currentUser.uid).collection('progress').doc(docId).set(payload, { merge: true }).catch(() => {});
            }
        }

        updateVisibleCardProgress();
        if (AppState.selectedDrama && (AppState.mode === 'detail' || (elements.quickViewModal && elements.quickViewModal.classList.contains('active')))) {
            if (AppState.selectedDrama.episodeList && AppState.selectedDrama.episodeList.length > 0) {
                renderEpisodesList(AppState.selectedDrama.episodeList, AppState.selectedDrama.episodes);
            } else {
                updateDetailPagePlayCta(AppState.selectedDrama);
            }
        }
        if (PlayerState.currentDrama && elements.reelEpisodesSheet && elements.reelEpisodesSheet.classList.contains('active')) {
            renderEpisodesSheet(PlayerState.episodes, PlayerState.currentEpisodeNumber);
        }
    },

    toggleEpisodeWatched(drama, epNum) {
        if (!drama) return false;
        const key = this.getDramaKey(drama);
        if (!key) return false;

        const ep = parseInt(epNum, 10) || 1;
        const currentProg = this.getDramaProgress(drama);
        let watchedList = Array.isArray(currentProg.watchedList) ? [...currentProg.watchedList] : [];
        let nowWatched = false;

        const idx = watchedList.indexOf(ep);
        if (idx >= 0) {
            watchedList.splice(idx, 1);
            nowWatched = false;
        } else {
            watchedList.push(ep);
            watchedList.sort((a, b) => a - b);
            nowWatched = true;
        }

        const docId = this.getDramaDocId(drama);
        const rawUrl = typeof drama === 'string' ? drama : (drama.url || '');
        const dramaTitle = typeof drama === 'object' ? (drama.title || '') : '';
        const coreId = this.extractCoreId(drama);
        const providerName = typeof drama === 'object' ? (drama.provider || drama.category_name || '') : '';
        const totalEps = (typeof drama === 'object' && drama.episodes) ? drama.episodes : (currentProg.episodes || 0);

        const lastEp = nowWatched ? ep : (watchedList.length > 0 ? Math.max(...watchedList) : 1);

        const isCompleted = (totalEps > 0 && watchedList.length >= totalEps);

        const updatedRecord = {
            key: key,
            url: rawUrl,
            canonicalUrl: (typeof drama === 'object' ? drama.canonicalUrl : '') || rawUrl,
            docId: docId,
            book_id: coreId,
            provider: providerName,
            title: dramaTitle,
            lastWatchedEp: lastEp,
            lastWatchedAt: Date.now(),
            watchedList: watchedList,
            watchedCount: watchedList.length,
            episodes: totalEps,
            isCompleted: isCompleted
        };

        this.indexProgressRecord(updatedRecord);

        try {
            localStorage.setItem('reeldrama_progress', JSON.stringify(this.data.progress));
        } catch (_) {}

        this.syncProgressToBookmark(drama, updatedRecord);

        if (this.currentUser && window.FirebaseService && window.FirebaseService.isReady()) {
            const rtdb = window.FirebaseService.getRtdb();
            const db = window.FirebaseService.getDb();
            const payload = {
                key: key,
                url: rawUrl,
                title: dramaTitle,
                book_id: coreId,
                lastWatchedEp: lastEp,
                lastWatchedAt: Date.now(),
                watchedList: watchedList,
                watchedCount: watchedList.length,
                episodes: totalEps
            };
            if (rtdb) {
                rtdb.ref(`users/${this.currentUser.uid}/progress/${docId}`).set(payload).catch(() => {});
            } else if (db) {
                db.collection('users').doc(this.currentUser.uid).collection('progress').doc(docId).set(payload, { merge: true }).catch(() => {});
            }
        }

        updateVisibleCardProgress();
        return nowWatched;
    },

    saveDramaEpisodes(drama, totalEpisodes) {
        if (!drama || !totalEpisodes || totalEpisodes <= 0) return;
        const key = this.getDramaKey(drama);
        if (!key) return;

        const currentProg = this.getDramaProgress(drama);
        const watchedList = Array.isArray(currentProg.watchedList) ? currentProg.watchedList : [];
        const isCompleted = (watchedList.length >= totalEpisodes) || Boolean(currentProg.isCompleted);

        // Update progress record in cache & localStorage
        if (this.data.progress[key] || watchedList.length > 0) {
            const existing = this.data.progress[key] || {
                key: key,
                url: typeof drama === 'string' ? drama : (drama.url || ''),
                canonicalUrl: (typeof drama === 'object' ? drama.canonicalUrl : '') || (drama.url || ''),
                docId: this.getDramaDocId(drama),
                book_id: this.extractCoreId(drama),
                provider: typeof drama === 'object' ? (drama.provider || drama.category_name || '') : '',
                title: typeof drama === 'object' ? (drama.title || '') : '',
                lastWatchedEp: currentProg.lastWatchedEp || 1,
                lastWatchedAt: currentProg.lastWatchedAt || Date.now(),
                watchedList: watchedList,
                watchedCount: watchedList.length
            };
            existing.episodes = Math.max(Number(existing.episodes) || 0, totalEpisodes);
            if (isCompleted) existing.isCompleted = true;
            this.indexProgressRecord(existing);
            try {
                localStorage.setItem('reeldrama_progress', JSON.stringify(this.data.progress));
            } catch (_) {}
        }

        // Sync with bookmark if saved
        const bookmark = this.findMatchingBookmark(drama);
        if (bookmark) {
            bookmark.episodes = Math.max(Number(bookmark.episodes) || 0, totalEpisodes);
            if (isCompleted) bookmark.isCompleted = true;
            const bKey = this.getDramaKey(bookmark);
            if (this.data.bookmarks[bKey]) {
                this.data.bookmarks[bKey].episodes = bookmark.episodes;
                if (isCompleted) this.data.bookmarks[bKey].isCompleted = true;
            }
            try {
                localStorage.setItem('reeldrama_bookmarks', JSON.stringify(this.data.bookmarks));
            } catch (_) {}
        }
    }
};

// Elements Cache
const elements = {
    body: document.body,
    appSplash: getEl('app-splash-screen'),
    splashStatusText: getEl('splash-status-text'),
    appAuth: getEl('app-auth-screen'),
    appMainLayout: getEl('app-main-layout'),
    authScreenGoogleBtn: getEl('auth-screen-google-btn'),
    navBrand: getEl('nav-brand'),
    navBookmarkBtn: getEl('nav-bookmark-btn'),
    navBookmarkCount: getEl('nav-bookmark-count'),
    pwaInstallBtn: getEl('pwa-install-btn'),
    pwaGuideModal: getEl('pwa-guide-modal'),
    pwaGuideContent: getEl('pwa-guide-content'),
    pwaGuideCloseBtn: getEl('pwa-guide-close-btn'),
    pwaGuideOkBtn: getEl('pwa-guide-ok-btn'),
    heroLogo: getEl('hero-logo'),
    heroSection: getEl('hero-section'),
    navSearchWrap: getEl('nav-search-wrap'),
    searchForm: getEl('search-form'),
    searchInput: getEl('search-input'),
    searchClearBtn: getEl('search-clear-btn'),
    searchHints: document.querySelectorAll('.search-hint-pill'),
    unifiedProviderBar: getEl('unified-provider-bar-wrap'),
    unifiedProviderTabs: getEl('unified-provider-tabs'),
    heroLangTabs: getEl('hero-lang-tabs'),
    
    // Desktop Minimal Sidebar Rail (Anime / Streaming Aesthetic)
    appSidebarRail: getEl('app-sidebar-rail'),
    railBrandIcon: getEl('rail-brand-icon'),
    railNavHome: getEl('rail-nav-home'),
    railNavSaved: getEl('rail-nav-saved'),
    railSavedBadge: getEl('rail-saved-badge'),
    railNavRandom: getEl('rail-nav-random'),
    railNavSettings: getEl('rail-nav-settings'),

    // Material 3 Mobile App Bottom Nav
    m3BottomNav: getEl('m3-bottom-nav'),
    m3NavExplore: getEl('m3-nav-explore'),
    m3NavSaved: getEl('m3-nav-saved'),
    m3SavedBadge: getEl('m3-saved-badge'),
    
    // Results & Controls
    sectionHeaderBlock: getEl('section-header-block'),
    sectionMainTitle: getEl('section-main-title'),
    sectionSubtitle: getEl('section-subtitle'),
    resultsBar: getEl('results-bar'),
    resultsQuery: getEl('results-query'),
    resultsCount: getEl('results-count'),
    langSelect: getEl('lang-select'),
    sortSelect: getEl('sort-select'),
    contentContainer: getEl('content-container'),
    animeGrid: getEl('anime-grid'),
    skeletonGrid: getEl('skeleton-grid'),
    emptyState: getEl('empty-state'),
    errorState: getEl('error-state'),
    errorDesc: getEl('error-desc'),
    retryBtn: getEl('retry-btn'),

    // Bookmarks Section
    bookmarksSection: getEl('bookmarks-section'),
    bookmarksGrid: getEl('bookmarks-grid'),
    bookmarksEmptyState: getEl('bookmarks-empty-state'),
    bookmarksCountBadge: getEl('bookmarks-count-badge'),
    bookmarksExploreBtn: getEl('bookmarks-explore-btn'),
    bookmarksSearchWrap: getEl('bookmarks-search-wrap'),
    bookmarksSearchInput: getEl('bookmarks-search-input'),
    bookmarksSearchClear: getEl('bookmarks-search-clear'),
    bookmarksSearchEmptyState: getEl('bookmarks-search-empty-state'),
    bookmarksSearchEmptyDesc: getEl('bookmarks-search-empty-desc'),
    bookmarksClearSearchBtn: getEl('bookmarks-clear-search-btn'),

    // Dedicated Drama Detail Page View
    detailPage: getEl('drama-detail-page'),
    detailBackBtn: getEl('detail-back-btn'),
    detailNavTitle: getEl('detail-nav-title'),
    detailShareBtn: getEl('detail-share-btn'),
    detailHeroBackdrop: getEl('detail-hero-backdrop'),
    detailPoster: getEl('detail-poster'),
    detailMainTitle: getEl('detail-main-title'),
    detailProviderPill: getEl('detail-provider-pill'),
    detailRatingVal: getEl('detail-rating-val'),
    detailEpCount: getEl('detail-ep-count'),
    detailGenresRow: getEl('detail-genres-row'),
    detailPlayCta: getEl('detail-play-cta'),
    detailPlayCtaText: getEl('detail-play-cta-text'),
    detailPlayCtaIcon: getEl('detail-play-cta-icon'),
    detailBookmarkCta: getEl('detail-bookmark-cta'),
    detailBookmarkIcon: getEl('detail-bookmark-icon'),
    detailBookmarkText: getEl('detail-bookmark-text'),
    detailProgressWrap: getEl('detail-progress-wrap'),
    detailProgressStats: getEl('detail-progress-stats'),
    detailProgressBarFill: getEl('detail-progress-bar-fill'),
    detailSynopsisText: getEl('detail-synopsis-text'),
    detailSynopsisToggle: getEl('detail-synopsis-toggle'),
    detailTabEpisodesCount: getEl('detail-tab-episodes-count'),
    detailEpisodesSearchInput: getEl('detail-episodes-search-input'),
    detailRangeSelectWrap: getEl('detail-range-select-wrap'),
    detailRangeTrigger: getEl('detail-range-trigger'),
    detailRangeTriggerText: getEl('detail-range-trigger-text'),
    detailRangeMenu: getEl('detail-range-menu'),
    detailEpisodesRangeSelect: getEl('detail-episodes-range-select'),
    detailEpisodesRanges: getEl('detail-episodes-ranges'),
    detailEpisodesLoading: getEl('detail-episodes-loading'),
    detailEpisodesGrid: getEl('detail-episodes-grid'),

    // Aliases for quickView to maintain complete backwards compatibility
    quickViewModal: getEl('drama-detail-page'),
    quickViewCloseBtn: getEl('detail-back-btn'),
    quickViewPoster: getEl('detail-poster'),
    quickViewTitle: getEl('detail-main-title'),
    quickViewMeta: getEl('detail-genres-row'),
    quickViewDesc: getEl('detail-synopsis-text'),
    quickViewDescToggle: getEl('detail-synopsis-toggle'),
    quickViewEpisodesCount: getEl('detail-ep-count'),
    quickViewProgressText: getEl('detail-progress-stats'),
    quickViewProgressBarWrap: getEl('detail-progress-wrap'),
    quickViewProgressBarFill: getEl('detail-progress-bar-fill'),
    quickViewEpisodesTabs: getEl('detail-episodes-ranges'),
    quickViewEpisodesLoading: getEl('detail-episodes-loading'),
    quickViewEpisodesGrid: getEl('detail-episodes-grid'),
    quickViewStreamBtn: getEl('detail-play-cta'),

    // TikTok-Style Immersive Reels Video Player Modal
    playerModal: getEl('player-modal'),
    reelPlayerContainer: getEl('reel-player-container'),
    reelVideoViewport: getEl('reel-video-viewport'),
    reelBackdrop: getEl('reel-backdrop'),
    playerVideoElement: getEl('player-video-element'),
    reelCenterFeedback: getEl('reel-center-feedback'),
    reelFeedbackIcon: getEl('reel-feedback-icon'),
    reelHeartBubble: getEl('reel-heart-bubble'),
    reelSwipeHint: getEl('reel-swipe-hint'),
    playerBuffering: getEl('player-buffering'),
    playerBufferingText: getEl('player-buffering-text'),
    playerErrorOverlay: getEl('player-error-overlay'),
    playerErrorText: getEl('player-error-text'),
    playerRetryStreamBtn: getEl('player-retry-stream-btn'),
    playerErrorCloseBtn: getEl('player-error-close-btn'),
    playerDramaTitle: getEl('player-drama-title'),
    playerEpIndicator: getEl('player-ep-indicator'),
    playerQualityWrap: getEl('player-quality-wrap'),
    playerQualityBtn: getEl('player-quality-btn'),
    playerQualityIndicator: getEl('player-quality-indicator'),
    playerQualityMenu: getEl('player-quality-menu'),
    playerCloseBtn: getEl('player-close-btn'),
    playerCloseBtnAlt: getEl('player-close-btn-alt'),
    playerLikeBtn: getEl('player-like-btn'),
    playerLikeIcon: getEl('player-like-icon'),
    playerLikeCount: getEl('player-like-count'),
    playerBookmarkBtn: getEl('player-bookmark-btn'),
    playerBookmarkIcon: getEl('player-bookmark-icon'),
    playerBookmarkLabel: getEl('player-bookmark-label'),
    playerDrawerBtn: getEl('player-drawer-btn'),
    playerPrevEpBtn: getEl('player-prev-ep-btn'),
    playerNextEpBtn: getEl('player-next-ep-btn'),
    playerMuteBtn: getEl('player-mute-btn'),
    playerMuteIcon: getEl('player-mute-icon'),
    playerMuteLabel: getEl('player-mute-label'),
    playerInfoTitle: getEl('player-info-title'),
    playerInfoDesc: getEl('player-info-desc'),
    playerScrubContainer: getEl('player-scrub-container'),
    playerScrubTrack: getEl('player-scrub-track'),
    playerScrubProgress: getEl('player-scrub-progress'),
    playerScrubBuffered: getEl('player-scrub-buffered'),
    playerTimeCurrent: getEl('player-time-current'),
    playerTimeTotal: getEl('player-time-total'),
    reelEpisodesSheet: getEl('reel-episodes-sheet'),
    sheetBackdrop: getEl('sheet-backdrop'),
    sheetCloseBtn: getEl('sheet-close-btn'),
    sheetEpTotal: getEl('sheet-ep-total'),
    sheetProgressText: getEl('sheet-progress-text'),
    sheetProgressBarWrap: getEl('sheet-progress-bar-wrap'),
    sheetProgressBarFill: getEl('sheet-progress-bar-fill'),
    sheetEpisodesTabs: getEl('sheet-episodes-tabs'),
    sheetRangeSelectWrap: getEl('sheet-range-select-wrap'),
    sheetRangeTrigger: getEl('sheet-range-trigger'),
    sheetRangeTriggerText: getEl('sheet-range-trigger-text'),
    sheetRangeMenu: getEl('sheet-range-menu'),
    sheetEpisodesSearchInput: getEl('sheet-episodes-search-input'),
    playerEpisodesStrip: getEl('player-episodes-strip'),

    // Proxy Settings Modal (Optional)
    proxyModal: getEl('proxy-modal'),
    openProxyBtn: getEl('btn-open-proxy'),
    proxyCloseBtn: getEl('proxy-close-btn'),
    proxySelect: getEl('proxy-select'),
    customProxyWrap: getEl('custom-proxy-wrap'),
    customProxyInput: getEl('custom-proxy-input'),
    ndSessionCookieInput: getEl('nd-session-cookie-input'),
    saveProxyBtn: getEl('save-proxy-btn'),

    // Firebase Auth & User Profile
    navAuthContainer: getEl('nav-auth-container'),
    navGoogleBtn: getEl('nav-google-btn'),
    userProfileWrap: getEl('user-profile-wrap'),
    userProfileBtn: getEl('user-profile-btn'),
    userAvatar: getEl('user-avatar'),
    userNameLabel: getEl('user-name-label'),
    userDropdownMenu: getEl('user-dropdown-menu'),
    dropdownAvatar: getEl('dropdown-avatar'),
    dropdownUserName: getEl('dropdown-user-name'),
    dropdownUserEmail: getEl('dropdown-user-email'),
    dropdownSavedCount: getEl('dropdown-saved-count'),
    dropdownSignoutBtn: getEl('dropdown-signout-btn'),
    bookmarksAuthState: getEl('bookmarks-auth-state'),
    bookmarksLoadingState: getEl('bookmarks-loading-state'),
    bookmarksLoginBtn: getEl('bookmarks-login-btn'),
    bookmarksAuthHomeBtn: getEl('bookmarks-auth-home-btn'),
    firebaseGuideModal: getEl('firebase-guide-modal'),
    firebaseGuideCloseBtn: getEl('firebase-guide-close-btn'),
    firebaseGuideOkBtn: getEl('firebase-guide-ok-btn'),

    // Toast Container
    toastContainer: getEl('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initAppSplash();
    UserDataManager.init();
    setupEventListeners();
    syncUserProfileLocation();
    setupProxySettings();
    registerServiceWorker();
    setupPwaInstall();

    // Check if URL has #mylist or ?q= / ?provider= parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    const initialProvider = urlParams.get('provider');

    if (initialProvider && ALLOWED_PROVIDERS.some(p => p.key === initialProvider.toLowerCase())) {
        AppState.activeProvider = initialProvider.toLowerCase();
        localStorage.setItem('nd_active_provider', AppState.activeProvider);
    }
    updateProviderTabsUI(AppState.activeProvider);

    const initialLang = urlParams.get('lang');
    if (initialLang && ALLOWED_LANGS.some(l => l.code === initialLang)) {
        AppState.currentLang = initialLang;
        localStorage.setItem('nd_search_lang', AppState.currentLang);
    }
    updateLangUI(AppState.currentLang);

    // Restore saved sort order preference
    const savedSort = localStorage.getItem('nd_sort_order') || 'default';
    AppState.sortOrder = savedSort;
    if (elements.sortSelect) {
        elements.sortSelect.value = savedSort;
    }

    if (window.location.hash === '#mylist' || urlParams.get('view') === 'mylist') {
        setAppMode('bookmarks');
    } else if (initialQuery && initialQuery.trim()) {
        if (elements.searchInput) {
            elements.searchInput.value = initialQuery.trim();
        }
        if (elements.searchClearBtn) {
            elements.searchClearBtn.classList.add('visible');
        }
        triggerDynamicSearch(initialQuery.trim(), AppState.activeProvider, AppState.currentLang);
    } else {
        // Initial state: automatically explore & show featured dramas for the active provider
        triggerDynamicSearch('', AppState.activeProvider, AppState.currentLang);
    }

    // Browser back/forward navigation support
    window.addEventListener('popstate', () => {
        // If Player modal is open, back gesture closes player modal smoothly without reloading page
        if (elements.playerModal && elements.playerModal.classList.contains('active')) {
            closePlayer();
            return;
        }
        // If Detail page is open, back gesture restores the previous view smoothly without reloading
        if (AppState.mode === 'detail') {
            closeDramaDetailPage();
            return;
        }

        if (window.location.hash === '#mylist') {
            setAppMode('bookmarks');
        } else {
            const currentParams = new URLSearchParams(window.location.search);
            const prov = currentParams.get('provider');
            if (prov && ALLOWED_PROVIDERS.some(p => p.key === prov.toLowerCase())) {
                AppState.activeProvider = prov.toLowerCase();
                updateProviderTabsUI(AppState.activeProvider);
            }
            const lng = currentParams.get('lang');
            if (lng && ALLOWED_LANGS.some(l => l.code === lng)) {
                AppState.currentLang = lng;
                updateLangUI(AppState.currentLang);
            }
            const q = currentParams.get('q');
            if (q && q.trim()) {
                if (elements.searchInput) elements.searchInput.value = q.trim();
                triggerDynamicSearch(q.trim(), AppState.activeProvider, AppState.currentLang);
            } else if (prov || lng) {
                triggerDynamicSearch('', AppState.activeProvider, AppState.currentLang);
            } else {
                resetToHomePage();
            }
        }
    });
});

// Event Listeners Setup
function setupEventListeners() {
    // Keep profile avatar location responsive to desktop rail vs mobile navbar
    window.addEventListener('resize', syncUserProfileLocation);

    // Brand click: Reset back to clean homepage
    if (elements.navBrand) {
        elements.navBrand.addEventListener('click', resetToHomePage);
    }
    if (elements.heroLogo) {
        elements.heroLogo.addEventListener('click', resetToHomePage);
    }

    // Provider Tab Selector Pills (Hero & Results bars)
    document.querySelectorAll('.provider-tab-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.preventDefault();
            const providerKey = pill.getAttribute('data-provider');
            if (providerKey && ALLOWED_PROVIDERS.some(p => p.key === providerKey.toLowerCase())) {
                selectProvider(providerKey.toLowerCase());
            }
        });
    });

    // Language Tab Selector Pills (Hero)
    document.querySelectorAll('.lang-tab-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = pill.getAttribute('data-lang');
            if (lang && ALLOWED_LANGS.some(l => l.code === lang)) {
                selectLanguage(lang);
            }
        });
    });

    // Language Select Dropdown (Results Bar)
    if (elements.langSelect) {
        elements.langSelect.addEventListener('change', () => {
            selectLanguage(elements.langSelect.value);
        });
    }

    // Search Form Submit
    if (elements.searchForm) {
        elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = elements.searchInput ? elements.searchInput.value.trim() : '';
            if (query) {
                triggerDynamicSearch(query, AppState.activeProvider);
            }
        });
    }

    // Clear Search Input Button
    if (elements.searchInput && elements.searchClearBtn) {
        elements.searchInput.addEventListener('input', () => {
            elements.searchClearBtn.classList.toggle('visible', elements.searchInput.value.length > 0);
        });

        elements.searchClearBtn.addEventListener('click', () => {
            elements.searchInput.value = '';
            elements.searchClearBtn.classList.remove('visible');
            elements.searchInput.focus();
        });
    }

    // Search Hint Pills
    if (elements.searchHints) {
        elements.searchHints.forEach(pill => {
            pill.addEventListener('click', () => {
                const query = pill.getAttribute('data-query');
                if (query && elements.searchInput) {
                    elements.searchInput.value = query;
                    if (elements.searchClearBtn) {
                        elements.searchClearBtn.classList.add('visible');
                    }
                    triggerDynamicSearch(query, AppState.activeProvider);
                }
            });
        });
    }

    // Sort selection change
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', () => {
            sortAndRender();
        });
    }

    // Retry Button
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', () => {
            triggerDynamicSearch(AppState.currentQuery, AppState.activeProvider, true);
        });
    }

    // Drama Detail Page Events
    if (elements.detailBackBtn) {
        elements.detailBackBtn.addEventListener('click', closeDramaDetailPage);
    }
    if (elements.detailShareBtn) {
        elements.detailShareBtn.addEventListener('click', () => {
            if (!AppState.selectedDrama) return;
            const drama = AppState.selectedDrama;
            const shareData = {
                title: drama.title || 'Short Reels Drama',
                text: `Watch ${drama.title || 'this drama'} on ShortReels!`,
                url: window.location.href
            };
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                navigator.share(shareData).catch(() => {});
            } else {
                try {
                    navigator.clipboard.writeText(window.location.href);
                    showToast('Drama link copied to clipboard!', 'success');
                } catch (_) {
                    showToast('Link: ' + window.location.href, 'info');
                }
            }
        });
    }
    if (elements.detailSynopsisToggle) {
        elements.detailSynopsisToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!elements.detailSynopsisText) return;
            const isExp = elements.detailSynopsisText.classList.toggle('expanded');
            elements.detailSynopsisToggle.textContent = isExp ? 'less' : 'more';
            elements.detailSynopsisToggle.setAttribute('aria-expanded', isExp ? 'true' : 'false');
        });
    }
    if (elements.detailSynopsisText) {
        elements.detailSynopsisText.addEventListener('click', () => {
            const toggleBtn = elements.detailSynopsisToggle || elements.quickViewDescToggle;
            if (toggleBtn && toggleBtn.style.display !== 'none') {
                const isExp = elements.detailSynopsisText.classList.toggle('expanded');
                toggleBtn.textContent = isExp ? 'less' : 'more';
                toggleBtn.setAttribute('aria-expanded', isExp ? 'true' : 'false');
            }
        });
    }
    if (elements.detailPlayCta) {
        elements.detailPlayCta.addEventListener('click', () => {
            if (!AppState.selectedDrama) return;
            const drama = AppState.selectedDrama;
            const targetEp = parseInt(elements.detailPlayCta.getAttribute('data-target-ep'), 10) || 1;
            let targetEpUrl = '';
            if (drama.episodeList && drama.episodeList.length > 0) {
                const epObj = drama.episodeList.find(e => {
                    const n = typeof e.number === 'number' ? e.number : parseInt(String(e.number || '').replace(/\D+/g, ''), 10);
                    return n === targetEp;
                });
                if (epObj && epObj.url) targetEpUrl = epObj.url;
            }
            if (!targetEpUrl) {
                targetEpUrl = getEpisodeWatchUrl(drama.url, targetEp);
            }
            playEpisode(drama, targetEp, targetEpUrl);
        });
    }
    if (elements.detailBookmarkCta) {
        elements.detailBookmarkCta.addEventListener('click', async () => {
            if (!AppState.selectedDrama) return;
            try {
                const nowSaved = await UserDataManager.toggleBookmark(AppState.selectedDrama);
                updateDetailPageBookmarkCta(AppState.selectedDrama);
                updateVisibleBookmarkButtons();
                showToast(nowSaved ? `Saved "${AppState.selectedDrama.title}" to My List` : `Removed "${AppState.selectedDrama.title}" from Saved`);
            } catch (err) {
                console.error('[Detail Bookmark Toggle Error]:', err);
                showToast('Could not sync bookmark with Firebase', 'error');
            }
        });
    }

    // Modal Events - TikTok Reels Video Player
    if (elements.playerCloseBtn) {
        elements.playerCloseBtn.addEventListener('click', closePlayer);
    }
    if (elements.playerCloseBtnAlt) {
        elements.playerCloseBtnAlt.addEventListener('click', closePlayer);
    }
    if (elements.playerErrorCloseBtn) {
        elements.playerErrorCloseBtn.addEventListener('click', closePlayer);
    }
    if (elements.playerModal) {
        elements.playerModal.addEventListener('click', (e) => {
            if (e.target === elements.playerModal) closePlayer();
        });
    }
    if (elements.playerPrevEpBtn) {
        elements.playerPrevEpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetPlayerControlsTimer();
            triggerReelSwipeTransition('down', () => {
                playPrevEpisode(true);
            });
        });
    }
    if (elements.playerNextEpBtn) {
        elements.playerNextEpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetPlayerControlsTimer();
            triggerReelSwipeTransition('up', () => {
                playNextEpisode(true);
            });
        });
    }
    if (elements.playerRetryStreamBtn) {
        elements.playerRetryStreamBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (PlayerState.currentDrama) {
                playEpisode(PlayerState.currentDrama, PlayerState.currentEpisodeNumber, PlayerState.currentEpisodeUrl, true);
            }
        });
    }
    if (elements.playerBookmarkBtn) {
        elements.playerBookmarkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!PlayerState.currentDrama) return;

            if (!UserDataManager.currentUser) {
                showToast('Please sign in with Google to save reels', 'info');
                handleGoogleSignIn();
                return;
            }

            const drama = PlayerState.currentDrama;
            const currentEp = PlayerState.currentEpisodeNumber || 1;

            // Make sure current episode position and offset-1 range are recorded first
            UserDataManager.setLastWatchedEpisode(drama, currentEp);

            try {
                const nowSaved = await UserDataManager.toggleBookmark(drama);
                updatePlayerBookmarkButton(drama);
                updateVisibleBookmarkButtons();
                updateDetailPageBookmarkCta(drama);
                showToast(nowSaved ? `Saved "${drama.title}" to My List` : `Removed "${drama.title}" from My List`);
            } catch (err) {
                console.error('[UserDataManager] Player bookmark toggle error:', err);
                showToast('Could not sync bookmark with Firebase', 'error');
            }
        });
    }
    if (elements.playerLikeBtn) {
        elements.playerLikeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLike();
        });
    }
    if (elements.playerMuteBtn) {
        elements.playerMuteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMute();
        });
    }
    if (elements.playerDrawerBtn) {
        elements.playerDrawerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEpisodesSheet();
        });
    }
    if (elements.sheetCloseBtn) {
        elements.sheetCloseBtn.addEventListener('click', closeEpisodesSheet);
    }
    if (elements.sheetBackdrop) {
        elements.sheetBackdrop.addEventListener('click', closeEpisodesSheet);
    }

    // Initialize custom TikTok scrub bar, gestures, and video listeners
    setupScrubBar();
    setupReelGestures();
    setupVideoPlayerEvents();
    setupQualitySwitcher();

    // Modal Events - Proxy Settings
    if (elements.openProxyBtn) {
        elements.openProxyBtn.addEventListener('click', () => openModal(elements.proxyModal));
    }
    if (elements.proxyCloseBtn) {
        elements.proxyCloseBtn.addEventListener('click', () => closeModal(elements.proxyModal));
    }
    if (elements.saveProxyBtn) {
        elements.saveProxyBtn.addEventListener('click', saveProxySettings);
    }
    if (elements.proxySelect) {
        elements.proxySelect.addEventListener('change', () => {
            if (elements.customProxyWrap) {
                elements.customProxyWrap.style.display = elements.proxySelect.value === 'custom' ? 'block' : 'none';
            }
        });
    }

    // My List Navigation & Actions
    if (elements.navBookmarkBtn) {
        elements.navBookmarkBtn.addEventListener('click', () => {
            if (AppState.mode === 'bookmarks') {
                resetToHomePage();
            } else {
                window.history.pushState({ page: 'mylist' }, '', '#mylist');
                setAppMode('bookmarks');
            }
        });
    }

    if (elements.bookmarksExploreBtn) {
        elements.bookmarksExploreBtn.addEventListener('click', () => {
            resetToHomePage();
            if (elements.searchInput) elements.searchInput.focus();
        });
    }

    // Google Sign-In & Profile Events
    if (elements.authScreenGoogleBtn) {
        elements.authScreenGoogleBtn.addEventListener('click', handleGoogleSignIn);
    }
    if (elements.navGoogleBtn) {
        elements.navGoogleBtn.addEventListener('click', handleGoogleSignIn);
    }
    if (elements.userProfileBtn) {
        elements.userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserProfileDropdown();
        });
    }
    if (elements.dropdownSignoutBtn) {
        elements.dropdownSignoutBtn.addEventListener('click', () => {
            closeUserProfileDropdown();
            handleSignOut();
        });
    }

    // Desktop Minimal Sidebar Rail Events
    if (elements.railBrandIcon) {
        elements.railBrandIcon.addEventListener('click', resetToHomePage);
    }
    if (elements.railNavHome) {
        elements.railNavHome.addEventListener('click', resetToHomePage);
    }
    if (elements.railNavSaved) {
        elements.railNavSaved.addEventListener('click', () => {
            if (AppState.mode === 'bookmarks') {
                resetToHomePage();
            } else {
                window.history.pushState({ page: 'mylist' }, '', '#mylist');
                setAppMode('bookmarks');
            }
        });
    }
    if (elements.railNavRandom) {
        elements.railNavRandom.addEventListener('click', () => {
            playRandomReel();
        });
    }

    // Material 3 Mobile Bottom Nav Events
    if (elements.m3NavExplore) {
        elements.m3NavExplore.addEventListener('click', () => {
            resetToHomePage();
        });
    }
    if (elements.m3NavSaved) {
        elements.m3NavSaved.addEventListener('click', () => {
            if (AppState.mode === 'bookmarks') {
                resetToHomePage();
            } else {
                window.history.pushState({ page: 'mylist' }, '', '#mylist');
                setAppMode('bookmarks');
            }
        });
    }
    if (elements.bookmarksLoginBtn) {
        elements.bookmarksLoginBtn.addEventListener('click', handleGoogleSignIn);
    }
    if (elements.bookmarksAuthHomeBtn) {
        elements.bookmarksAuthHomeBtn.addEventListener('click', resetToHomePage);
    }
    if (elements.bookmarksSearchInput) {
        elements.bookmarksSearchInput.addEventListener('input', () => {
            renderBookmarksView();
        });
    }
    if (elements.bookmarksSearchClear) {
        elements.bookmarksSearchClear.addEventListener('click', () => {
            if (elements.bookmarksSearchInput) {
                elements.bookmarksSearchInput.value = '';
                elements.bookmarksSearchInput.focus();
            }
            renderBookmarksView();
        });
    }
    if (elements.bookmarksClearSearchBtn) {
        elements.bookmarksClearSearchBtn.addEventListener('click', () => {
            if (elements.bookmarksSearchInput) {
                elements.bookmarksSearchInput.value = '';
            }
            renderBookmarksView();
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (elements.userProfileWrap && !elements.userProfileWrap.contains(e.target)) {
            closeUserProfileDropdown();
        }
        if (elements.detailRangeSelectWrap && !elements.detailRangeSelectWrap.contains(e.target)) {
            closeDetailRangeMenu();
        }
        if (elements.sheetRangeSelectWrap && !elements.sheetRangeSelectWrap.contains(e.target)) {
            closeSheetRangeMenu();
        }
    });

    // Firebase Setup Guide Modal
    if (elements.firebaseGuideCloseBtn) {
        elements.firebaseGuideCloseBtn.addEventListener('click', () => closeModal(elements.firebaseGuideModal));
    }
    if (elements.firebaseGuideOkBtn) {
        elements.firebaseGuideOkBtn.addEventListener('click', () => closeModal(elements.firebaseGuideModal));
    }
    if (elements.firebaseGuideModal) {
        elements.firebaseGuideModal.addEventListener('click', (e) => {
            if (e.target === elements.firebaseGuideModal) closeModal(elements.firebaseGuideModal);
        });
    }

    // Modal Events - PWA Guide Modal (Zen, Firefox, Safari)
    if (elements.pwaGuideCloseBtn) {
        elements.pwaGuideCloseBtn.addEventListener('click', () => closeModal(elements.pwaGuideModal));
    }
    if (elements.pwaGuideOkBtn) {
        elements.pwaGuideOkBtn.addEventListener('click', () => closeModal(elements.pwaGuideModal));
    }
    if (elements.pwaGuideModal) {
        elements.pwaGuideModal.addEventListener('click', (e) => {
            if (e.target === elements.pwaGuideModal) closeModal(elements.pwaGuideModal);
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== elements.searchInput) {
            e.preventDefault();
            if (elements.searchInput) elements.searchInput.focus();
        } else if (e.key === 'Escape') {
            closeDetailRangeMenu();
            closeSheetRangeMenu();
            closePlayer();
            if (AppState.mode === 'detail') {
                closeDramaDetailPage();
            }
            closeModal(elements.proxyModal);
            closeModal(elements.pwaGuideModal);
            closeModal(elements.firebaseGuideModal);
            closeUserProfileDropdown();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
            e.preventDefault();
        }
    });

    // Initialize native app zoom prevention (pinch, gesture, double-tap)
    setupZoomPrevention();
}

/**
 * Lock zoom scale to 1.0 (prevent pinch-to-zoom, Ctrl+Wheel zoom, and double-tap zoom)
 * Keeps the PWA at a constant native app size across all devices
 */
function setupZoomPrevention() {
    // Prevent iOS Safari gesture zoom (pinch/spread)
    const preventGesture = (e) => e.preventDefault();
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });

    // Prevent Ctrl + Mousewheel / Ctrl + Trackpad zoom
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // Prevent double-tap to zoom on mobile touchscreens (except inside input/textarea fields)
    let lastTouchTime = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchTime <= 300) {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : '';
            if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                e.preventDefault();
            }
        }
        lastTouchTime = now;
    }, { passive: false });
}

/**
 * Switch View Mode: 'home' | 'results' | 'bookmarks'
 */
function setAppMode(mode) {
    if (mode !== 'detail') {
        AppState.lastMainMode = mode;
    }
    AppState.mode = mode;
    if (elements.body) {
        elements.body.className = `app-mode-${mode}`;
    }
    if (mode === 'home') {
        hideAllResults();
        if (elements.navSearchWrap) elements.navSearchWrap.style.display = '';
        if (elements.detailPage) elements.detailPage.style.display = 'none';
        if (elements.heroSection) elements.heroSection.style.display = 'flex';
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'flex';
        if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
        if (elements.contentContainer) elements.contentContainer.style.display = 'block';
        if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'none';
        if (elements.navBookmarkBtn) elements.navBookmarkBtn.classList.remove('active');
        if (elements.m3NavExplore) elements.m3NavExplore.classList.add('active');
        if (elements.m3NavSaved) elements.m3NavSaved.classList.remove('active');
        if (elements.railNavHome) elements.railNavHome.classList.add('active');
        if (elements.railNavSaved) elements.railNavSaved.classList.remove('active');
    } else if (mode === 'bookmarks') {
        hideAllResults();
        if (elements.navSearchWrap) elements.navSearchWrap.style.display = 'none';
        if (elements.detailPage) elements.detailPage.style.display = 'none';
        if (elements.heroSection) elements.heroSection.style.display = 'none';
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'none';
        if (elements.resultsBar) elements.resultsBar.style.display = 'none';
        if (elements.contentContainer) elements.contentContainer.style.display = 'none';
        if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'block';
        if (elements.navBookmarkBtn) elements.navBookmarkBtn.classList.add('active');
        if (elements.m3NavExplore) elements.m3NavExplore.classList.remove('active');
        if (elements.m3NavSaved) elements.m3NavSaved.classList.add('active');
        if (elements.railNavHome) elements.railNavHome.classList.remove('active');
        if (elements.railNavSaved) elements.railNavSaved.classList.add('active');
        renderBookmarksView();
    } else if (mode === 'results') {
        if (elements.navSearchWrap) elements.navSearchWrap.style.display = '';
        if (elements.detailPage) elements.detailPage.style.display = 'none';
        if (elements.heroSection) elements.heroSection.style.display = 'flex';
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'flex';
        if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
        if (elements.contentContainer) elements.contentContainer.style.display = 'block';
        if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'none';
        if (elements.navBookmarkBtn) elements.navBookmarkBtn.classList.remove('active');
        if (elements.m3NavExplore) elements.m3NavExplore.classList.add('active');
        if (elements.m3NavSaved) elements.m3NavSaved.classList.remove('active');
        if (elements.railNavHome) elements.railNavHome.classList.add('active');
        if (elements.railNavSaved) elements.railNavSaved.classList.remove('active');
    } else if (mode === 'detail') {
        if (elements.navSearchWrap) elements.navSearchWrap.style.display = 'none';
        if (elements.heroSection) elements.heroSection.style.display = 'none';
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'none';
        if (elements.resultsBar) elements.resultsBar.style.display = 'none';
        if (elements.contentContainer) elements.contentContainer.style.display = 'none';
        if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'none';
        if (elements.detailPage) elements.detailPage.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
}

/**
 * Render Bookmarks / Watch Later View ("My List")
 */
function renderBookmarksView() {
    if (!elements.bookmarksGrid) return;

    // 1. If Firebase auth is still resolving on initial page load / refresh, show loading spinner (prevent flicker)
    if (!UserDataManager.isAuthResolved) {
        elements.bookmarksGrid.style.display = 'none';
        if (elements.bookmarksEmptyState) elements.bookmarksEmptyState.style.display = 'none';
        if (elements.bookmarksAuthState) elements.bookmarksAuthState.style.display = 'none';
        if (elements.bookmarksSearchEmptyState) elements.bookmarksSearchEmptyState.style.display = 'none';
        if (elements.bookmarksSearchWrap) elements.bookmarksSearchWrap.style.display = 'none';
        if (elements.bookmarksLoadingState) elements.bookmarksLoadingState.style.display = 'block';
        if (elements.bookmarksCountBadge) elements.bookmarksCountBadge.textContent = '...';
        return;
    }

    if (elements.bookmarksLoadingState) elements.bookmarksLoadingState.style.display = 'none';

    // 2. Auth has resolved. If user is truly NOT signed in, display Google sign-in message
    if (!UserDataManager.currentUser) {
        elements.bookmarksGrid.style.display = 'none';
        if (elements.bookmarksEmptyState) elements.bookmarksEmptyState.style.display = 'none';
        if (elements.bookmarksAuthState) elements.bookmarksAuthState.style.display = 'block';
        if (elements.bookmarksSearchEmptyState) elements.bookmarksSearchEmptyState.style.display = 'none';
        if (elements.bookmarksSearchWrap) elements.bookmarksSearchWrap.style.display = 'none';
        if (elements.bookmarksCountBadge) elements.bookmarksCountBadge.textContent = 'Sign in';
        return;
    }

    if (elements.bookmarksAuthState) elements.bookmarksAuthState.style.display = 'none';

    const allBookmarks = UserDataManager.getBookmarksList().filter(item => {
        const u = item && item.url ? item.url.trim() : '';
        const p = item && item.poster ? item.poster.trim() : '';
        return !/^file:/i.test(u) && !u.includes('file:///') && !/^file:/i.test(p) && !p.includes('file:///');
    });

    if (elements.bookmarksCountBadge) {
        elements.bookmarksCountBadge.textContent = `${allBookmarks.length} ${allBookmarks.length === 1 ? 'reel' : 'reels'}`;
    }

    // 3. User has zero saved reels total
    if (allBookmarks.length === 0) {
        elements.bookmarksGrid.style.display = 'none';
        if (elements.bookmarksEmptyState) elements.bookmarksEmptyState.style.display = 'block';
        if (elements.bookmarksSearchEmptyState) elements.bookmarksSearchEmptyState.style.display = 'none';
        if (elements.bookmarksSearchWrap) elements.bookmarksSearchWrap.style.display = 'none';
        return;
    }

    // User has saved reels: reveal search bar and hide generic empty state
    if (elements.bookmarksSearchWrap) elements.bookmarksSearchWrap.style.display = 'block';
    if (elements.bookmarksEmptyState) elements.bookmarksEmptyState.style.display = 'none';

    // 4. Instant automatic search filtering as the user types
    const query = (elements.bookmarksSearchInput ? elements.bookmarksSearchInput.value : '').trim().toLowerCase();
    
    // Toggle search clear button
    if (elements.bookmarksSearchClear) {
        elements.bookmarksSearchClear.style.display = query ? 'flex' : 'none';
    }

    let filteredBookmarks = allBookmarks;
    if (query) {
        filteredBookmarks = allBookmarks.filter(item => {
            const title = (item.title || '').toLowerCase();
            const provider = (item.provider || getItemProviderName(item) || '').toLowerCase();
            const tags = (item.tags || []).join(' ').toLowerCase();
            return title.includes(query) || provider.includes(query) || tags.includes(query);
        });
    }

    // If query returned no results, show search-specific empty state
    if (filteredBookmarks.length === 0 && query) {
        elements.bookmarksGrid.style.display = 'none';
        if (elements.bookmarksSearchEmptyState) {
            elements.bookmarksSearchEmptyState.style.display = 'block';
            if (elements.bookmarksSearchEmptyDesc) {
                elements.bookmarksSearchEmptyDesc.textContent = `No saved reels match "${query}". Try another title or provider.`;
            }
        }
        return;
    }

    if (elements.bookmarksSearchEmptyState) elements.bookmarksSearchEmptyState.style.display = 'none';
    elements.bookmarksGrid.style.display = 'grid';

    elements.bookmarksGrid.innerHTML = filteredBookmarks.map((item, index) => createAnimeCardHtml(item, index, true)).join('');

    // Attach card click handlers for bookmarks view
    attachCardListeners(elements.bookmarksGrid, filteredBookmarks, true);
}

/**
 * Generate Default Avatar with User Initial
 */
function getDefaultAvatar(name) {
    const initial = (name ? name.trim().charAt(0) : 'U').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#7928ca"/>
        <text x="50" y="62" font-size="46" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${initial}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

let splashDismissed = false;
const splashStartTime = performance.now();

/**
 * Dismiss the app splash screen with a cinematic fade-out on fresh open,
 * or immediately without delay on page refresh.
 */
function dismissAppSplash(onDismissed) {
    if (splashDismissed) {
        if (typeof onDismissed === 'function') onDismissed();
        return;
    }
    splashDismissed = true;
    sessionStorage.setItem('reeldrama_session_active', '1');
    document.documentElement.classList.add('no-splash');

    const splash = elements.appSplash || document.getElementById('app-splash-screen');
    if (!splash) {
        if (typeof onDismissed === 'function') onDismissed();
        return;
    }

    const isRefreshOrReload = document.documentElement.classList.contains('is-refresh') ||
                              document.documentElement.classList.contains('no-splash') ||
                              splash.offsetParent === null;

    if (isRefreshOrReload) {
        splash.style.display = 'none';
        if (typeof onDismissed === 'function') onDismissed();
        return;
    }

    // On fresh app launch, provide a smooth minimum duration (~700ms) for visual polish
    const elapsed = performance.now() - splashStartTime;
    const delay = Math.max(0, 700 - elapsed);

    setTimeout(() => {
        splash.classList.add('splash-fade-out');
        setTimeout(() => {
            splash.style.display = 'none';
            if (typeof onDismissed === 'function') onDismissed();
        }, 420);
    }, delay);
}

/**
 * Initialize splash screen state checking for refresh vs cold launch
 */
function initAppSplash() {
    let isReload = false;
    try {
        if (window.performance) {
            const nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
            if (nav && nav.type === 'reload') isReload = true;
            else if (performance.navigation && performance.navigation.type === 1) isReload = true;
        }
    } catch (_) {}

    if (sessionStorage.getItem('reeldrama_session_active') || isReload) {
        splashDismissed = true;
        document.documentElement.classList.add('no-splash');
        if (elements.appSplash) elements.appSplash.style.display = 'none';
        return;
    }

    // Safety fallback: if Firebase network takes unusually long on fresh open, dismiss after 2.8s
    setTimeout(() => {
        if (!splashDismissed) {
            const statusEl = elements.splashStatusText || document.getElementById('splash-status-text');
            if (statusEl) statusEl.textContent = 'Connecting...';
            setTimeout(() => {
                dismissAppSplash();
            }, 500);
        }
    }, 2800);
}

/**
 * Handle Firebase Authentication State Changes
 */
function handleAuthStateChange(user) {
    if (user) {
        console.log('[Auth] User signed in:', user.displayName, user.email);
        localStorage.setItem('reeldrama_auth_user', '1');

        dismissAppSplash(() => {
            if (elements.appAuth) elements.appAuth.style.display = 'none';
            if (elements.appMainLayout) elements.appMainLayout.style.display = 'block';
        });

        if (elements.navGoogleBtn) elements.navGoogleBtn.style.display = 'none';
        if (elements.userProfileWrap) elements.userProfileWrap.style.display = 'flex';
        syncUserProfileLocation();

        const avatarUrl = user.photoURL || getDefaultAvatar(user.displayName);
        const firstName = user.displayName ? user.displayName.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'User');

        if (elements.userAvatar) elements.userAvatar.src = avatarUrl;
        if (elements.userNameLabel) elements.userNameLabel.textContent = firstName;
        if (elements.dropdownAvatar) elements.dropdownAvatar.src = avatarUrl;
        if (elements.dropdownUserName) elements.dropdownUserName.textContent = user.displayName || firstName;
        if (elements.dropdownUserEmail) elements.dropdownUserEmail.textContent = user.email || '';

        // Mobile bottom nav profile icon
        if (elements.m3NavAvatar) {
            elements.m3NavAvatar.src = avatarUrl;
            elements.m3NavAvatar.style.display = 'block';
        }
        if (elements.m3NavAvatarIcon) {
            elements.m3NavAvatarIcon.style.display = 'none';
        }

        UserDataManager.onUserSignedIn(user);
        if (AppState.mode !== 'bookmarks') {
            if (AppState.results && AppState.results.length > 0) {
                renderAnimeCards(AppState.results, AppState.currentQuery || '', getProviderLabel(AppState.activeProvider));
            } else {
                triggerDynamicSearch(AppState.currentQuery || '', AppState.activeProvider, AppState.currentLang);
            }
        }
    } else {
        console.log('[Auth] User is signed out.');
        localStorage.removeItem('reeldrama_auth_user');
        sessionStorage.removeItem('reeldrama_session_active');
        document.documentElement.classList.remove('no-splash');

        dismissAppSplash(() => {
            if (elements.appMainLayout) elements.appMainLayout.style.display = 'none';
            if (elements.appAuth) elements.appAuth.style.display = 'flex';
        });

        if (elements.navGoogleBtn) elements.navGoogleBtn.style.display = 'inline-flex';
        if (elements.userProfileWrap) {
            elements.userProfileWrap.style.display = 'none';
            elements.userProfileWrap.classList.remove('open');
        }

        if (elements.m3NavAvatar) {
            elements.m3NavAvatar.style.display = 'none';
        }
        if (elements.m3NavAvatarIcon) {
            elements.m3NavAvatarIcon.style.display = 'block';
        }

        UserDataManager.onUserSignedOut();
    }
}

/**
 * Synchronize User Profile Avatar location between desktop (sidebar rail bottom) and mobile (navbar)
 */
function syncUserProfileLocation() {
    const isDesktop = window.innerWidth > 768;
    const rail = elements.appSidebarRail || document.getElementById('app-sidebar-rail');
    const navActions = document.querySelector('.nav-actions');
    const profileWrap = elements.userProfileWrap || document.getElementById('user-profile-wrap');

    if (!profileWrap || !rail || !navActions) return;

    if (isDesktop) {
        if (profileWrap.parentElement !== rail) {
            rail.appendChild(profileWrap);
        }
    } else {
        if (profileWrap.parentElement !== navActions) {
            navActions.appendChild(profileWrap);
        }
    }
}

/**
 * Toggle User Profile Menu Dropdown
 */
function toggleUserProfileDropdown() {
    if (!elements.userProfileWrap) return;
    const isOpen = elements.userProfileWrap.classList.toggle('open');
    if (elements.userProfileBtn) {
        elements.userProfileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}

/**
 * Close User Profile Menu Dropdown
 */
function closeUserProfileDropdown() {
    if (!elements.userProfileWrap) return;
    elements.userProfileWrap.classList.remove('open');
    if (elements.userProfileBtn) {
        elements.userProfileBtn.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Close Drama Detail Range Dropdown Menu
 */
function closeDetailRangeMenu() {
    if (elements.detailRangeMenu) elements.detailRangeMenu.style.display = 'none';
    if (elements.detailRangeTrigger) {
        elements.detailRangeTrigger.classList.remove('open');
        elements.detailRangeTrigger.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Trigger Google Sign In Popup
 */
async function handleGoogleSignIn() {
    if (!window.FirebaseService || !window.FirebaseService.isConfigured()) {
        openModal(elements.firebaseGuideModal);
        return;
    }

    try {
        showToast('Connecting with Google...', 'info');
        const user = await window.FirebaseService.signInWithGoogle();
        if (user) {
            showToast(`Welcome, ${user.displayName || user.email}!`);
        }
    } catch (err) {
        if (err.message === 'CONFIG_MISSING') {
            openModal(elements.firebaseGuideModal);
        } else if (err.code === 'auth/unauthorized-domain') {
            showToast('This domain is not authorized in your Firebase Console', 'error');
            console.error('[Firebase Auth] Add this domain to Firebase Console > Authentication > Settings > Authorized domains.');
        } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            showToast(err.message || 'Google Sign-In failed', 'error');
        }
    }
}

/**
 * Sign Out User
 */
async function handleSignOut() {
    try {
        if (window.FirebaseService) {
            await window.FirebaseService.signOut();
        }
        closeUserProfileDropdown();
        showToast('Signed out successfully');
    } catch (err) {
        showToast('Failed to sign out', 'error');
    }
}

/**
 * Update bookmark button status on all visible cards
 */
function updateVisibleBookmarkButtons() {
    const updateContainer = (container) => {
        if (!container) return;
        const cards = container.querySelectorAll('.anime-card');
        cards.forEach(card => {
            const btn = card.querySelector('.card-bookmark-btn');
            if (!btn) return;
            const itemUrl = card.getAttribute('data-url');
            const itemTitle = card.getAttribute('data-title') || '';
            const itemKey = card.getAttribute('data-key') || '';
            const itemDocId = card.getAttribute('data-doc-id') || '';
            const itemCoreId = card.getAttribute('data-core-id') || '';
            const itemCanonicalUrl = card.getAttribute('data-canonical-url') || '';
            const isSaved = UserDataManager.isBookmarked({
                key: itemKey,
                docId: itemDocId,
                book_id: itemCoreId,
                id: itemCoreId,
                url: itemUrl,
                canonicalUrl: itemCanonicalUrl,
                title: itemTitle
            });
            btn.classList.toggle('is-saved', isSaved);
            const iconEl = btn.querySelector('.bookmark-icon');
            const textEl = btn.querySelector('.bookmark-text');
            if (iconEl) iconEl.innerHTML = isSaved ? ICON_BOOKMARK_FILLED_SVG : ICON_BOOKMARK_OUTLINE_SVG;
            if (textEl) textEl.textContent = isSaved ? 'Saved' : 'Save';
            btn.title = isSaved ? 'Remove from My List' : 'Add to My List';
            btn.setAttribute('aria-label', isSaved ? 'Remove from My List' : 'Add to My List');
        });
    };
    updateContainer(elements.animeGrid);
    updateContainer(elements.bookmarksGrid);

    if (typeof updatePlayerBookmarkButton === 'function' && typeof PlayerState !== 'undefined' && PlayerState.currentDrama) {
        updatePlayerBookmarkButton(PlayerState.currentDrama);
    }
}

/**
 * Update watch progress bars on all visible cards
 */
function updateVisibleCardProgress() {
    const updateContainer = (container) => {
        if (!container) return;
        const cards = container.querySelectorAll('.anime-card');
        cards.forEach(card => {
            const itemUrl = card.getAttribute('data-url');
            const itemTitle = card.getAttribute('data-title') || '';
            const itemKey = card.getAttribute('data-key') || '';
            const itemDocId = card.getAttribute('data-doc-id') || '';
            const itemCoreId = card.getAttribute('data-core-id') || '';
            const itemProvider = card.getAttribute('data-provider') || '';
            const itemCanonicalUrl = card.getAttribute('data-canonical-url') || '';
            if (!itemUrl && !itemTitle && !itemKey && !itemCoreId) return;

            const prog = UserDataManager.getDramaProgress({
                key: itemKey,
                docId: itemDocId,
                book_id: itemCoreId,
                id: itemCoreId,
                url: itemUrl,
                canonicalUrl: itemCanonicalUrl,
                title: itemTitle,
                provider: itemProvider
            });

            // Exact watched count matches details view
            const watchedList = Array.isArray(prog.watchedList) ? prog.watchedList : [];
            const watchedCount = watchedList.length > 0
                ? watchedList.length
                : (prog.lastWatchedEp && prog.lastWatchedEp > 1 ? prog.lastWatchedEp : 0);

            const cardEpAttr = card.getAttribute('data-episodes');
            let cardEpCount = parseInt(cardEpAttr, 10) || 0;
            if ((!cardEpCount || cardEpCount < watchedCount) && prog.episodes && prog.episodes > 0) {
                cardEpCount = prog.episodes;
                card.setAttribute('data-episodes', cardEpCount);
            }

            const posterWrap = card.querySelector('.card-poster-wrap');
            let barWrap = card.querySelector('.card-progress-bar-wrap');
            const watchedBadge = posterWrap?.querySelector('.card-badge-watched');
            if (watchedBadge) {
                watchedBadge.remove();
            }

            if (watchedCount > 0) {
                // Progress bar: percentage of total (or 100% if total unknown)
                const totalForPct = cardEpCount > 0 ? Math.max(cardEpCount, watchedCount) : watchedCount;
                const progressPct = Math.min(100, Math.round((watchedCount / totalForPct) * 100));

                if (!barWrap && posterWrap) {
                    barWrap = document.createElement('div');
                    barWrap.className = 'card-progress-bar-wrap';
                    barWrap.innerHTML = '<div class="card-progress-bar-fill"></div>';
                    posterWrap.appendChild(barWrap);
                }
                const barFill = barWrap?.querySelector('.card-progress-bar-fill');
                if (barFill) barFill.style.width = `${progressPct}%`;
                if (barWrap) barWrap.style.display = 'block';
            } else {
                if (barWrap) barWrap.style.display = 'none';
            }
        });
    };
    updateContainer(elements.animeGrid);
    updateContainer(elements.bookmarksGrid);
}

/**
 * Update UI highlighting for provider tabs
 */
function updateProviderTabsUI(activeKey) {
    const key = (activeKey || AppState.activeProvider || 'dramabox').toLowerCase();
    document.querySelectorAll('.provider-tab-pill').forEach(pill => {
        const pKey = pill.getAttribute('data-provider');
        const isActive = pKey === key;
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}

/**
 * Handle user switching provider
 */
function selectProvider(providerKey) {
    if (!providerKey) return;
    const cleanKey = providerKey.toLowerCase();
    AppState.activeProvider = cleanKey;
    localStorage.setItem('nd_active_provider', cleanKey);
    updateProviderTabsUI(cleanKey);

    const query = elements.searchInput ? elements.searchInput.value.trim() : (AppState.currentQuery || '');
    triggerDynamicSearch(query, cleanKey, AppState.currentLang);
}

/**
 * Update UI highlighting for language pills and select
 */
function updateLangUI(activeLang) {
    const lang = (activeLang || AppState.currentLang || 'en-US');
    if (elements.langSelect) {
        elements.langSelect.value = lang;
    }
    document.querySelectorAll('.lang-tab-pill').forEach(pill => {
        const pLang = pill.getAttribute('data-lang');
        const isActive = pLang === lang;
        pill.classList.toggle('active', isActive);
        pill.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
}

/**
 * Handle user switching language
 */
function selectLanguage(langCode) {
    if (!langCode) return;
    const validLang = ALLOWED_LANGS.some(l => l.code === langCode) ? langCode : 'en-US';
    AppState.currentLang = validLang;
    localStorage.setItem('nd_search_lang', validLang);
    updateLangUI(validLang);

    const query = elements.searchInput ? elements.searchInput.value.trim() : (AppState.currentQuery || '');
    triggerDynamicSearch(query, AppState.activeProvider, validLang);
}

/**
 * Reset application to clean home view
 */
function resetToHomePage() {
    if (elements.searchInput) {
        elements.searchInput.value = '';
    }
    if (elements.searchClearBtn) {
        elements.searchClearBtn.classList.remove('visible');
    }
    AppState.currentQuery = '';
    window.history.pushState({}, '', window.location.pathname);
    triggerDynamicSearch('', AppState.activeProvider, AppState.currentLang);
}

/**
 * Pick and preview a random drama reel from currently loaded results
 */
function playRandomReel() {
    const pool = (AppState.results && AppState.results.length > 0) ? AppState.results : [];

    if (pool.length > 0) {
        // Filter out current drama if possible so it always picks something different on consecutive clicks
        const currentUrl = AppState.selectedDrama?.url || PlayerState.currentDrama?.url;
        const candidatePool = pool.filter(item => !currentUrl || item.url !== currentUrl);
        const activeList = candidatePool.length > 0 ? candidatePool : pool;
        const randItem = activeList[Math.floor(Math.random() * activeList.length)];

        // Close player if currently open so user can see the new drama details
        if (elements.playerModal && elements.playerModal.classList.contains('active')) {
            closePlayer();
        }

        // Smoothly scroll to card in grid if visible
        try {
            const card = document.querySelector(`.anime-card[data-url="${CSS.escape(randItem.url)}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (_) {}

        showToast(`🎲 Shuffled: ${randItem.title}`, 'info');
        openQuickView(randItem);
    } else {
        // Pool is empty, pick a random keyword from popular drama themes instead of static 'love'
        const randomKeywords = ['billionaire', 'ceo', 'secret', 'revenge', 'marriage', 'king', 'vampire', 'wolf', 'love', 'doctor', 'destiny'];
        const randomKeyword = randomKeywords[Math.floor(Math.random() * randomKeywords.length)];
        showToast(`🎲 Discovering random drama: "${randomKeyword}"`, 'info');
        triggerDynamicSearch(randomKeyword, AppState.activeProvider, AppState.currentLang);
    }
}

/**
 * Parse JSON data returned by /home/providers/sections
 */
function parseProviderSectionsResponse(data, fallbackBaseUrl = 'https://narto-drama.com', query = '') {
    if (!data || typeof data !== 'object') return [];
    const items = [];
    const seenUrls = new Set();
    const activeProvider = data.active_provider || AppState.activeProvider || 'dramabox';
    const activeLang = AppState.currentLang || 'en-US';
    const cleanQuery = (query || '').trim().toLowerCase();

    let sections = Array.isArray(data.sections) ? data.sections : [];

    // CRITICAL: When a search query is provided, check if the response actually contains search results!
    if (cleanQuery) {
        // If search_mode is explicitly false or login_required is true, this endpoint did NOT execute the search
        // It merely returned generic browse sections (home, trending, popular) which are NOT search results!
        if (data.search_mode === false || data.login_required) {
            return []; // Signal empty so fetchProviderSections falls back to real search results
        }
        // When searching, ONLY extract items from the 'search' section tab
        const searchSection = sections.find(s => s.tab_key === 'search');
        if (!searchSection || !Array.isArray(searchSection.items) || searchSection.items.length === 0) {
            return []; // No search section or empty items
        }
        sections = [searchSection];
    }

    sections.forEach(section => {
        const sectionItems = Array.isArray(section.items) ? section.items : [];
        sectionItems.forEach(rawItem => {
            if (!rawItem) return;
            const title = String(rawItem.title || 'Untitled Drama').trim();
            let rawUrl = rawItem.url || rawItem.watch_url || '';
            if (rawUrl && rawUrl.startsWith('/')) {
                rawUrl = `${fallbackBaseUrl}${rawUrl}`;
            }
            if (!rawUrl && rawItem.book_id) {
                const prov = rawItem.category_name ? rawItem.category_name.toLowerCase().replace(/\s+/g, '') : activeProvider;
                rawUrl = `${fallbackBaseUrl}/search/import?provider=${encodeURIComponent(prov)}&book_id=${encodeURIComponent(rawItem.book_id)}&title=${encodeURIComponent(title)}&lang=${encodeURIComponent(activeLang)}&target_lang=${encodeURIComponent(activeLang)}`;
            }
            if (!rawUrl) return;

            const dedupeKey = rawUrl.toLowerCase();
            if (seenUrls.has(dedupeKey)) return;
            seenUrls.add(dedupeKey);

            let poster = formatPosterUrl(rawItem.poster_url || rawItem.poster || '');

            const tags = Array.isArray(rawItem.tag_names) && rawItem.tag_names.length > 0
                ? rawItem.tag_names
                : (Array.isArray(rawItem.tags) && rawItem.tags.length > 0 
                    ? rawItem.tags 
                    : (rawItem.category_name ? [rawItem.category_name] : []));

            items.push({
                id: rawItem.id || rawItem.book_id || (rawItem.id ? String(rawItem.id) : ''),
                title: title,
                poster: poster,
                url: rawUrl,
                description: rawItem.description || '',
                tags: tags,
                category_name: rawItem.category_name || getProviderLabel(activeProvider),
                episodes: rawItem.episodes || 0,
                episodeList: rawItem.episodeList || []
            });
        });
    });

    return items;
}

/**
 * Fetch fast JSON with sequential proxy waterfall
 */
async function fetchFastJson(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string' || /^file:\/\//i.test(targetUrl) || /^file:/i.test(targetUrl) || targetUrl.includes('file:///')) {
        throw new Error('Invalid URL or disallowed file protocol.');
    }

    const DEFAULT_ND_SESSION_COOKIE = 'laravel-session=eyJpdiI6IkV4VjZWK2dnbHdCQmFMV2duU2IwOGc9PSIsInZhbHVlIjoiZVBpRHVOaktyNDlDYzM2Y1BHcVBRZzVSOWIwZkJpWUhMUm5SYzc1amllZkpPM2RsRFNxUURQaHFJdEMycko1c2RqajBNNTEvaUZVdzFUOHkyUEs0RXlUS2RqcnVzdTkydm1ZNmlrL3BjSThqL3kyUlYzNWNJOWNVTUp3alFLa3kiLCJtYWMiOiI5MmUzOWQ1YzNiZTI3NDE3MjA1ZDUwMzYxNDRkNDViZGRiNjdlZTk2MWZmZGQ0MjI2MGVkZTE1MzM2ZTlhZTFmIiwidGFnIjoiIn0%3D';
    const savedCookie = localStorage.getItem('nd_session_cookie') || DEFAULT_ND_SESSION_COOKIE;
    const isWorkerEnabled = Boolean(CF_WORKER_URL && AppState.proxyMethod !== 'direct');

    // 1. Primary Route: Cloudflare Worker proxy (eliminates CORS and forwards session cookie)
    if (isWorkerEnabled) {
        try {
            const proxyBase = CF_WORKER_URL.replace(/\/+$/, '');
            const proxyUrl = `${proxyBase}/?url=${encodeURIComponent(targetUrl)}`;
            const proxyHeaders = {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            };
            if (savedCookie) {
                proxyHeaders['X-ND-Cookie'] = savedCookie;
            }
            const res = await fetchWithTimeout(proxyUrl, {
                mode: 'cors',
                headers: proxyHeaders,
                timeout: 15000
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (workerErr) {
            console.warn('[Worker Proxy Error]:', workerErr.message);
        }
    }

    // 2. Direct fetch fallback (used if proxyMethod === 'direct' or worker is unreachable)
    try {
        const directHeaders = {
            'Accept': 'application/json, text/plain, */*'
        };
        const res = await fetchWithTimeout(targetUrl, {
            mode: 'cors',
            credentials: 'include',
            headers: directHeaders,
            timeout: 8000
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (directErr) {
        console.warn('[Direct Fetch Error]:', directErr.message);
    }

    // 3. Fallback to AllOrigins / CodeTabs if configured
    if (AppState.proxyMethod === 'allorigins' || AppState.proxyMethod === 'auto') {
        try {
            const res = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
                mode: 'cors',
                timeout: 10000
            });
            if (res.ok) return await res.json();
        } catch (_) {}
    }

    throw new Error('Failed to fetch from endpoint (CORS or network error).');
}

/**
 * Fetch provider sections from https://narto-drama.com/home/providers/sections
 * With automatic fallback to https://narto-drama.com/search?q=... when needed
 */
async function fetchProviderSections(providerKey, query = '', lang = null) {
    const cleanQuery = (query || '').trim();
    const cleanProvider = (providerKey || AppState.activeProvider || 'dramabox').toLowerCase();
    const cleanLang = (lang || AppState.currentLang || 'en-US');

    let items = [];

    if (cleanQuery) {
        // Search exclusively on the active provider's endpoint (no global search fallback)
        try {
            const queryPart = `&q=${encodeURIComponent(cleanQuery)}`;
            const targetUrl = `https://narto-drama.com/home/providers/sections?provider=${encodeURIComponent(cleanProvider)}&lang=${encodeURIComponent(cleanLang)}&target_lang=${encodeURIComponent(cleanLang)}${queryPart}`;
            const data = await fetchFastJson(targetUrl);
            items = parseProviderSectionsResponse(data, 'https://narto-drama.com', cleanQuery);

            if (data && data.login_required && items.length === 0) {
                const hasCookie = Boolean(localStorage.getItem('nd_session_cookie'));
                if (!hasCookie) {
                    showToast('Narto Drama requires a login session to search external providers. Add your cookie in Settings ⚙️');
                }
            }
        } catch (_) {
            items = [];
        }
    } else {
        // Browse mode: fetch provider sections without query
        const targetUrl = `https://narto-drama.com/home/providers/sections?provider=${encodeURIComponent(cleanProvider)}&lang=${encodeURIComponent(cleanLang)}&target_lang=${encodeURIComponent(cleanLang)}`;
        const data = await fetchFastJson(targetUrl);
        items = parseProviderSectionsResponse(data, 'https://narto-drama.com', '');
    }

    return items;
}

/**
 * Trigger dynamic search or browse for the active provider
 */
async function triggerDynamicSearch(query = '', providerKey = null, lang = null, bypassCache = false) {
    const cleanQuery = (query || '').trim();
    if (providerKey) {
        AppState.activeProvider = providerKey.toLowerCase();
        localStorage.setItem('nd_active_provider', AppState.activeProvider);
    }
    if (lang && ALLOWED_LANGS.some(l => l.code === lang)) {
        AppState.currentLang = lang;
        localStorage.setItem('nd_search_lang', AppState.currentLang);
    }
    const activeProv = AppState.activeProvider || 'dramabox';
    const activeLang = AppState.currentLang || 'en-US';
    AppState.currentQuery = cleanQuery;

    updateProviderTabsUI(activeProv);
    updateLangUI(activeLang);

    // Update URL query parameters
    const searchParams = new URLSearchParams(window.location.search);
    if (cleanQuery) {
        searchParams.set('q', cleanQuery);
    } else {
        searchParams.delete('q');
    }
    searchParams.set('provider', activeProv);
    searchParams.set('lang', activeLang);
    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Transition view to results mode
    setAppMode('results');

    // Invalidate any ongoing background resolution from prior search
    AppState.currentSearchSessionId = (AppState.currentSearchSessionId || 0) + 1;
    const sessionId = AppState.currentSearchSessionId;

    const cacheKey = `${activeProv}:${activeLang}:${cleanQuery.toLowerCase()}`;
    const provLabel = getProviderLabel(activeProv);

    if (!bypassCache && SearchCache.has(cacheKey)) {
        AppState.results = SearchCache.get(cacheKey);
        renderAnimeCards(AppState.results, cleanQuery, provLabel);
        resolveAllCardEpisodes(AppState.results, sessionId);
        return;
    }

    showLoading();

    try {
        const items = await fetchProviderSections(activeProv, cleanQuery, activeLang);
        AppState.results = items || [];
        SearchCache.set(cacheKey, AppState.results);

        if (AppState.results.length === 0) {
            showEmpty(cleanQuery, provLabel);
        } else {
            renderAnimeCards(AppState.results, cleanQuery, provLabel);
            resolveAllCardEpisodes(AppState.results, sessionId);
        }
    } catch (err) {
        console.error('[Search Failed]:', err.message);
        const isCors = /failed to fetch|networkerror|cross-origin|load failed/i.test(err.message || '');
        const msg = isCors
            ? `Direct connection to ${provLabel} was blocked by browser CORS policy. Please enable a CORS extension (e.g. "CORS Everywhere" in Firefox) to allow direct requests.`
            : `Could not fetch from ${provLabel} in ${activeLang} (${err.message}). Tap "Retry Search" to try again.`;
        showError(msg);
    }
}

/**
 * Helper to trigger search from template or buttons
 */
window.searchByKeyword = function(keyword) {
    if (elements.searchInput) {
        elements.searchInput.value = keyword;
    }
    if (elements.searchClearBtn) {
        elements.searchClearBtn.classList.add('visible');
    }
    triggerDynamicSearch(keyword);
};

/**
 * FETCH ENGINE — Direct-First, Sequential Proxy Waterfall
 *
 * Strategy:
 *  1. Try direct fetch first (no proxy at all). Works when:
 *     - Running on localhost / dev
 *     - narto-drama.com adds CORS headers in the future
 *     - Browser extension strips CORS restrictions
 *  2. If direct is blocked, fall through to proxies silently.
 *  3. Only use proxies that are known to actually set Access-Control-Allow-Origin
 *     and are not currently blacklisting narto-drama.com:
 *       • allorigins.win/raw  (most reliable, retry with /get JSON if raw fails)
 *       • api.codetabs.com    (sometimes 503 but worth a try)
 *
 * Removed dead proxies that fail for this domain:
 *   ✗ corsproxy.io      → HTTP 403 (blocks streaming/drama sites)
 *   ✗ proxy.cors.sh     → null CORS status (requires paid API key)
 *   ✗ thingproxy        → null CORS status (doesn't send CORS headers)
 */
async function fetchFastHtml(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string' || /^file:\/\//i.test(targetUrl) || /^file:/i.test(targetUrl)) {
        throw new Error('Invalid URL or disallowed file protocol.');
    }

    if (DetailCache.has(targetUrl)) {
        return { html: DetailCache.get(targetUrl), source: 'Cache' };
    }

    const method = AppState.proxyMethod || 'auto';

    /** Validate that a response body is real drama HTML, not a proxy error page */
    function isValidDramaHtml(text) {
        if (!text || typeof text !== 'string' || text.length < 500) return false;
        // Reject known proxy/CDN error page signatures (precise phrases, not bare numbers)
        if (
            text.includes('502 Bad Gateway') ||
            text.includes('Error 520') ||
            text.includes('522 Connection Timed Out') ||
            text.includes('524 A Timeout Occurred') ||
            text.includes('Cloudflare Ray ID') ||
            text.includes('503 Service Unavailable') ||
            text.includes('Too Many Requests') ||
            text.includes('Web Server Returned an Unknown Error')
        ) return false;
        return text.includes('<html') || text.includes('<body') || text.includes('<!DOCTYPE') || text.includes('drama');
    }

    /** Try a single fetch, returns html string or throws */
    async function tryFetch(url, opts = {}) {
        const res = await fetchWithTimeout(url, opts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    }

    /** Try a single fetch and return JSON, or throws */
    async function tryFetchJson(url, opts = {}) {
        const res = await fetchWithTimeout(url, opts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // ─── 1. User Custom Proxy ────────────────────────────────────────────────
    if (AppState.customProxy && AppState.customProxy.trim()) {
        const customUrl = AppState.customProxy.replace('{url}', encodeURIComponent(targetUrl));
        try {
            const text = await tryFetch(customUrl, { timeout: 14000 });
            if (isValidDramaHtml(text)) {
                DetailCache.set(targetUrl, text);
                return { html: text, source: 'Custom Proxy' };
            }
        } catch (_) { /* fall through */ }
    }

    // ─── 2. Force-direct mode ────────────────────────────────────────────────
    if (method === 'direct') {
        const text = await tryFetch(targetUrl, { mode: 'cors', timeout: 10000 });
        DetailCache.set(targetUrl, text);
        return { html: text, source: 'Direct' };
    }

    // ─── 3. allorigins single-method ─────────────────────────────────────────
    if (method === 'allorigins') {
        // raw endpoint
        try {
            const text = await tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, { timeout: 15000 });
            if (isValidDramaHtml(text)) { DetailCache.set(targetUrl, text); return { html: text, source: 'AllOrigins Raw' }; }
        } catch (_) { /* try json fallback */ }
        // json endpoint (different server infrastructure)
        const data = await tryFetchJson(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, { timeout: 15000 });
        if (!data || !data.contents || !isValidDramaHtml(data.contents)) throw new Error('AllOrigins returned invalid content');
        DetailCache.set(targetUrl, data.contents);
        return { html: data.contents, source: 'AllOrigins JSON' };
    }

    // ─── 4. codetabs single-method ───────────────────────────────────────────
    if (method === 'codetabs') {
        const text = await tryFetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, { timeout: 15000 });
        if (!isValidDramaHtml(text)) throw new Error('CodeTabs returned invalid content');
        DetailCache.set(targetUrl, text);
        return { html: text, source: 'CodeTabs' };
    }

    // ─── 5. AUTO mode: sequential waterfall ──────────────────────────────────
    //
    // Tries each source in order. As soon as one succeeds, we stop.
    // Errors are collected silently — only logged if ALL fail.
    //
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const errors = [];

    // Step A: Cloudflare Worker (your own proxy — zero CORS issues, most reliable)
    // Only runs if CF_WORKER_URL is configured at the top of this file.
    if (CF_WORKER_URL && CF_WORKER_URL.trim()) {
        try {
            const workerUrl = `${CF_WORKER_URL.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`;
            let text = await tryFetch(workerUrl, { timeout: 20000 });
            if (!isValidDramaHtml(text) && targetUrl.includes('/search/import')) {
                // Wait 2s and retry as Narto Drama finishes on-demand scrape
                await new Promise(r => setTimeout(r, 2000));
                text = await tryFetch(workerUrl, { timeout: 20000 });
            }
            if (isValidDramaHtml(text)) {
                DetailCache.set(targetUrl, text);
                return { html: text, source: 'CF Worker' };
            }
            errors.push('CF Worker: invalid content');
        } catch (e) {
            if (targetUrl.includes('/search/import')) {
                try {
                    await new Promise(r => setTimeout(r, 2000));
                    const workerUrl = `${CF_WORKER_URL.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}`;
                    const text = await tryFetch(workerUrl, { timeout: 20000 });
                    if (isValidDramaHtml(text)) {
                        DetailCache.set(targetUrl, text);
                        return { html: text, source: 'CF Worker (Retry)' };
                    }
                } catch (_) {}
            }
            errors.push(`CF Worker: ${e.message}`);
        }
    }

    // For /search/import URLs or narto-drama session endpoints, NEVER fall back to public proxies!
    // Public proxies (AllOrigins, CodeTabs) lack session cookies, reject POSTs/imports, and throw 503 CORS errors.
    if (targetUrl.includes('/search/import')) {
        throw new Error(`Import timed out or failed on upstream provider: ${errors.join(' | ')}`);
    }

    // Step B: Direct fetch — no proxy. Fast-fail (3s) to avoid blocking.
    // Works on localhost or if narto-drama.com ever adds CORS headers.
    try {
        const text = await tryFetch(targetUrl, { mode: 'cors', timeout: isLocalhost ? 5000 : 3000 });
        if (isValidDramaHtml(text)) {
            DetailCache.set(targetUrl, text);
            return { html: text, source: 'Direct' };
        }
    } catch (_) {
        errors.push('Direct: CORS blocked or timeout');
    }

    // Step B: AllOrigins raw endpoint
    try {
        const text = await tryFetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            { timeout: 15000 }
        );
        if (isValidDramaHtml(text)) {
            DetailCache.set(targetUrl, text);
            return { html: text, source: 'AllOrigins Raw' };
        }
        errors.push('AllOrigins Raw: invalid content');
    } catch (e) {
        errors.push(`AllOrigins Raw: ${e.message}`);
    }

    // Step C: AllOrigins JSON endpoint (different infrastructure than /raw)
    try {
        const data = await tryFetchJson(
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            { timeout: 15000 }
        );
        if (data && data.contents && isValidDramaHtml(data.contents)) {
            DetailCache.set(targetUrl, data.contents);
            return { html: data.contents, source: 'AllOrigins JSON' };
        }
        errors.push('AllOrigins JSON: invalid content');
    } catch (e) {
        errors.push(`AllOrigins JSON: ${e.message}`);
    }

    // Step D: CodeTabs
    try {
        const text = await tryFetch(
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
            { timeout: 15000 }
        );
        if (isValidDramaHtml(text)) {
            DetailCache.set(targetUrl, text);
            return { html: text, source: 'CodeTabs' };
        }
        errors.push('CodeTabs: invalid content');
    } catch (e) {
        errors.push(`CodeTabs: ${e.message}`);
    }

    // All routes exhausted
    throw new Error(`All fetch attempts failed. Try again or check your connection.\n${errors.join(' | ')}`);
}

/**
 * Format total episode label
 */
function getEpisodeTotalText(item) {
    if (item.episodes && item.episodes > 0) {
        return `${item.episodes} ep`;
    }
    if (item.episodeList && item.episodeList.length > 0) {
        return `${item.episodeList.length} ep`;
    }
    return '... ep';
}

/**
 * Generate a consistent star rating (e.g., 8.7) for drama titles
 */
function getDramaRating(title) {
    if (!title) return '8.5';
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = (hash << 5) - hash + title.charCodeAt(i);
        hash |= 0;
    }
    const val = 8.2 + (Math.abs(hash) % 15) * 0.1;
    return val.toFixed(1);
}

/**
 * Sorting logic - returns a sorted copy of items according to the active sort order
 */
function applySort(items, sortVal = null) {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    const currentSort = sortVal || (elements.sortSelect ? elements.sortSelect.value : (AppState.sortOrder || 'default'));
    const sorted = [...items];

    if (currentSort === 'title-asc') {
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true, sensitivity: 'base' }));
    } else if (currentSort === 'title-desc') {
        sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '', undefined, { numeric: true, sensitivity: 'base' }));
    }

    return sorted;
}

/**
 * Render Anime Cards into Grid
 */
function renderAnimeCards(items, queryText = '', providerLabel = '', skipSort = false) {
    hideAllResults();
    if (AppState.mode !== 'detail' && AppState.mode !== 'bookmarks') {
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'flex';
        if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
        if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    }
    if (elements.animeGrid) elements.animeGrid.style.display = 'grid';

    // Synchronize sort-select dropdown with AppState.sortOrder
    if (elements.sortSelect && AppState.sortOrder && elements.sortSelect.value !== AppState.sortOrder) {
        elements.sortSelect.value = AppState.sortOrder;
    }

    // Consistently apply the active sort order so the grid never reverts to relevance unexpectedly
    const sortedItems = skipSort ? items : applySort(items);

    const pLabel = providerLabel || getProviderLabel(AppState.activeProvider);
    if (elements.sectionMainTitle) {
        elements.sectionMainTitle.textContent = queryText ? `Results for "${queryText}"` : `${pLabel} Dramas`;
    }
    if (elements.sectionSubtitle) {
        elements.sectionSubtitle.textContent = queryText ? `Found in ${pLabel} library` : `Trending short dramas and latest releases`;
    }
    if (elements.resultsQuery) {
        elements.resultsQuery.innerHTML = queryText 
            ? `Search for <strong>"${escapeHtml(queryText)}"</strong> in <em>${escapeHtml(pLabel)}</em>` 
            : `Featured in <strong>${escapeHtml(pLabel)}</strong>`;
    }

    if (elements.animeGrid) {
        elements.animeGrid.innerHTML = sortedItems.map((item, index) => createAnimeCardHtml(item, index, false)).join('');
    }

    // Attach click & bookmark handlers
    attachCardListeners(elements.animeGrid, sortedItems, false);
}

/**
 * Shared card event listeners for search grid and bookmarks grid
 */
function attachCardListeners(containerEl, items, isBookmarkView = false) {
    if (!containerEl) return;
    items.forEach((item, index) => {
        const cardId = isBookmarkView ? `bookmark-card-${index}` : `anime-card-${index}`;
        const cardEl = containerEl.querySelector(`#${cardId}`);
        if (!cardEl) return;

        // Card Click Handler
        cardEl.addEventListener('click', async (e) => {
            // Check if bookmark toggle button clicked
            const bookmarkBtn = e.target.closest('.card-bookmark-btn');
            if (bookmarkBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (!UserDataManager.currentUser) {
                    showToast('Please sign in with Google to save reels', 'info');
                    handleGoogleSignIn();
                    return;
                }

                try {
                    const nowSaved = await UserDataManager.toggleBookmark(item);
                    if (isBookmarkView) {
                        showToast(`Removed "${item.title}" from My List`);
                        renderBookmarksView();
                    } else {
                        bookmarkBtn.classList.toggle('is-saved', nowSaved);
                        const iconEl = bookmarkBtn.querySelector('.bookmark-icon');
                        const textEl = bookmarkBtn.querySelector('.bookmark-text');
                        if (iconEl) iconEl.innerHTML = nowSaved ? ICON_BOOKMARK_FILLED_SVG : ICON_BOOKMARK_OUTLINE_SVG;
                        if (textEl) textEl.textContent = nowSaved ? 'Saved' : 'Save';
                        bookmarkBtn.title = nowSaved ? 'Remove from My List' : 'Add to My List';
                        bookmarkBtn.setAttribute('aria-label', nowSaved ? 'Remove from My List' : 'Add to My List');
                        showToast(nowSaved ? `Saved "${item.title}" to My List` : `Removed "${item.title}" from My List`);
                    }
                } catch (err) {
                    console.error('[UserDataManager] Bookmark toggle error:', err);
                    showToast('Could not sync bookmark with Firebase', 'error');
                }
                return;
            }

            // Tapping on the card opens Quick View modal to choose episode and see drama details!
            openQuickView(item, cardEl);
        });

        // Image load fallback with anime initials
        const imgEl = cardEl.querySelector('.card-poster');
        if (imgEl) {
            imgEl.addEventListener('error', () => {
                const fallbackEl = document.createElement('div');
                fallbackEl.className = 'card-poster-fallback';
                fallbackEl.textContent = getInitials(item.title);
                imgEl.replaceWith(fallbackEl);
            });
        }
    });
}

/**
 * Concurrency-controlled background resolver for real episode counts on search cards
 * Resolves cards in batches of 3 so the UI is immediately responsive
 */
async function resolveAllCardEpisodes(items, sessionId) {
    if (!items || items.length === 0) return;

    const concurrency = 3;
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            if (sessionId !== AppState.currentSearchSessionId) {
                return; // User started a new search; abort stale resolution
            }

            const currentIndex = nextIndex++;
            const item = items[currentIndex];
            if (!item || !item.url) continue;

            // If already known, ensure badge is up to date and proceed
            if (item.episodes && item.episodes > 0) {
                updateCardEpisodeBadge(currentIndex, item.episodes);
                continue;
            }

            // CRITICAL: Do NOT scrape /search/import URLs in background card resolution!
            // /search/import triggers a synchronous on-demand scraper on Narto Drama.
            // Bombarding Narto Drama with 15+ simultaneous import requests causes 502 Bad Gateway.
            // Items are resolved cleanly on-demand when the user clicks a card.
            if (item.url && item.url.includes('/search/import')) {
                updateCardEpisodeBadge(currentIndex, null);
                continue;
            }

            try {
                const { html } = await fetchFastHtml(item.url);
                if (sessionId !== AppState.currentSearchSessionId) return;

                const detailData = DramaParser.parseEpisodesFromDetailPage(html, 'https://narto-drama.com');
                if (detailData && detailData.episodeCount > 0) {
                    item.episodes = detailData.episodeCount;
                    item.episodeList = detailData.episodeList;
                    if (detailData.description && !item.description) {
                        item.description = detailData.description;
                    }
                    if (detailData.tags && detailData.tags.length > 0 && (!item.tags || item.tags.length === 0)) {
                        item.tags = detailData.tags;
                    }
                    updateCardEpisodeBadge(currentIndex, item.episodes);
                } else if (detailData && detailData.episodeList && detailData.episodeList.length > 0) {
                    item.episodes = detailData.episodeList.length;
                    item.episodeList = detailData.episodeList;
                    updateCardEpisodeBadge(currentIndex, item.episodes);
                } else {
                    updateCardEpisodeBadge(currentIndex, null);
                }
            } catch (err) {
                if (sessionId === AppState.currentSearchSessionId) {
                    updateCardEpisodeBadge(currentIndex, null);
                }
            }
        }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);
}

function updateCardEpisodeBadge(index, count) {
    // Episode badges removed from cards per user request
    const badgeEl = document.getElementById(`card-ep-badge-${index}`);
    if (badgeEl) badgeEl.remove();
}

/**
 * Generate HTML for an Anime Card
 */
function createAnimeCardHtml(item, index, isBookmarkView = false) {
    const title = escapeHtml(item.title || 'Untitled Drama');
    const poster = formatPosterUrl(item.poster || '');
    const providerName = getItemProviderName(item);
    const ratingVal = getDramaRating(item.title || '');

    // Bookmarking & Episode Tracking state
    const isSaved = UserDataManager.isBookmarked(item);
    const prog = UserDataManager.getDramaProgress(item);

    const watchedList = Array.isArray(prog.watchedList) ? prog.watchedList : [];
    const watchedCount = watchedList.length > 0
        ? watchedList.length
        : (prog.lastWatchedEp && prog.lastWatchedEp > 1 ? prog.lastWatchedEp : 0);

    const rawTotalEps = (item.episodes && item.episodes > 0) ? item.episodes : (item.episodeList ? item.episodeList.length : (prog.episodes || 0));
    const totalEps = Math.max(rawTotalEps, watchedCount);
    const progressPct = totalEps > 0 ? Math.min(100, Math.round((watchedCount / totalEps) * 100)) : 0;

    const progressBarMarkup = watchedCount > 0 
        ? `<div class="card-progress-bar-wrap"><div class="card-progress-bar-fill" style="width: ${progressPct}%"></div></div>`
        : '';

    const posterMarkup = poster 
        ? `<img class="card-poster" src="${escapeHtml(poster)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${getPlaceholderSvgDataUri(title)}';">`
        : `<div class="card-poster-fallback">${getInitials(title)}</div>`;

    const cardId = isBookmarkView ? `bookmark-card-${index}` : `anime-card-${index}`;
    const primaryKey = UserDataManager.getDramaKey(item);
    const docId = UserDataManager.getDramaDocId(item);
    const coreId = UserDataManager.extractCoreId(item);
    const safeUrl = (!item.url || /^file:/i.test(item.url.trim()) || item.url.includes('file:///')) ? '' : item.url;
    const safeCanonicalUrl = (!item.canonicalUrl || /^file:/i.test(item.canonicalUrl.trim()) || item.canonicalUrl.includes('file:///')) ? '' : item.canonicalUrl;

    return `
        <article class="anime-card" id="${cardId}" 
            data-key="${escapeHtml(primaryKey)}"
            data-doc-id="${escapeHtml(docId)}"
            data-core-id="${escapeHtml(coreId)}"
            data-provider="${escapeHtml(providerName)}"
            data-url="${escapeHtml(safeUrl)}" 
            data-canonical-url="${escapeHtml(safeCanonicalUrl)}"
            data-title="${title}" 
            data-episodes="${totalEps}" 
            tabindex="0" role="button" aria-label="${title}">
            <div class="card-poster-wrap">
                <div class="card-badge-rating">
                    <svg class="rating-star-icon" width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span>${ratingVal}</span>
                </div>
                <button class="card-bookmark-btn ${isSaved ? 'is-saved' : ''}" type="button" 
                    title="${isSaved ? 'Remove from My List' : 'Add to My List'}" 
                    aria-label="${isSaved ? 'Remove from My List' : 'Add to My List'}">
                    <span class="bookmark-icon">${isSaved ? ICON_BOOKMARK_FILLED_SVG : ICON_BOOKMARK_OUTLINE_SVG}</span>
                </button>
                ${posterMarkup}
                <div class="poster-gradient"></div>
                ${progressBarMarkup}
            </div>
            <div class="card-overlay-content">
                <h3 class="card-title" title="${title}">${title}</h3>
                <div class="card-meta-line">
                    <div class="card-meta-info">
                        <span class="card-provider-pill">${escapeHtml(providerName)}</span>
                        <span class="card-dot-sep">·</span>
                        <span class="card-progress-text">HD Quality</span>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function setDetailPageDescription(text) {
    const clean = (text || '').trim();
    if (elements.detailSynopsisText) {
        elements.detailSynopsisText.textContent = clean || 'Loading drama synopsis...';
        elements.detailSynopsisText.classList.remove('expanded');
    }
    if (elements.quickViewDesc) {
        elements.quickViewDesc.textContent = clean || 'Loading drama synopsis...';
        elements.quickViewDesc.classList.remove('expanded');
    }
    const toggleBtn = elements.detailSynopsisToggle || elements.quickViewDescToggle;
    if (toggleBtn) {
        toggleBtn.textContent = 'more';
        toggleBtn.setAttribute('aria-expanded', 'false');
        if (clean.length > 110 && clean !== 'Loading drama synopsis...') {
            toggleBtn.style.display = 'inline-block';
        } else {
            toggleBtn.style.display = 'none';
        }
    }
}
function setQuickViewDescription(text) {
    return setDetailPageDescription(text);
}

function updateDetailPagePlayCta(drama) {
    if (!drama) return;
    const prog = UserDataManager.getDramaProgress(drama);
    const watchedList = Array.isArray(prog?.watchedList) ? prog.watchedList : [];
    const watchedCount = watchedList.length > 0
        ? watchedList.length
        : (prog?.lastWatchedEp && prog.lastWatchedEp > 1 ? prog.lastWatchedEp : 0);

    let totalEps = (drama.episodes && drama.episodes > 0)
        ? drama.episodes
        : (drama.episodeList ? drama.episodeList.length : (prog?.episodes || 0));

    if (!totalEps) {
        const bookmark = UserDataManager.findMatchingBookmark(drama);
        if (bookmark && bookmark.episodes > 0) totalEps = bookmark.episodes;
    }

    const isCompleted = Boolean(prog?.isCompleted) ||
        UserDataManager.isProgressCompleted(drama) ||
        (totalEps > 0 && (watchedList.length >= totalEps || (watchedCount >= totalEps && Math.round((watchedCount / totalEps) * 100) >= 100)));

    let targetEp = 1;
    let label = 'Episode 1';

    if (isCompleted) {
        label = 'Rewatch';
        targetEp = 1;
    } else if (watchedList.length > 0 || (prog && prog.lastWatchedEp && prog.lastWatchedEp > 1)) {
        // Watching in progress
        const maxWatched = watchedList.length > 0 ? Math.max(...watchedList) : 0;
        if (prog && prog.lastWatchedEp && prog.lastWatchedEp > maxWatched) {
            targetEp = prog.lastWatchedEp;
        } else {
            targetEp = maxWatched + 1;
        }
        if (totalEps > 0 && (targetEp > totalEps || maxWatched >= totalEps)) {
            label = 'Rewatch';
            targetEp = 1;
        } else {
            label = `Continue Ep. ${targetEp}`;
        }
    } else {
        // Brand new with no watch history
        label = 'Episode 1';
        targetEp = 1;
    }

    if (elements.detailPlayCtaText) {
        elements.detailPlayCtaText.textContent = label;
    }
    if (elements.detailPlayCtaIcon) {
        elements.detailPlayCtaIcon.innerHTML = (label === 'Rewatch') ? ICON_REWATCH_SVG : ICON_PLAY_SVG;
    }
    if (elements.detailPlayCta) {
        elements.detailPlayCta.setAttribute('data-target-ep', String(targetEp));
        elements.detailPlayCta.setAttribute('data-is-rewatch', label === 'Rewatch' ? 'true' : 'false');
    }
}

function updateDetailPageBookmarkCta(drama) {
    if (!drama) return;
    const isSaved = UserDataManager.isBookmarked(drama);
    if (elements.detailBookmarkCta) {
        elements.detailBookmarkCta.classList.toggle('is-saved', isSaved);
    }
    if (elements.detailBookmarkText) {
        elements.detailBookmarkText.textContent = isSaved ? 'Saved' : 'Add to List';
    }
    if (elements.detailBookmarkIcon) {
        elements.detailBookmarkIcon.innerHTML = isSaved
            ? `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
            : `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
    }
}

/**
 * Open Dedicated Full-Page Drama Detail View
 * Loads like a dedicated page with cinematic banner backdrop, meta pills, rating,
 * progress bar, dynamic Play Episode CTA, and 2-column episode cards.
 */
async function openDramaDetailPage(item, cardEl = null) {
    if (!item) return;
    AppState.selectedDrama = item;

    // Immediately resolve total episode count from card / progress / bookmark / DOM to avoid any delay
    if (!item.episodes || item.episodes <= 0) {
        if (cardEl) {
            const cEp = parseInt(cardEl.getAttribute('data-episodes'), 10);
            if (cEp > 0) item.episodes = cEp;
        }
        if (!item.episodes || item.episodes <= 0) {
            const prog = UserDataManager.getDramaProgress(item);
            if (prog && prog.episodes > 0) item.episodes = prog.episodes;
        }
        if (!item.episodes || item.episodes <= 0) {
            const bookmark = UserDataManager.findMatchingBookmark(item);
            if (bookmark && bookmark.episodes > 0) item.episodes = bookmark.episodes;
        }
        if (!item.episodes || item.episodes <= 0) {
            const domCard = document.querySelector(`.anime-card[data-key="${UserDataManager.getDramaKey(item)}"]`);
            if (domCard) {
                const cEp = parseInt(domCard.getAttribute('data-episodes'), 10);
                if (cEp > 0) item.episodes = cEp;
            }
        }
    }

    // Transition view to detail page mode
    setAppMode('detail');

    const posterUrl = formatPosterUrl(item.poster || '');

    // 1. Ambient Hero Banner Backdrop
    if (elements.detailHeroBackdrop) {
        elements.detailHeroBackdrop.style.backgroundImage = posterUrl ? `url("${posterUrl}")` : 'none';
    }

    // 2. Poster Card
    if (elements.detailPoster) {
        elements.detailPoster.src = posterUrl || getPlaceholderSvgDataUri(item.title);
        elements.detailPoster.alt = item.title || 'Drama Poster';
        elements.detailPoster.onerror = () => {
            elements.detailPoster.src = getPlaceholderSvgDataUri(item.title);
        };
    }

    // 3. Main Titles
    if (elements.detailMainTitle) elements.detailMainTitle.textContent = item.title || 'Drama Title';
    if (elements.detailNavTitle) elements.detailNavTitle.textContent = item.title || 'Drama Details';

    // 4. Provider & Status Pills
    const providerName = getItemProviderName(item);
    if (elements.detailProviderPill) elements.detailProviderPill.textContent = providerName;

    // 5. Rating Value
    const ratingVal = getDramaRating(item.title || '');
    if (elements.detailRatingVal) elements.detailRatingVal.textContent = ratingVal;

    // 6. Episode Count Meta
    const epTotalNum = item.episodes || (item.episodeList ? item.episodeList.length : 0);
    if (elements.detailEpCount) {
        elements.detailEpCount.textContent = epTotalNum > 0 ? `${epTotalNum} Episodes` : 'Episodes';
    }
    if (elements.detailTabEpisodesCount) {
        elements.detailTabEpisodesCount.textContent = epTotalNum > 0 ? String(epTotalNum) : '0';
    }

    // 7. Genre Badges
    if (elements.detailGenresRow) {
        const tags = (item.tags && item.tags.length > 0) ? item.tags : ['Trending', 'Drama', 'Romance'];
        elements.detailGenresRow.innerHTML = tags.map(t => `<span class="detail-genre-pill">#${escapeHtml(t)}</span>`).join('');
    }

    // 8. Synopsis
    setDetailPageDescription(item.description || 'Loading drama synopsis...');

    // 9. Dynamic Play Episode & Bookmark CTAs
    updateDetailPagePlayCta(item);
    updateDetailPageBookmarkCta(item);

    // 10. Clear filter input
    if (elements.detailEpisodesSearchInput) {
        elements.detailEpisodesSearchInput.value = '';
    }

    // 11. Push hash state for browser back-button navigation
    if (window.location.hash !== '#detail') {
        const dramaSlug = item.id || (item.title ? item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'drama');
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set('drama', dramaSlug);
        const newUrl = `${window.location.pathname}?${searchParams.toString()}#detail`;
        window.history.pushState({ mode: 'detail', dramaId: dramaSlug }, '', newUrl);
    }

    // 12. If episodes already cached / parsed, render instantly in 0ms!
    if (item.episodeList && item.episodeList.length > 0) {
        renderEpisodesList(item.episodeList, item.episodes || item.episodeList.length);
        return;
    }

    // 13. Otherwise, fetch detail HTML page
    if (elements.detailEpisodesRanges) {
        elements.detailEpisodesRanges.innerHTML = '';
        elements.detailEpisodesRanges.style.display = 'none';
    }
    if (elements.detailEpisodesGrid) elements.detailEpisodesGrid.innerHTML = '';
    if (elements.detailEpisodesLoading) elements.detailEpisodesLoading.style.display = 'flex';

    try {
        const { html } = await fetchFastHtml(item.url);
        const detailData = DramaParser.parseEpisodesFromDetailPage(html, 'https://narto-drama.com');

        if (detailData.description) {
            setDetailPageDescription(detailData.description);
            item.description = detailData.description;
        }

        if (detailData.canonicalUrl) {
            item.url = detailData.canonicalUrl;
        }

        if (detailData.tags && detailData.tags.length > 0) {
            item.tags = detailData.tags;
            if (elements.detailGenresRow) {
                elements.detailGenresRow.innerHTML = detailData.tags.map(t => `<span class="detail-genre-pill">#${escapeHtml(t)}</span>`).join('');
            }
        }

        if (detailData.episodeList && detailData.episodeList.length > 0) {
            item.episodeList = detailData.episodeList;
            item.episodes = detailData.episodeCount || detailData.episodeList.length;
            renderEpisodesList(item.episodeList, item.episodes);

            if (elements.detailEpCount) {
                elements.detailEpCount.textContent = `${item.episodes} Episodes`;
            }
            if (elements.detailTabEpisodesCount) {
                elements.detailTabEpisodesCount.textContent = String(item.episodes);
            }
            if (cardEl) {
                const epBadge = cardEl.querySelector('.card-badge-top-left');
                if (epBadge) {
                    epBadge.textContent = `🎬 ${item.episodes} Episodes`;
                    epBadge.classList.remove('badge-resolving');
                }
            }
            return;
        }
    } catch (epErr) {
        console.warn('[Episode Import Notice]:', epErr.message);
    }

    // Graceful fallback: Generate episode links from URL pattern
    if (elements.detailEpisodesLoading) elements.detailEpisodesLoading.style.display = 'none';
    const totalEps = item.episodes || 60;
    let cleanBase = (item.url || '').split('?')[0].replace(/\/+$/, '').replace(/\/\d+$/, '');
    if (cleanBase.includes('/search/import')) {
        const dramaSlug = item.id || (item.title ? item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'drama');
        cleanBase = `https://narto-drama.com/detail/watch/${dramaSlug}`;
    }
    const activeLang = AppState.currentLang || 'en-US';
    const fallbackList = Array.from({ length: totalEps }, (_, i) => ({
        number: `EP ${i + 1}`,
        url: `${cleanBase}/${i + 1}?lang=${encodeURIComponent(activeLang)}`
    }));

    item.episodeList = fallbackList;
    renderEpisodesList(fallbackList, totalEps);
}

// Backwards-compatible alias
const openQuickView = openDramaDetailPage;

/**
 * Setup press-and-hold (long press) and click interactions on episode buttons.
 * - Tap/Click: plays the episode.
 * - Press & hold (~420ms): immediately marks episode as watched (or toggles watched state),
 *   giving tactile scale animation, haptic vibration, and toast feedback without launching playback.
 * - Right-click (contextmenu): also triggers toggle watched on desktop.
 */
function setupEpisodeButtonInteraction(btn, { onPlay, onToggleWatched }) {
    let pressTimer = null;
    let isLongPress = false;
    let startX = 0;
    let startY = 0;
    const HOLD_DURATION = 420;

    const startPress = (clientX, clientY) => {
        isLongPress = false;
        startX = clientX;
        startY = clientY;
        btn.classList.add('is-pressing');
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            isLongPress = true;
            btn.classList.remove('is-pressing');
            btn.classList.add('pulse-watched');
            setTimeout(() => btn.classList.remove('pulse-watched'), 320);
            if (navigator.vibrate) {
                try { navigator.vibrate(50); } catch (_) {}
            }
            onToggleWatched();
        }, HOLD_DURATION);
    };

    const cancelPress = () => {
        btn.classList.remove('is-pressing');
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    // Touch events for mobile
    btn.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            startPress(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    btn.addEventListener('touchmove', (e) => {
        if (pressTimer && e.touches && e.touches.length === 1) {
            const diffX = Math.abs(e.touches[0].clientX - startX);
            const diffY = Math.abs(e.touches[0].clientY - startY);
            if (diffX > 10 || diffY > 10) {
                cancelPress();
            }
        }
    }, { passive: true });

    btn.addEventListener('touchend', () => {
        cancelPress();
    });

    btn.addEventListener('touchcancel', () => {
        cancelPress();
    });

    // Mouse pointer events for desktop hold
    btn.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            startPress(e.clientX, e.clientY);
        }
    });

    btn.addEventListener('mousemove', (e) => {
        if (pressTimer) {
            const diffX = Math.abs(e.clientX - startX);
            const diffY = Math.abs(e.clientY - startY);
            if (diffX > 10 || diffY > 10) {
                cancelPress();
            }
        }
    });

    btn.addEventListener('mouseup', () => {
        cancelPress();
    });

    btn.addEventListener('mouseleave', () => {
        cancelPress();
    });

    // Right-click contextmenu for desktop
    btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelPress();
        onToggleWatched();
    });

    // Regular click (runs onPlay only if not a long press)
    btn.addEventListener('click', (e) => {
        if (isLongPress) {
            e.preventDefault();
            e.stopPropagation();
            isLongPress = false;
            return;
        }
        onPlay();
    });
}

function renderEpisodesList(episodeList, count) {
    if (elements.detailEpisodesLoading) elements.detailEpisodesLoading.style.display = 'none';
    if (elements.quickViewEpisodesLoading) elements.quickViewEpisodesLoading.style.display = 'none';

    const drama = AppState.selectedDrama;
    const totalCount = count || (episodeList ? episodeList.length : 0);

    if (drama && totalCount > 0) {
        drama.episodes = totalCount;
        UserDataManager.saveDramaEpisodes(drama, totalCount);
    }

    if (elements.detailEpCount) elements.detailEpCount.textContent = `${totalCount} Episodes`;
    if (elements.detailTabEpisodesCount) elements.detailTabEpisodesCount.textContent = String(totalCount);
    if (elements.quickViewEpisodesCount) elements.quickViewEpisodesCount.textContent = `${totalCount} Episodes`;

    const GROUP_SIZE = 24;
    const EYE_ICON_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    function updateDetailPageProgress() {
        if (!AppState.selectedDrama) return;
        const prog = UserDataManager.getDramaProgress(AppState.selectedDrama);
        const watchedList = Array.isArray(prog.watchedList) ? prog.watchedList : [];
        const watchedCount = watchedList.length;
        const pct = totalCount > 0 ? Math.min(100, Math.round((watchedCount / totalCount) * 100)) : 0;

        if (elements.detailProgressStats) {
            elements.detailProgressStats.textContent = `${watchedCount} / ${totalCount} watched (${pct}%)`;
        }
        if (elements.detailProgressBarFill) {
            elements.detailProgressBarFill.style.width = `${pct}%`;
        }
        if (elements.detailProgressWrap) {
            elements.detailProgressWrap.style.display = (watchedCount > 0 || prog.lastWatchedEp > 0) ? 'block' : 'none';
        }
        if (elements.quickViewProgressText) {
            elements.quickViewProgressText.textContent = `${watchedCount} / ${totalCount} watched (${pct}%)`;
        }
        if (elements.quickViewProgressBarFill) {
            elements.quickViewProgressBarFill.style.width = `${pct}%`;
        }
        if (elements.quickViewProgressBarWrap) {
            elements.quickViewProgressBarWrap.style.display = (watchedCount > 0 || prog.lastWatchedEp > 0) ? 'block' : 'none';
        }
        updateDetailPagePlayCta(AppState.selectedDrama);
    }

    updateDetailPageProgress();

    // Auto-detect initial active group (if user watched an episode in this drama)
    let activeGroupIndex = 0;
    const prog = UserDataManager.getDramaProgress(AppState.selectedDrama);
    if (prog && prog.lastWatchedEp) {
        const epIdx = episodeList.findIndex(e => {
            const n = typeof e.number === 'number' ? e.number : parseInt(String(e.number || '').replace(/\D+/g, ''), 10);
            return n === prog.lastWatchedEp;
        });
        if (epIdx >= 0) {
            activeGroupIndex = Math.floor(epIdx / GROUP_SIZE);
        }
    }

    let filterText = (elements.detailEpisodesSearchInput ? elements.detailEpisodesSearchInput.value : '').trim().toLowerCase();

    function closeRangeMenu() {
        closeDetailRangeMenu();
    }

    function toggleRangeMenu() {
        if (!elements.detailRangeMenu) return;
        const isOpen = elements.detailRangeMenu.style.display !== 'none';
        if (isOpen) {
            closeRangeMenu();
        } else {
            elements.detailRangeMenu.style.display = 'flex';
            if (elements.detailRangeTrigger) {
                elements.detailRangeTrigger.classList.add('open');
                elements.detailRangeTrigger.setAttribute('aria-expanded', 'true');
            }
        }
    }

    function renderRangeDropdown() {
        const wrapEl = elements.detailRangeSelectWrap;
        const triggerEl = elements.detailRangeTrigger;
        const triggerTextEl = elements.detailRangeTriggerText;
        const menuEl = elements.detailRangeMenu;
        const fallbackContainer = elements.detailEpisodesRanges || elements.quickViewEpisodesTabs;

        const groupsCount = Math.ceil(episodeList.length / GROUP_SIZE);

        if (groupsCount <= 1) {
            if (wrapEl) wrapEl.style.display = 'none';
            if (fallbackContainer) fallbackContainer.style.display = 'none';
            closeRangeMenu();
            return;
        }

        if (activeGroupIndex < 0 || activeGroupIndex >= groupsCount) {
            activeGroupIndex = 0;
        }

        if (wrapEl && triggerEl && menuEl) {
            if (fallbackContainer) fallbackContainer.style.display = 'none';
            const currentStart = activeGroupIndex * GROUP_SIZE + 1;
            const currentEnd = Math.min((activeGroupIndex + 1) * GROUP_SIZE, episodeList.length);
            if (triggerTextEl) {
                triggerTextEl.textContent = `${currentStart} - ${currentEnd}`;
            }

            wrapEl.style.display = 'inline-flex';

            const CHECKMARK_SVG = `<svg class="detail-range-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            const itemsHtml = Array.from({ length: groupsCount }, (_, i) => {
                const start = i * GROUP_SIZE + 1;
                const end = Math.min((i + 1) * GROUP_SIZE, episodeList.length);
                const isActive = i === activeGroupIndex;
                return `
                    <button class="detail-range-item${isActive ? ' active' : ''}" type="button" data-group-index="${i}" role="option" aria-selected="${isActive}">
                        <span class="detail-range-item-text">${start} - ${end}</span>
                        ${isActive ? CHECKMARK_SVG : ''}
                    </button>
                `;
            }).join('');

            menuEl.innerHTML = itemsHtml;

            menuEl.querySelectorAll('.detail-range-item').forEach(item => {
                item.onclick = (e) => {
                    e.stopPropagation();
                    const gIdx = parseInt(item.getAttribute('data-group-index'), 10) || 0;
                    activeGroupIndex = gIdx;
                    closeRangeMenu();
                    renderActiveEpisodes();
                };
            });

            triggerEl.onclick = (e) => {
                e.stopPropagation();
                toggleRangeMenu();
            };
        } else if (fallbackContainer) {
            const tabsHtml = Array.from({ length: groupsCount }, (_, i) => {
                const start = i * GROUP_SIZE + 1;
                const end = Math.min((i + 1) * GROUP_SIZE, episodeList.length);
                const isActive = i === activeGroupIndex;
                return `<button class="ep-range-tab${isActive ? ' active' : ''}" type="button" data-group-index="${i}">${start} - ${end}</button>`;
            }).join('');

            fallbackContainer.innerHTML = tabsHtml;
            fallbackContainer.style.display = 'flex';
            fallbackContainer.querySelectorAll('.ep-range-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const gIdx = parseInt(tab.getAttribute('data-group-index'), 10) || 0;
                    activeGroupIndex = gIdx;
                    renderActiveEpisodes();
                });
            });
        }
    }

    function renderActiveEpisodes() {
        const currentProg = UserDataManager.getDramaProgress(AppState.selectedDrama);
        const isCurrentPlayingDrama = Boolean(PlayerState.currentDrama && AppState.selectedDrama && (UserDataManager.getDramaKey(PlayerState.currentDrama) === UserDataManager.getDramaKey(AppState.selectedDrama)));

        let displayList = episodeList;
        const isFiltered = Boolean(filterText);

        if (isFiltered) {
            displayList = episodeList.filter((ep, idx) => {
                const epNum = typeof ep.number === 'number' ? ep.number : (idx + 1);
                const numStr = String(epNum);
                const titleStr = (ep.title || `Episode ${epNum}`).toLowerCase();
                return numStr.includes(filterText) || titleStr.includes(filterText);
            });
            closeRangeMenu();
            if (elements.detailRangeSelectWrap) {
                elements.detailRangeSelectWrap.style.display = 'none';
            }
            if (elements.detailEpisodesRanges) {
                elements.detailEpisodesRanges.style.display = 'none';
            }
            if (elements.quickViewEpisodesTabs) {
                elements.quickViewEpisodesTabs.style.display = 'none';
            }
        } else {
            // Group range slicing (24 episodes per page - exactly 6 rows in 4-column grid)
            if (episodeList.length > GROUP_SIZE) {
                const startIdx = activeGroupIndex * GROUP_SIZE;
                const endIdx = Math.min(startIdx + GROUP_SIZE, episodeList.length);
                displayList = episodeList.slice(startIdx, endIdx);
                renderRangeDropdown();
            } else {
                displayList = episodeList;
                closeRangeMenu();
                if (elements.detailRangeSelectWrap) {
                    elements.detailRangeSelectWrap.style.display = 'none';
                }
                if (elements.detailEpisodesRanges) {
                    elements.detailEpisodesRanges.style.display = 'none';
                }
                if (elements.quickViewEpisodesTabs) {
                    elements.quickViewEpisodesTabs.style.display = 'none';
                }
            }
        }

        const gridEl = elements.detailEpisodesGrid || elements.quickViewEpisodesGrid;
        if (!gridEl) return;

        if (displayList.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 36px 16px; text-align: center; color: var(--text-muted); font-size: 14px;">
                    No episodes found matching "${escapeHtml(filterText)}"
                </div>
            `;
            return;
        }

        const html = displayList.map((ep, sliceIdx) => {
            const globalIdx = isFiltered ? episodeList.indexOf(ep) : (activeGroupIndex * GROUP_SIZE + sliceIdx);
            const epNum = typeof ep.number === 'number' ? ep.number : (globalIdx >= 0 ? globalIdx + 1 : sliceIdx + 1);
            const epTitle = ep.title || `Episode ${epNum}`;
            const isWatched = (currentProg.watchedList || []).includes(epNum);
            const isActive = isCurrentPlayingDrama && PlayerState.currentEpisodeNumber === epNum;

            const classes = ['detail-ep-card'];
            if (isActive) classes.push('active');
            if (isWatched) classes.push('watched');

            const title = isActive
                ? `Episode ${epNum} (Playing)`
                : (isWatched ? `Episode ${epNum} (Watched — Press and hold to toggle)` : `Episode ${epNum} (Press and hold to mark watched)`);

            const statusBadgeHtml = isActive
                ? `<span class="detail-ep-playing-badge">▶ Playing</span>`
                : (isWatched ? `<span class="detail-ep-eye-badge" title="Watched" aria-label="Watched">${EYE_ICON_SVG}</span>` : `<span></span>`);

            return `
                <button class="${classes.join(' ')}" type="button" data-ep-index="${globalIdx}" data-ep-num="${epNum}" data-ep-url="${escapeHtml(ep.url || '')}" title="${escapeHtml(title)}">
                    <div class="detail-ep-num-box">${epNum}</div>
                    <div class="detail-ep-title">${escapeHtml(epTitle)}</div>
                    <div class="detail-ep-status-badge">${statusBadgeHtml}</div>
                </button>
            `;
        }).join('');

        gridEl.innerHTML = html;

        // Attach press-and-hold and click listeners to episode cards
        gridEl.querySelectorAll('.detail-ep-card').forEach(btn => {
            const epNum = parseInt(btn.getAttribute('data-ep-num'), 10) || 1;
            const epUrl = btn.getAttribute('data-ep-url') || '';

            setupEpisodeButtonInteraction(btn, {
                onPlay: () => {
                    if (AppState.selectedDrama) {
                        playEpisode(AppState.selectedDrama, epNum, epUrl);
                    }
                },
                onToggleWatched: () => {
                    if (!AppState.selectedDrama) return;
                    const nowWatched = UserDataManager.toggleEpisodeWatched(AppState.selectedDrama, epNum);
                    btn.classList.toggle('watched', nowWatched);
                    const statusBadge = btn.querySelector('.detail-ep-status-badge');
                    if (statusBadge) {
                        const isCurrentlyActive = btn.classList.contains('active');
                        statusBadge.innerHTML = isCurrentlyActive
                            ? `<span class="detail-ep-playing-badge">▶ Playing</span>`
                            : (nowWatched ? `<span class="detail-ep-eye-badge" title="Watched" aria-label="Watched">${EYE_ICON_SVG}</span>` : `<span></span>`);
                    }
                    updateDetailPageProgress();
                    showToast(nowWatched ? `Marked EP ${epNum} as watched` : `Marked EP ${epNum} as unwatched`, nowWatched ? 'success' : 'info');
                }
            });
        });
    }

    // Connect real-time episode search / filter
    if (elements.detailEpisodesSearchInput) {
        elements.detailEpisodesSearchInput.oninput = (e) => {
            filterText = (e.target.value || '').trim().toLowerCase();
            renderActiveEpisodes();
        };
    }

    renderActiveEpisodes();
}

function closeDramaDetailPage() {
    closeDetailRangeMenu();
    if (AppState.mode !== 'detail') return;
    if (window.location.hash === '#detail') {
        window.history.back();
    } else {
        const prevMode = AppState.lastMainMode || (window.location.hash === '#mylist' ? 'bookmarks' : 'home');
        setAppMode(prevMode);
    }
}

// Backwards-compatible alias
const closeQuickView = closeDramaDetailPage;

/**
 * ==========================================================================
 * STREAMING VIDEO PLAYER CONTROLLER
 * ==========================================================================
 */

/**
 * Dedicated helper to construct valid episode watch URLs
 * Formats: https://narto-drama.com/detail/watch/{slug}/{epNum}?lang=en-US
 */
function getEpisodeWatchUrl(dramaUrl, epNum = 1, lang = null) {
    if (!dramaUrl) return '';
    const activeLang = lang || AppState.currentLang || 'en-US';

    // If already an episode URL with episode number, preserve and normalize language
    if (/\/watch\/[^?#]+\/\d+/i.test(dramaUrl)) {
        const base = dramaUrl.split('?')[0];
        return `${base}?lang=${encodeURIComponent(activeLang)}`;
    }

    // Never append /{epNum} to /search/import URLs directly (that leads to 404)
    if (dramaUrl.includes('/search/import')) {
        return dramaUrl;
    }

    let clean = dramaUrl.split('?')[0].replace(/\/+$/, '');
    clean = clean.replace(/\/\d+$/, '');
    return `${clean}/${epNum}?lang=${encodeURIComponent(activeLang)}`;
}

/**
 * Play an episode in our in-app TikTok-style streaming player
 */
async function playEpisode(drama, episodeNumber, episodeUrl = '', forceRefresh = false, isSeamless = false) {
    if (!drama) return;

    const epNum = parseInt(episodeNumber, 10) || 1;
    PlayerState.currentDrama = drama;
    PlayerState.currentEpisodeNumber = epNum;
    PlayerState.episodeMarkedWatched = false;

    // Immediately record position and auto-fill skipped preceding episodes
    UserDataManager.setLastWatchedEpisode(drama, epNum);

    // Deduce clean episode watch URL
    let cleanWatchUrl = '';
    if (episodeUrl && !episodeUrl.includes('/search/import')) {
        cleanWatchUrl = getEpisodeWatchUrl(episodeUrl, epNum);
    }
    if (!cleanWatchUrl) {
        const matchingEp = drama.episodeList?.find(e => Number(e.number) === epNum || e.number === `EP ${epNum}`);
        if (matchingEp && matchingEp.url && !matchingEp.url.includes('/search/import')) {
            cleanWatchUrl = getEpisodeWatchUrl(matchingEp.url, epNum);
        }
    }
    if (!cleanWatchUrl) {
        cleanWatchUrl = getEpisodeWatchUrl(drama.url, epNum);
    }
    PlayerState.currentEpisodeUrl = cleanWatchUrl;

    // Update Player Modal UI
    if (elements.playerDramaTitle) elements.playerDramaTitle.textContent = drama.title;
    if (elements.playerEpIndicator) elements.playerEpIndicator.textContent = `EP ${epNum}`;
    if (elements.playerQualityIndicator) elements.playerQualityIndicator.textContent = '1080p';
    if (elements.playerInfoTitle) elements.playerInfoTitle.textContent = drama.title;
    if (elements.playerInfoDesc) elements.playerInfoDesc.textContent = drama.description || '';
    if (elements.playerErrorOverlay) elements.playerErrorOverlay.style.display = 'none';

    // Reset aspect ratio classes until new video metadata is loaded
    if (elements.reelVideoViewport) {
        elements.reelVideoViewport.classList.remove('is-landscape');
        elements.reelVideoViewport.classList.remove('is-portrait');
    }

    // Initialize Like State & Bookmark State
    initLikeStateForDrama(drama);
    updatePlayerBookmarkButton(drama);

    if (!isSeamless) {
        showPlayerBuffering(true);
    }

    // Update Next / Prev buttons
    updatePlayerNavButtons();

    // Open Player Modal
    openModal(elements.playerModal);

    // If cleanWatchUrl is a /search/import URL, resolve it first to the canonical detail/watch URL
    if (cleanWatchUrl.includes('/search/import')) {
        try {
            const { html: importHtml } = await fetchFastHtml(cleanWatchUrl);
            const detailData = DramaParser.parseEpisodesFromDetailPage(importHtml, 'https://narto-drama.com');
            if (detailData.canonicalUrl) {
                drama.url = detailData.canonicalUrl;
            }
            if (detailData.episodeList && detailData.episodeList.length > 0) {
                drama.episodeList = detailData.episodeList;
                PlayerState.episodes = detailData.episodeList;
                const foundEp = detailData.episodeList.find(e => Number(e.number) === epNum) || detailData.episodeList[0];
                if (foundEp && foundEp.url) {
                    cleanWatchUrl = foundEp.url;
                }
            } else if (detailData.canonicalUrl) {
                cleanWatchUrl = getEpisodeWatchUrl(detailData.canonicalUrl, epNum);
            }
        } catch (_) {
            const dramaSlug = drama.id || (drama.title ? drama.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'drama');
            cleanWatchUrl = `https://narto-drama.com/detail/watch/${dramaSlug}/${epNum}?lang=${encodeURIComponent(AppState.currentLang || 'en-US')}`;
        }
        if (cleanWatchUrl.includes('/search/import')) {
            const dramaSlug = drama.id || (drama.title ? drama.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'drama');
            cleanWatchUrl = `https://narto-drama.com/detail/watch/${dramaSlug}/${epNum}?lang=${encodeURIComponent(AppState.currentLang || 'en-US')}`;
        }
        PlayerState.currentEpisodeUrl = cleanWatchUrl;
    }

    // If stream data for this entire drama is ALREADY cached, instant playback!
    const dramaKey = (drama.url || '').split('?')[0].replace(/\/+$/, '').replace(/\/\d+$/, '');
    if (!forceRefresh && StreamCache.has(dramaKey)) {
        const cached = StreamCache.get(dramaKey);
        if (cached && cached.episodes && cached.episodes.length > 0) {
            PlayerState.episodes = cached.episodes;
            renderEpisodesSheet(PlayerState.episodes, epNum);

            const activeEp = cached.episodes.find(e => Number(e.number) === epNum);
            if (activeEp && activeEp.playUrl) {
                if (activeEp.exp && (activeEp.exp * 1000) < Date.now()) {
                    closePlayer();
                    showToast('This episode is not available at this moment');
                    return;
                }
                loadStreamInVideo(activeEp.playUrl, activeEp.isHls, activeEp.key, activeEp.exp, isSeamless);
                return;
            }
        }
    }

    // Fetch the episode watch page HTML to extract streams
    try {
        const { html } = await fetchFastHtml(cleanWatchUrl);
        const streamData = DramaParser.extractStreamData(html, cleanWatchUrl);

        if (streamData.episodes && streamData.episodes.length > 0) {
            StreamCache.set(dramaKey, streamData);
            PlayerState.episodes = streamData.episodes;
            renderEpisodesSheet(PlayerState.episodes, epNum);

            const activeEp = streamData.episodes.find(e => Number(e.number) === epNum);
            const targetUrl = (activeEp && activeEp.playUrl) || streamData.streamUrl;
            const targetKey = (activeEp && activeEp.key) || streamData.key || null;
            const targetExp = (activeEp && activeEp.exp) || streamData.exp || null;

            if (targetExp && (targetExp * 1000) < Date.now()) {
                closePlayer();
                showToast('This episode is not available at this moment');
                return;
            }

            if (targetUrl) {
                loadStreamInVideo(targetUrl, streamData.isHls, targetKey, targetExp, isSeamless);
                return;
            }
        } else if (streamData.streamUrl) {
            if (streamData.exp && (streamData.exp * 1000) < Date.now()) {
                closePlayer();
                showToast('This episode is not available at this moment');
                return;
            }
            loadStreamInVideo(streamData.streamUrl, streamData.isHls, streamData.key, streamData.exp, isSeamless);
            return;
        }

        // Stream URL could not be found
        showPlayerError('Video stream could not be extracted from this episode.');
    } catch (err) {
        if (err && (err.status === 410 || /410/.test(err.message))) {
            closePlayer();
            showToast('This episode is not available at this moment');
            return;
        }
        console.error('[Stream Fetch Failed]:', err.message);
        showPlayerError(`Could not load episode stream (${err.message}). Tap Retry to try again.`);
    }
}

/**
 * Custom Hls.js loader that resolves local/offline encryption keys in-memory
 * and strips/rewrites local: and file: URI references to avoid browser security errors
 */
function createReelHlsLoaderClass() {
    if (typeof Hls === 'undefined' || !Hls.DefaultConfig || !Hls.DefaultConfig.loader) {
        return null;
    }

    return class ReelHlsLoader extends Hls.DefaultConfig.loader {
        load(context, config, callbacks) {
            const rawUrl = (context && context.url) || '';
            const isLocalOrFile = rawUrl.startsWith('local:') || 
                                  rawUrl.startsWith('file:') || 
                                  rawUrl.includes('file:///') || 
                                  rawUrl.includes('offline-key') || 
                                  rawUrl.startsWith('data:application/octet-stream;base64,');

            // 1. Intercept decryption key requests (context.type === 'key')
            if (context.type === 'key') {
                if (isLocalOrFile) {
                    let keyBase64 = PlayerState.currentStreamKey;
                    if (rawUrl.startsWith('data:application/octet-stream;base64,')) {
                        keyBase64 = rawUrl.split(',')[1];
                    }
                    if (keyBase64) {
                        try {
                            const binary = atob(keyBase64);
                            const bytes = new Uint8Array(binary.length);
                            for (let i = 0; i < binary.length; i++) {
                                bytes[i] = binary.charCodeAt(i);
                            }
                            callbacks.onSuccess({
                                data: bytes.buffer
                            }, {
                                url: context.url
                            }, context);
                            return;
                        } catch (e) {
                            console.warn('[ReelHlsLoader] Failed to decode base64 key:', e);
                        }
                    }

                    // Fallback for file/local key when no valid key found:
                    // Return dummy 16-byte key buffer so Hls.js never calls super.load() on file:///
                    callbacks.onSuccess({
                        data: new Uint8Array(16).buffer
                    }, {
                        url: context.url
                    }, context);
                    return;
                }
            }

            // Guard against any network request attempting to fetch file:/// or local:
            if (rawUrl.startsWith('file:') || rawUrl.includes('file:///')) {
                console.warn('[ReelHlsLoader] Suppressing disallowed file URI request:', rawUrl);
                if (callbacks && callbacks.onError) {
                    callbacks.onError({ code: 403, text: 'File URI scheme not permitted' }, context);
                }
                return;
            }

            // 2. Intercept manifest & level playlists to rewrite local: or file: key URIs
            if (context.type === 'manifest' || context.type === 'level') {
                const origSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function(response, stats, ctx, networkDetails) {
                    if (response && typeof response.data === 'string') {
                        const fallbackKey = 'AAAAAAAAAAAAAAAAAAAAAA=='; // 16 null bytes base64
                        const keyToUse = PlayerState.currentStreamKey || fallbackKey;
                        const dataUri = `data:application/octet-stream;base64,${keyToUse}`;
                        // Rewrite any local: or file: key URI in the playlist to the in-memory data URI
                        response.data = response.data.replace(/URI=["'](?:local|file):(?:\/\/+|\/|)[^"']*["']/gi, `URI="${dataUri}"`);
                    }
                    origSuccess.call(this, response, stats, ctx, networkDetails);
                };
            }

            super.load(context, config, callbacks);
        }
    };
}

/**
 * Adaptable Video Aspect Ratio:
 * Automatically detects whether the video is landscape (16:9) or portrait (9:16).
 * Landscape videos are framed like YouTube does in portrait view (full frame, uncropped, centered, with ambient backdrop).
 * Fullscreen portrait videos (9:16) fill the screen seamlessly.
 */
function updateVideoAspectRatio() {
    const videoEl = elements.playerVideoElement;
    const viewport = elements.reelVideoViewport;
    const container = elements.reelPlayerContainer;
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return;

    const isLandscape = videoEl.videoWidth > videoEl.videoHeight;
    if (viewport) {
        viewport.classList.toggle('is-landscape', isLandscape);
        viewport.classList.toggle('is-portrait', !isLandscape);
    }
    if (container) {
        container.classList.toggle('has-landscape-video', isLandscape);
    }
}

/**
 * Display actual video stream resolution (1080p, 720p, 540p, 480p, etc.)
 */
function updateVideoQualityDisplay() {
    const videoEl = elements.playerVideoElement;
    const qualityEl = elements.playerQualityIndicator || document.getElementById('player-quality-indicator');
    if (!qualityEl) return;

    let qualityStr = '';
    const w = videoEl?.videoWidth || 0;
    const h = videoEl?.videoHeight || 0;
    const minDim = Math.min(w, h);

    if (PlayerState.hls && PlayerState.hls.currentLevel >= 0 && PlayerState.hls.levels && PlayerState.hls.levels[PlayerState.hls.currentLevel]) {
        const lvl = PlayerState.hls.levels[PlayerState.hls.currentLevel];
        const hlsP = Math.min(lvl.width || 0, lvl.height || 0) || lvl.height || 0;
        if (hlsP > 0) qualityStr = `${hlsP}p`;
    }

    if (!qualityStr) {
        if (minDim >= 1080) {
            qualityStr = '1080p';
        } else if (minDim >= 720) {
            qualityStr = '720p';
        } else if (minDim >= 540) {
            qualityStr = '540p';
        } else if (minDim >= 480) {
            qualityStr = '480p';
        } else if (minDim > 0) {
            qualityStr = `${minDim}p`;
        }
    }

    if (!qualityStr) {
        qualityStr = '1080p';
    }

    qualityEl.textContent = qualityStr;
}

/**
 * Setup Video Quality Switcher Dropdown
 */
function setupQualitySwitcher() {
    if (elements.playerQualityBtn) {
        elements.playerQualityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleQualityMenu();
        });
    }

    // Close when clicking outside dropdown
    document.addEventListener('click', (e) => {
        if (elements.playerQualityWrap && !elements.playerQualityWrap.contains(e.target)) {
            toggleQualityMenu(false);
        }
    });
}

function toggleQualityMenu(forceState) {
    if (!elements.playerQualityMenu || !elements.playerQualityWrap) return;
    const isCurrentlyOpen = elements.playerQualityWrap.classList.contains('open');
    const shouldOpen = forceState !== undefined ? forceState : !isCurrentlyOpen;

    if (shouldOpen) {
        if (elements.reelPlayerContainer) {
            elements.reelPlayerContainer.classList.remove('controls-hidden');
        }
        if (PlayerState.controlsHideTimer) {
            clearTimeout(PlayerState.controlsHideTimer);
            PlayerState.controlsHideTimer = null;
        }
        renderQualityMenu();
        elements.playerQualityWrap.classList.add('open');
        elements.playerQualityMenu.style.display = 'flex';
        if (elements.playerQualityBtn) {
            elements.playerQualityBtn.setAttribute('aria-expanded', 'true');
        }
    } else {
        elements.playerQualityWrap.classList.remove('open');
        elements.playerQualityMenu.style.display = 'none';
        if (elements.playerQualityBtn) {
            elements.playerQualityBtn.setAttribute('aria-expanded', 'false');
        }
        resetPlayerControlsTimer();
    }
}

function renderQualityMenu() {
    if (!elements.playerQualityMenu) return;

    const items = [];
    const videoEl = elements.playerVideoElement;
    const currentDim = videoEl ? Math.min(videoEl.videoWidth || 0, videoEl.videoHeight || 0) : 0;
    const currentDetected = currentDim >= 1080 ? '1080p' : (currentDim >= 720 ? '720p' : (currentDim >= 540 ? '540p' : (currentDim >= 480 ? '480p' : (currentDim > 0 ? `${currentDim}p` : '1080p'))));

    if (PlayerState.hls && Array.isArray(PlayerState.hls.levels) && PlayerState.hls.levels.length > 1) {
        // Multi-quality HLS stream available!
        const isAuto = PlayerState.hls.autoLevelEnabled || PlayerState.hls.currentLevel === -1;

        // Auto option
        items.push(`
            <button class="quality-menu-item${isAuto ? ' active' : ''}" type="button" data-level="-1">
                <span class="quality-item-label">Auto <small style="opacity:0.75; font-size:10px;">(${currentDetected})</small></span>
                ${isAuto ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </button>
        `);

        // Sort levels by height descending for intuitive user selection
        const sortedLevels = PlayerState.hls.levels
            .map((lvl, index) => ({ lvl, index }))
            .sort((a, b) => {
                const hA = Math.min(a.lvl.width || 0, a.lvl.height || 0) || a.lvl.height || 0;
                const hB = Math.min(b.lvl.width || 0, b.lvl.height || 0) || b.lvl.height || 0;
                return hB - hA;
            });

        const seenHeights = new Set();
        sortedLevels.forEach(({ lvl, index }) => {
            const h = Math.min(lvl.width || 0, lvl.height || 0) || lvl.height || 0;
            if (h <= 0 || seenHeights.has(h)) return;
            seenHeights.add(h);

            const isSelected = !isAuto && PlayerState.hls.currentLevel === index;
            let tag = '';
            if (h >= 1080) tag = 'Full HD';
            else if (h >= 720) tag = 'HD';
            else if (h <= 480) tag = 'SD';

            items.push(`
                <button class="quality-menu-item${isSelected ? ' active' : ''}" type="button" data-level="${index}">
                    <span class="quality-item-label">${h}p ${tag ? `<small style="opacity:0.75; font-size:10px;">${tag}</small>` : ''}</span>
                    ${isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
            `);
        });
    } else {
        // Single stream or direct video resolution detected
        items.push(`
            <button class="quality-menu-item active" type="button" data-level="current">
                <span class="quality-item-label">${currentDetected} <small style="opacity:0.75; font-size:10px;">(Current)</small></span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
        `);
    }

    elements.playerQualityMenu.innerHTML = items.join('');

    // Attach click listeners to options
    elements.playerQualityMenu.querySelectorAll('.quality-menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const levelVal = btn.getAttribute('data-level');
            if (levelVal === 'current') {
                toggleQualityMenu(false);
                return;
            }

            const targetLevel = parseInt(levelVal, 10);
            if (PlayerState.hls) {
                if (targetLevel === -1) {
                    PlayerState.hls.currentLevel = -1;
                    showToast('Quality set to Auto');
                } else if (targetLevel >= 0 && targetLevel < PlayerState.hls.levels.length) {
                    PlayerState.hls.currentLevel = targetLevel;
                    const lvl = PlayerState.hls.levels[targetLevel];
                    const h = Math.min(lvl.width || 0, lvl.height || 0) || lvl.height || 0;
                    showToast(`Quality set to ${h}p`);
                }
                updateVideoQualityDisplay();
            }
            toggleQualityMenu(false);
        });
    });
}

/**
 * Non-blocking, smooth TikTok-style buffering indicator
 */
function showPlayerBuffering(show = true) {
    if (!elements.playerBuffering) return;
    clearTimeout(PlayerState.bufferingTimer);
    if (show) {
        // Debounce showing spinner by 280ms so smooth scrolling/fast loads never flicker a spinner
        PlayerState.bufferingTimer = setTimeout(() => {
            if (elements.playerBuffering && !PlayerState.isPlaying) {
                elements.playerBuffering.style.display = 'flex';
            }
        }, 280);
    } else {
        elements.playerBuffering.style.display = 'none';
    }
}

/**
 * Attempt video playback with mobile autoplay policy fallback (auto-mute if unmuted autoplay blocked)
 */
function attemptAutoplay(videoEl) {
    if (!videoEl) return;
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
        playPromise.catch(async (playErr) => {
            if (playErr && playErr.name === 'NotAllowedError') {
                videoEl.muted = true;
                PlayerState.isMuted = true;
                try {
                    await videoEl.play();
                } catch (_) {}
            }
        });
    }
}

/**
 * Load and play a stream URL (.m3u8 or .mp4) in HTML5 video using adaptive Hls.js
 */
function loadStreamInVideo(streamUrl, isHlsHint = false, streamKey = null, streamExp = null, isSeamless = false) {
    if (!streamUrl || typeof streamUrl !== 'string' || /^file:/i.test(streamUrl.trim()) || streamUrl.includes('file:///')) {
        showPlayerError('No valid video stream URL found for this episode.');
        return;
    }

    // Unwrap embedded token if present
    if (typeof DramaParser !== 'undefined' && DramaParser.unwrapStreamUrl) {
        const unwrapped = DramaParser.unwrapStreamUrl(streamUrl);
        streamUrl = unwrapped.streamUrl;
        if (!streamKey && unwrapped.key) streamKey = unwrapped.key;
        if (!streamExp && unwrapped.exp) streamExp = unwrapped.exp;
    }

    // Check expiration timestamp for 410 Gone
    if (streamExp && (streamExp * 1000) < Date.now()) {
        closePlayer();
        showToast('This episode is not available at this moment');
        return;
    }

    // Detect stream format BEFORE wrapping in CF_WORKER_URL
    // (because Worker wrapping encodes the URL inside a query param like ?url=... which masks file extensions)
    const cleanRawUrl = (streamUrl || '').split('?')[0].toLowerCase();
    const isExplicitM3u8 = cleanRawUrl.endsWith('.m3u8') || cleanRawUrl.endsWith('.m3u') || (streamUrl || '').toLowerCase().includes('.m3u8');
    const isExplicitMp4 = cleanRawUrl.endsWith('.mp4') || cleanRawUrl.endsWith('.webm') || cleanRawUrl.endsWith('.m4v') || (streamUrl || '').toLowerCase().includes('.mp4');

    // ONLY treat as HLS if it's explicitly an M3U8 playlist or flagged as HLS AND NOT an MP4 file.
    // Hls.js is strictly for HLS (.m3u8) playlists — feeding an MP4 into Hls.js causes
    // manifestParsingError, canceled transfers, and NS_ERROR_NET_PARTIAL_TRANSFER.
    const isHls = !isExplicitMp4 && (isExplicitM3u8 || isHlsHint);

    // Route stream URL through CF Worker when configured, UNLESS host is in EXCLUDED_PROXY_HOSTS
    // (e.g. volcengine-forward.shorttv.live has its own auth_key / CORS and rejects worker proxying)
    const bypassProxy = shouldBypassProxy(streamUrl);
    if (!bypassProxy && CF_WORKER_URL && CF_WORKER_URL.trim() && streamUrl && !streamUrl.startsWith(CF_WORKER_URL)) {
        const workerBase = CF_WORKER_URL.replace(/\/$/, '');
        streamUrl = `${workerBase}/?url=${encodeURIComponent(streamUrl)}`;
    }

    PlayerState.currentStreamUrl = streamUrl;
    PlayerState.currentStreamKey = streamKey;
    PlayerState.currentStreamExp = streamExp;

    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;

    // Reset scrub bar displays for new stream
    if (elements.playerScrubProgress) elements.playerScrubProgress.style.width = '0%';
    if (elements.playerScrubBuffered) elements.playerScrubBuffered.style.width = '0%';

    // Reset previous HLS instance
    if (PlayerState.hls) {
        PlayerState.hls.destroy();
        PlayerState.hls = null;
    }

    // Reset video element
    videoEl.onerror = null;
    videoEl.removeAttribute('controls');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('x5-playsinline', '');
    if (!isSeamless) {
        // Only hard-reset src on non-seamless loads to avoid the black/poster flash
        // between auto-next episodes. The new src assignment below is sufficient.
        videoEl.pause();
        videoEl.removeAttribute('src');
        // Note: Do NOT suppress referrerpolicy here — CDN (hakunaymatata.com) requires
        // a Referer header to be present. Sending no-referrer causes HTTP 428 errors.
        videoEl.load();
    }

    // Set blurred backdrop poster if drama poster available
    if (elements.reelBackdrop && PlayerState.currentDrama?.poster) {
        elements.reelBackdrop.style.backgroundImage = `url("${formatPosterUrl(PlayerState.currentDrama.poster)}")`;
    }

    // Smooth non-blocking buffering indicator
    if (!isSeamless) {
        showPlayerBuffering(true);
    }
    if (elements.playerErrorOverlay) {
        elements.playerErrorOverlay.style.display = 'none';
    }

    // Adaptive playback strategy:
    // 1. If it's an HLS playlist (.m3u8), route through Hls.js (or native Apple HLS on Safari)
    // 2. If it's an MP4 or WebM video file, ALWAYS play directly with native HTML5 <video>
    if (isHls && window.Hls && Hls.isSupported()) {
        loadWithHlsJs(streamUrl, videoEl, false, streamKey, streamExp);
    } else if (isHls && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS for Safari on iOS / macOS
        loadNativeVideo(streamUrl, videoEl, true);
    } else {
        // Direct MP4 / WebM / native HTML5 video
        loadNativeVideo(streamUrl, videoEl, false);
    }
}

/**
 * Robust Hls.js stream loader with automatic proxy fallback and 410 Gone detection
 */
function loadWithHlsJs(streamUrl, videoEl, isProxyAttempt = false, streamKey = null, streamExp = null) {
    if (streamKey) PlayerState.currentStreamKey = streamKey;
    if (streamExp) PlayerState.currentStreamExp = streamExp;

    if (!PlayerState.currentStreamKey && typeof DramaParser !== 'undefined' && DramaParser.unwrapStreamUrl) {
        const unwrapped = DramaParser.unwrapStreamUrl(streamUrl);
        if (unwrapped.key) PlayerState.currentStreamKey = unwrapped.key;
        if (unwrapped.exp) PlayerState.currentStreamExp = unwrapped.exp;
    }

    const LoaderClass = createReelHlsLoaderClass();
    const hlsConfig = {
        enableWorker: Boolean(window.Worker),
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        xhrSetup: (xhr) => {
            xhr.withCredentials = false;
        }
    };
    if (LoaderClass) {
        hlsConfig.loader = LoaderClass;
    }

    const hls = new Hls(hlsConfig);
    PlayerState.hls = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(videoEl);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        showPlayerBuffering(false);
        updateVideoQualityDisplay();
        updateVideoAspectRatio();
        attemptAutoplay(videoEl);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        updateVideoQualityDisplay();
    });

    let networkRetryCount = 0;
    hls.on(Hls.Events.ERROR, (event, data) => {
        const statusCode = data.response?.code || data.response?.status || data.context?.xhr?.status;

        // HTTP 410 detection: check if active episode has an alternative fallback stream URL first
        if (statusCode === 410) {
            const activeEp = PlayerState.episodes?.find(e => Number(e.number) === PlayerState.currentEpisodeNumber);
            if (activeEp && activeEp.fallbackUrl && activeEp.fallbackUrl !== streamUrl) {
                console.warn('[Player] 410 on primary stream, retrying with fallback URL:', activeEp.fallbackUrl);
                hls.destroy();
                PlayerState.hls = null;
                const fallback = activeEp.fallbackUrl;
                activeEp.fallbackUrl = null; // prevent infinite loop
                loadStreamInVideo(fallback, true, activeEp.key, activeEp.exp);
                return;
            }
            hls.destroy();
            PlayerState.hls = null;
            closePlayer();
            showToast('This episode is not available at this moment');
            return;
        }

        // If HTTP 403 occurs on a proxied URL, automatically fallback to direct unproxied stream!
        // (Certain CDNs like shorttv.live reject worker proxying but work directly with CORS)
        if (statusCode === 403 && streamUrl.includes('?url=')) {
            try {
                const u = new URL(streamUrl);
                const rawUrl = u.searchParams.get('url');
                if (rawUrl) {
                    const directUrl = decodeURIComponent(rawUrl);
                    console.warn(`[Player] Worker returned 403 for proxied HLS stream. Retrying directly with:`, directUrl);
                    hls.destroy();
                    PlayerState.hls = null;
                    loadStreamInVideo(directUrl, true, streamKey, streamExp);
                    return;
                }
            } catch (_) {}
        }

        if (!data.fatal) return;

        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                if (networkRetryCount === 0) {
                    networkRetryCount++;
                    hls.startLoad();
                } else {
                    // Network retry exhausted — try native video player as last resort
                    hls.destroy();
                    loadNativeVideo(streamUrl, videoEl, false);
                }
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
            default:
                hls.destroy();
                // Attempt native video as last resort
                loadNativeVideo(streamUrl, videoEl, false);
                break;
        }
    });
}

/**
 * Native video playback with format recovery and 410 detection
 */
function loadNativeVideo(streamUrl, videoEl, isAppleHls = false) {
    if (!streamUrl || typeof streamUrl !== 'string' || /^file:/i.test(streamUrl.trim()) || streamUrl.includes('file:///')) {
        showPlayerError('Invalid or blocked video stream.');
        return;
    }
    videoEl.onerror = async () => {
        const err = videoEl.error;

        // 1. Probe for HTTP 410 status code (expired/unavailable episode)
        //    Skip probe if URL is from a known video CDN that rejects HEAD fetch with 428
        //    (they require Range requests from a browser video element, not plain fetch)
        try {
            const probe = await fetchWithTimeout(streamUrl, { method: 'HEAD', timeout: 3500 });
            if (probe.status === 410) {
                closePlayer();
                showToast('This episode is not available at this moment');
                return;
            }
            // 428 = CDN requires browser-native video request (not a JS fetch)
            // Ignore it — the video element itself will handle the actual request correctly
            // if we route through HLS.js below
        } catch (_) {}

        // If native video failed because it's actually an HLS stream (common on Chrome/Firefox):
        // NEVER route MP4 video files into Hls.js
        if (err && err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && window.Hls && Hls.isSupported() && !PlayerState.hls) {
            const raw = (streamUrl || '').toLowerCase();
            const isMp4 = raw.includes('.mp4') || raw.includes('.webm') || raw.includes('.m4v');
            if (!isMp4) {
                loadWithHlsJs(streamUrl, videoEl, false, PlayerState.currentStreamKey, PlayerState.currentStreamExp);
                return;
            }
        }

        // Check if there is an alternative play URL in active episode
        if (PlayerState.episodes && PlayerState.episodes.length > 0) {
            const activeEp = PlayerState.episodes.find(e => Number(e.number) === PlayerState.currentEpisodeNumber);
            if (activeEp && activeEp.directPlayUrl && activeEp.directPlayUrl !== streamUrl) {
                loadStreamInVideo(activeEp.directPlayUrl, activeEp.isHls, activeEp.key, activeEp.exp);
                return;
            }
        }

        // If native video failed on a proxied URL, automatically fallback to direct unproxied URL!
        if (streamUrl.includes('?url=')) {
            try {
                const u = new URL(streamUrl);
                const rawUrl = u.searchParams.get('url');
                if (rawUrl) {
                    const directUrl = decodeURIComponent(rawUrl);
                    console.warn(`[Player] Proxied native video failed. Retrying directly with:`, directUrl);
                    loadStreamInVideo(directUrl, false, PlayerState.currentStreamKey, PlayerState.currentStreamExp);
                    return;
                }
            } catch (_) {}
        }

        // If a network interruption occurs while video was already playing, attempt seamless resume
        if (err && err.code === MediaError.MEDIA_ERR_NETWORK && videoEl.currentTime > 0) {
            const resumePos = videoEl.currentTime;
            console.warn(`[Video] Network interruption at ${resumePos.toFixed(1)}s, attempting resume...`);
            setTimeout(() => {
                videoEl.src = streamUrl;
                videoEl.currentTime = resumePos;
                videoEl.play().catch(() => {});
            }, 600);
            return;
        }

        if (err && err.code === MediaError.MEDIA_ERR_DECODE) {
            showPlayerError('Failed to decode video stream (unsupported codec or corrupt video).');
        } else if (err && err.code === MediaError.MEDIA_ERR_NETWORK) {
            showPlayerError('Network connection error while streaming episode. Tap Retry to reconnect.');
        } else {
            showPlayerError('Video playback error. Tap Retry to reconnect.');
        }
    };

    videoEl.src = streamUrl;
    videoEl.addEventListener('loadedmetadata', () => {
        showPlayerBuffering(false);
        updateVideoQualityDisplay();
        updateVideoAspectRatio();
        attemptAutoplay(videoEl);
    }, { once: true });
}

/**
 * Configure video element events (timeupdate, progress, auto-next on ended)
 */
function setupVideoPlayerEvents() {
    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;

    videoEl.addEventListener('loadedmetadata', () => {
        updateVideoAspectRatio();
        updateVideoQualityDisplay();
    });

    videoEl.addEventListener('resize', () => {
        updateVideoAspectRatio();
        updateVideoQualityDisplay();
    });

    videoEl.ontimeupdate = () => {
        if (!PlayerState.isDraggingScrub && videoEl.duration) {
            const pct = (videoEl.currentTime / videoEl.duration) * 100;
            if (elements.playerScrubProgress) {
                elements.playerScrubProgress.style.width = `${pct}%`;
            }
            if (elements.playerTimeCurrent) {
                elements.playerTimeCurrent.textContent = formatTime(videoEl.currentTime);
            }
            if (elements.playerTimeTotal) {
                elements.playerTimeTotal.textContent = formatTime(videoEl.duration);
            }

            // Keep buffered progress updated continuously
            if (videoEl.buffered.length > 0 && elements.playerScrubBuffered) {
                const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
                const bufPct = Math.min(100, (bufferedEnd / videoEl.duration) * 100);
                elements.playerScrubBuffered.style.width = `${bufPct}%`;
            }

            // Only mark episode as completed once user watches >= 85% of it
            if (!PlayerState.episodeMarkedWatched && (videoEl.currentTime / videoEl.duration) >= 0.85) {
                PlayerState.episodeMarkedWatched = true;
                if (PlayerState.currentDrama && PlayerState.currentEpisodeNumber) {
                    UserDataManager.recordEpisodeWatched(PlayerState.currentDrama, PlayerState.currentEpisodeNumber);
                    if (elements.reelEpisodesSheet && elements.reelEpisodesSheet.classList.contains('active')) {
                        renderEpisodesSheet(PlayerState.episodes, PlayerState.currentEpisodeNumber);
                    }
                }
            }
        }
    };

    videoEl.onprogress = () => {
        if (videoEl.buffered.length > 0 && videoEl.duration) {
            const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
            const pct = (bufferedEnd / videoEl.duration) * 100;
            if (elements.playerScrubBuffered) {
                elements.playerScrubBuffered.style.width = `${pct}%`;
            }
        }
    };

    videoEl.onwaiting = () => {
        showPlayerBuffering(true);
    };

    videoEl.oncanplay = () => {
        showPlayerBuffering(false);
    };

    videoEl.onplay = () => {
        PlayerState.isPlaying = true;
        resetPlayerControlsTimer();
    };

    videoEl.onplaying = () => {
        showPlayerBuffering(false);
        updateVideoAspectRatio();
        updateVideoQualityDisplay();
        if (elements.playerErrorOverlay) elements.playerErrorOverlay.style.display = 'none';
        PlayerState.isPlaying = true;
        resetPlayerControlsTimer();

        // Track last watched episode position without prematurely marking it as completed
        if (PlayerState.currentDrama && PlayerState.currentEpisodeNumber) {
            UserDataManager.setLastWatchedEpisode(PlayerState.currentDrama, PlayerState.currentEpisodeNumber);
        }
    };

    videoEl.onpause = () => {
        PlayerState.isPlaying = false;
        if (PlayerState.controlsHideTimer) {
            clearTimeout(PlayerState.controlsHideTimer);
            PlayerState.controlsHideTimer = null;
        }
        if (elements.reelPlayerContainer) {
            elements.reelPlayerContainer.classList.remove('controls-hidden');
        }
    };

    videoEl.onended = () => {
        // Record finished episode as watched and advance
        if (!PlayerState.episodeMarkedWatched) {
            PlayerState.episodeMarkedWatched = true;
            if (PlayerState.currentDrama && PlayerState.currentEpisodeNumber) {
                UserDataManager.recordEpisodeWatched(PlayerState.currentDrama, PlayerState.currentEpisodeNumber);
            }
        }
        triggerReelSwipeTransition('up', () => {
            playNextEpisode(true);
        });
    };
}

/**
 * Custom TikTok-Style Scrub Bar Interaction
 */
function setupScrubBar() {
    const container = elements.playerScrubContainer;
    const track = elements.playerScrubTrack;
    if (!container || !track) return;

    function seekToEvent(e) {
        const videoEl = elements.playerVideoElement;
        if (!videoEl || !videoEl.duration) return;
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        videoEl.currentTime = pos * videoEl.duration;
        if (elements.playerScrubProgress) {
            elements.playerScrubProgress.style.width = `${pos * 100}%`;
        }
    }

    container.addEventListener('click', (e) => {
        e.stopPropagation();
        seekToEvent(e);
    });

    container.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        PlayerState.isDraggingScrub = true;
        seekToEvent(e);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (PlayerState.isDraggingScrub) seekToEvent(e);
    }, { passive: true });

    window.addEventListener('touchend', () => {
        PlayerState.isDraggingScrub = false;
    });
}

/**
 * Setup Touch Gestures: Swipe Up for Next, Swipe Down for Prev, Tap to Pause/Play, Double-Tap to Heart
 */
function setupReelGestures() {
    const viewport = elements.reelVideoViewport;
    if (!viewport) return;

    // Reset auto-hide controls timer on mouse movement inside the player (desktop)
    viewport.addEventListener('mousemove', resetPlayerControlsTimer);

    if (elements.reelPlayerContainer) {
        elements.reelPlayerContainer.addEventListener('mousemove', resetPlayerControlsTimer);
        elements.reelPlayerContainer.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') resetPlayerControlsTimer();
        });
    }

    viewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('.reel-right-rail') || e.target.closest('.reel-top-bar') || e.target.closest('.reel-bottom-bar') || e.target.closest('.reel-episodes-sheet')) {
            return;
        }
        // Capture whether controls were hidden at the exact moment of touchstart
        PlayerState.controlsWereHiddenOnTouch = Boolean(
            elements.reelPlayerContainer && elements.reelPlayerContainer.classList.contains('controls-hidden')
        );
        PlayerState.touchStartY = e.touches[0].clientY;
        PlayerState.touchStartX = e.touches[0].clientX;
        PlayerState.touchStartTime = Date.now();
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
        if (e.target.closest('.reel-right-rail') || e.target.closest('.reel-top-bar') || e.target.closest('.reel-bottom-bar') || e.target.closest('.reel-episodes-sheet')) {
            return;
        }
        const diffY = e.changedTouches[0].clientY - PlayerState.touchStartY;
        const diffX = e.changedTouches[0].clientX - PlayerState.touchStartX;
        const elapsed = Date.now() - PlayerState.touchStartTime;

        // Vertical Swipe Gesture detection (threshold > 55px in under 650ms)
        if (Math.abs(diffY) > 55 && Math.abs(diffY) > Math.abs(diffX) && elapsed < 650) {
            PlayerState.controlsWereHiddenOnTouch = false;
            resetPlayerControlsTimer();
            if (diffY < -55) {
                // Swipe UP -> Next Episode!
                triggerReelSwipeTransition('up', () => {
                    playNextEpisode(true);
                });
            } else if (diffY > 55) {
                // Swipe DOWN -> Prev Episode!
                triggerReelSwipeTransition('down', () => {
                    playPrevEpisode(true);
                });
            }
            return;
        }

        // Tap Detection (minimal movement)
        if (Math.abs(diffY) < 18 && Math.abs(diffX) < 18) {
            handleScreenTap(e);
        }
    });

    // Desktop Click / Tap
    viewport.addEventListener('click', (e) => {
        if (e.target.closest('.reel-right-rail') || e.target.closest('.reel-top-bar') || e.target.closest('.reel-bottom-bar') || e.target.closest('.reel-episodes-sheet')) {
            return;
        }
        // Handled by touch on mobile, click on desktop
        if (!('ontouchstart' in window)) {
            handleScreenTap(e);
        }
    });

    // Desktop Mouse Wheel / Trackpad Scroll (Debounced)
    let wheelDebounceTimer = null;
    viewport.addEventListener('wheel', (e) => {
        if (e.target.closest('.sheet-body')) return;
        if (wheelDebounceTimer) return;

        if (e.deltaY > 60) {
            wheelDebounceTimer = setTimeout(() => { wheelDebounceTimer = null; }, 600);
            resetPlayerControlsTimer();
            triggerReelSwipeTransition('up', () => {
                playNextEpisode(true);
            });
        } else if (e.deltaY < -60) {
            wheelDebounceTimer = setTimeout(() => { wheelDebounceTimer = null; }, 600);
            resetPlayerControlsTimer();
            triggerReelSwipeTransition('down', () => {
                playPrevEpisode(true);
            });
        }
    }, { passive: true });
}

/**
 * Reset 5-second timer to auto-hide player controls during active video playback
 */
function resetPlayerControlsTimer() {
    if (PlayerState.controlsHideTimer) {
        clearTimeout(PlayerState.controlsHideTimer);
        PlayerState.controlsHideTimer = null;
    }
    if (elements.reelPlayerContainer) {
        elements.reelPlayerContainer.classList.remove('controls-hidden');
    }

    const videoEl = elements.playerVideoElement;
    const isPlaying = (videoEl && !videoEl.paused && !videoEl.ended) || PlayerState.isPlaying;
    if (!isPlaying) return;

    if (elements.reelEpisodesSheet && elements.reelEpisodesSheet.classList.contains('active')) return;
    if (elements.playerQualityMenu && elements.playerQualityMenu.style.display !== 'none') return;
    if (!elements.playerModal || !elements.playerModal.classList.contains('active')) return;

    PlayerState.controlsHideTimer = setTimeout(() => {
        const currentVideoEl = elements.playerVideoElement;
        const stillPlaying = (currentVideoEl && !currentVideoEl.paused && !currentVideoEl.ended) || PlayerState.isPlaying;
        if (!stillPlaying) return;
        if (elements.reelEpisodesSheet && elements.reelEpisodesSheet.classList.contains('active')) return;
        if (elements.playerQualityMenu && elements.playerQualityMenu.style.display !== 'none') return;
        if (elements.reelPlayerContainer) {
            elements.reelPlayerContainer.classList.add('controls-hidden');
        }
    }, 5000);
}

/**
 * Handle screen tap -> show controls if hidden, or toggle Play/Pause if already visible
 */
function handleScreenTap(e) {
    const controlsHidden = (elements.reelPlayerContainer &&
        elements.reelPlayerContainer.classList.contains('controls-hidden')) ||
        Boolean(PlayerState.controlsWereHiddenOnTouch);

    PlayerState.controlsWereHiddenOnTouch = false;

    // First tap when controls are hidden: just reveal controls, don't pause video
    if (controlsHidden) {
        resetPlayerControlsTimer();
        return;
    }

    // Controls already visible: reset the hide timer AND toggle play/pause
    resetPlayerControlsTimer();
    togglePlayPause();
}

/**
 * Toggle Play / Pause with center ripple icon
 */
// SVG icons for center feedback (avoids iOS yellow emoji backgrounds)
const FEEDBACK_PLAY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="52" height="52" fill="white"><path d="M8 5v14l11-7z"/></svg>`;
const FEEDBACK_PAUSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="52" height="52" fill="white"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>`;

function togglePlayPause() {
    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;

    // If audio was muted due to browser autoplay restriction, tapping immediately unmutes
    if (videoEl.muted) {
        videoEl.muted = false;
        PlayerState.isMuted = false;
    }

    if (videoEl.paused) {
        videoEl.play().catch(() => {});
        triggerCenterFeedback(FEEDBACK_PLAY_SVG);
    } else {
        videoEl.pause();
        triggerCenterFeedback(FEEDBACK_PAUSE_SVG);
    }
}

function triggerCenterFeedback(iconHtml) {
    if (!elements.reelCenterFeedback || !elements.reelFeedbackIcon) return;
    elements.reelFeedbackIcon.innerHTML = iconHtml;
    elements.reelCenterFeedback.classList.add('active');
    setTimeout(() => {
        if (elements.reelCenterFeedback) elements.reelCenterFeedback.classList.remove('active');
    }, 450);
}

function triggerHeartBubble() {
    if (!elements.reelHeartBubble) return;
    elements.reelHeartBubble.classList.add('animate');
    setTimeout(() => {
        if (elements.reelHeartBubble) elements.reelHeartBubble.classList.remove('animate');
    }, 550);
}

let isSwipeAnimating = false;

/**
 * Native TikTok / YouTube Shorts sliding swipe transition without jarring buffering flicker
 */
function triggerReelSwipeTransition(direction, callback) {
    const videoEl = elements.playerVideoElement;
    const backdropEl = elements.reelBackdrop;

    if (!videoEl || isSwipeAnimating) {
        if (typeof callback === 'function') callback();
        return;
    }

    isSwipeAnimating = true;
    const isUp = direction === 'up';
    const exitY = isUp ? '-100%' : '100%';
    const enterY = isUp ? '100%' : '-100%';

    // 1. Smoothly slide the current video out
    videoEl.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease';
    if (backdropEl) backdropEl.style.transition = 'opacity 0.2s ease';
    videoEl.style.transform = `translateY(${exitY})`;
    videoEl.style.opacity = '0.35';
    if (backdropEl) backdropEl.style.opacity = '0.3';

    setTimeout(() => {
        // Trigger video source change while video is offscreen
        if (typeof callback === 'function') callback();

        // 2. Position incoming video at opposite side
        videoEl.style.transition = 'none';
        videoEl.style.transform = `translateY(${enterY})`;
        videoEl.style.opacity = '0.35';

        // Force browser layout reflow
        void videoEl.offsetHeight;

        // 3. Smoothly slide incoming video into center view
        requestAnimationFrame(() => {
            videoEl.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease';
            if (backdropEl) backdropEl.style.transition = 'opacity 0.28s ease';
            videoEl.style.transform = 'translateY(0)';
            videoEl.style.opacity = '1';
            if (backdropEl) backdropEl.style.opacity = '1';

            setTimeout(() => {
                videoEl.style.transition = '';
                videoEl.style.transform = '';
                videoEl.style.opacity = '';
                if (backdropEl) {
                    backdropEl.style.transition = '';
                    backdropEl.style.opacity = '';
                }
                isSwipeAnimating = false;
            }, 300);
        });
    }, 220);
}

/**
 * Update player floating rail bookmark button
 */
function updatePlayerBookmarkButton(drama) {
    if (!elements.playerBookmarkBtn) return;
    const targetDrama = drama || (typeof PlayerState !== 'undefined' ? PlayerState.currentDrama : null);
    if (!targetDrama) return;

    const isSaved = UserDataManager.isBookmarked(targetDrama);
    elements.playerBookmarkBtn.classList.toggle('is-saved', isSaved);
    elements.playerBookmarkBtn.setAttribute('aria-label', isSaved ? 'Remove from My List' : 'Save to My List');
    elements.playerBookmarkBtn.title = isSaved ? 'Remove from My List' : 'Save to My List';

    if (elements.playerBookmarkIcon) {
        elements.playerBookmarkIcon.innerHTML = isSaved ? PLAYER_BOOKMARK_FILLED_SVG : PLAYER_BOOKMARK_OUTLINE_SVG;
    }
    if (elements.playerBookmarkLabel) {
        elements.playerBookmarkLabel.textContent = isSaved ? 'Saved' : 'Save';
    }
}

/**
 * Like / Heart Controller
 */
function initLikeStateForDrama(drama) {
    const dramaKey = (drama.url || '').split('?')[0];
    if (!PlayerState.likeCounts[dramaKey]) {
        // Deterministic friendly like count
        const hash = Math.abs(drama.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 100));
        PlayerState.likeCounts[dramaKey] = ((hash % 85) + 12).toFixed(1) + 'k';
    }
    PlayerState.isLiked = false;
    if (elements.playerLikeIcon) elements.playerLikeIcon.textContent = '🤍';
    if (elements.playerLikeBtn) elements.playerLikeBtn.classList.remove('liked');
    if (elements.playerLikeCount) elements.playerLikeCount.textContent = PlayerState.likeCounts[dramaKey];
}

function toggleLike() {
    PlayerState.isLiked = !PlayerState.isLiked;
    if (elements.playerLikeBtn) {
        elements.playerLikeBtn.classList.toggle('liked', PlayerState.isLiked);
    }
    if (elements.playerLikeIcon) {
        elements.playerLikeIcon.textContent = PlayerState.isLiked ? '❤️' : '🤍';
    }
    if (PlayerState.isLiked) {
        triggerHeartBubble();
    }
}

/**
 * Audio Mute Toggle
 */
function toggleMute() {
    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
    PlayerState.isMuted = videoEl.muted;

    if (elements.playerMuteIcon) {
        elements.playerMuteIcon.textContent = videoEl.muted ? '🔇' : '🔊';
    }
    if (elements.playerMuteLabel) {
        elements.playerMuteLabel.textContent = videoEl.muted ? 'Muted' : 'Sound';
    }
}

/**
 * Slide-Up Bottom Episodes Drawer
 */
function openEpisodesSheet() {
    if (!elements.reelEpisodesSheet) return;
    elements.reelEpisodesSheet.classList.add('active');
    if (elements.reelPlayerContainer) {
        elements.reelPlayerContainer.classList.remove('controls-hidden');
    }
    if (PlayerState.controlsHideTimer) {
        clearTimeout(PlayerState.controlsHideTimer);
        PlayerState.controlsHideTimer = null;
    }
    renderEpisodesSheet(PlayerState.episodes, PlayerState.currentEpisodeNumber);
}

function closeSheetRangeMenu() {
    if (elements.sheetRangeMenu) elements.sheetRangeMenu.style.display = 'none';
    if (elements.sheetRangeTrigger) {
        elements.sheetRangeTrigger.classList.remove('open');
        elements.sheetRangeTrigger.setAttribute('aria-expanded', 'false');
    }
}

function closeEpisodesSheet() {
    if (!elements.reelEpisodesSheet) return;
    elements.reelEpisodesSheet.classList.remove('active');
    closeSheetRangeMenu();
    resetPlayerControlsTimer();
}

function renderEpisodesSheet(episodes, activeEpisodeNum) {
    if (!elements.playerEpisodesStrip) return;

    const drama = PlayerState.currentDrama;
    const rawList = (episodes && episodes.length > 0)
        ? episodes
        : (drama && drama.episodeList && drama.episodeList.length > 0 ? drama.episodeList : []);
    const totalCount = rawList.length > 0
        ? rawList.length
        : (drama?.episodes || 60);

    const fullEpisodeList = rawList.length > 0
        ? rawList
        : Array.from({ length: totalCount }, (_, i) => ({ number: i + 1, url: getEpisodeWatchUrl(drama?.url || '', i + 1) }));

    if (elements.sheetEpTotal) {
        elements.sheetEpTotal.textContent = `${totalCount} Episodes`;
    }

    const GROUP_SIZE = 24;
    const EYE_ICON_SVG = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    const activeNum = Number(activeEpisodeNum) || PlayerState.currentEpisodeNumber || 1;
    const groupsCount = Math.ceil(fullEpisodeList.length / GROUP_SIZE);
    let activeGroupIndex = Math.floor((activeNum - 1) / GROUP_SIZE);
    if (activeGroupIndex < 0 || activeGroupIndex >= groupsCount) {
        activeGroupIndex = 0;
    }

    let filterText = (elements.sheetEpisodesSearchInput ? elements.sheetEpisodesSearchInput.value : '').trim().toLowerCase();

    function closeRangeMenu() {
        closeSheetRangeMenu();
    }

    function toggleRangeMenu() {
        if (!elements.sheetRangeMenu) return;
        const isOpen = elements.sheetRangeMenu.style.display !== 'none';
        if (isOpen) {
            closeRangeMenu();
        } else {
            elements.sheetRangeMenu.style.display = 'flex';
            if (elements.sheetRangeTrigger) {
                elements.sheetRangeTrigger.classList.add('open');
                elements.sheetRangeTrigger.setAttribute('aria-expanded', 'true');
            }
        }
    }

    function renderRangeDropdown() {
        const wrapEl = elements.sheetRangeSelectWrap;
        const triggerEl = elements.sheetRangeTrigger;
        const triggerTextEl = elements.sheetRangeTriggerText;
        const menuEl = elements.sheetRangeMenu;

        if (groupsCount <= 1) {
            if (wrapEl) wrapEl.style.display = 'none';
            closeRangeMenu();
            return;
        }

        if (activeGroupIndex < 0 || activeGroupIndex >= groupsCount) {
            activeGroupIndex = 0;
        }

        if (wrapEl && triggerEl && menuEl) {
            const currentStart = activeGroupIndex * GROUP_SIZE + 1;
            const currentEnd = Math.min((activeGroupIndex + 1) * GROUP_SIZE, fullEpisodeList.length);
            if (triggerTextEl) {
                triggerTextEl.textContent = `${currentStart} - ${currentEnd}`;
            }

            wrapEl.style.display = 'inline-flex';

            const CHECKMARK_SVG = `<svg class="detail-range-item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            const itemsHtml = Array.from({ length: groupsCount }, (_, i) => {
                const start = i * GROUP_SIZE + 1;
                const end = Math.min((i + 1) * GROUP_SIZE, fullEpisodeList.length);
                const isActive = i === activeGroupIndex;
                return `
                    <button class="detail-range-item${isActive ? ' active' : ''}" type="button" data-group-index="${i}" role="option" aria-selected="${isActive}">
                        <span class="detail-range-item-text">${start} - ${end}</span>
                        ${isActive ? CHECKMARK_SVG : ''}
                    </button>
                `;
            }).join('');

            menuEl.innerHTML = itemsHtml;

            menuEl.querySelectorAll('.detail-range-item').forEach(item => {
                item.onclick = (e) => {
                    e.stopPropagation();
                    const gIdx = parseInt(item.getAttribute('data-group-index'), 10) || 0;
                    activeGroupIndex = gIdx;
                    closeRangeMenu();
                    renderActiveEpisodes();
                };
            });

            triggerEl.onclick = (e) => {
                e.stopPropagation();
                toggleRangeMenu();
            };
        }
    }

    function renderActiveEpisodes() {
        const prog = UserDataManager.getDramaProgress(PlayerState.currentDrama);
        const watchedList = Array.isArray(prog.watchedList) ? prog.watchedList : [];
        let displayList = fullEpisodeList;
        const isFiltered = Boolean(filterText);

        if (isFiltered) {
            displayList = fullEpisodeList.filter((ep, idx) => {
                const epNum = typeof ep.number === 'number'
                    ? ep.number
                    : parseInt(String(ep.number || '').replace(/\D+/g, ''), 10) || (idx + 1);
                const numStr = String(epNum);
                const titleStr = (ep.title || `Episode ${epNum}`).toLowerCase();
                return numStr.includes(filterText) || titleStr.includes(filterText);
            });
            closeRangeMenu();
            if (elements.sheetRangeSelectWrap) {
                elements.sheetRangeSelectWrap.style.display = 'none';
            }
        } else {
            if (fullEpisodeList.length > GROUP_SIZE) {
                const startIdx = activeGroupIndex * GROUP_SIZE;
                const endIdx = Math.min(startIdx + GROUP_SIZE, fullEpisodeList.length);
                displayList = fullEpisodeList.slice(startIdx, endIdx);
                renderRangeDropdown();
            } else {
                displayList = fullEpisodeList;
                closeRangeMenu();
                if (elements.sheetRangeSelectWrap) {
                    elements.sheetRangeSelectWrap.style.display = 'none';
                }
            }
        }

        const gridEl = elements.playerEpisodesStrip;
        if (!gridEl) return;

        if (displayList.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 36px 16px; text-align: center; color: var(--text-muted); font-size: 14px;">
                    No episodes found matching "${escapeHtml(filterText)}"
                </div>
            `;
            return;
        }

        const html = displayList.map((ep, sliceIdx) => {
            const globalIdx = isFiltered ? fullEpisodeList.indexOf(ep) : (activeGroupIndex * GROUP_SIZE + sliceIdx);
            const epNum = typeof ep.number === 'number'
                ? ep.number
                : (parseInt(String(ep.number || '').replace(/\D+/g, ''), 10) || (globalIdx >= 0 ? globalIdx + 1 : sliceIdx + 1));
            const isWatched = watchedList.includes(epNum);
            const isActive = PlayerState.currentEpisodeNumber === epNum;

            const classes = ['sheet-ep-btn'];
            if (isActive) classes.push('active');
            if (isWatched) classes.push('watched');

            const title = isActive
                ? `Episode ${epNum} (Playing)`
                : (isWatched ? `Episode ${epNum} (Watched — Press and hold to toggle)` : `Episode ${epNum} (Press and hold to mark watched)`);

            const statusBadgeHtml = isActive
                ? `<span class="sheet-ep-playing-badge">▶</span>`
                : (isWatched ? `<span class="sheet-ep-eye-badge" title="Watched" aria-label="Watched">${EYE_ICON_SVG}</span>` : `<span></span>`);

            return `
                <button class="${classes.join(' ')}" type="button" data-ep="${epNum}" data-ep-url="${escapeHtml(ep.url || '')}" title="${escapeHtml(title)}">
                    <div class="sheet-ep-num-box">${epNum}</div>
                    <div class="sheet-ep-status-badge">${statusBadgeHtml}</div>
                </button>
            `;
        }).join('');

        gridEl.innerHTML = html;

        // Attach press-and-hold and click listeners to sheet episode buttons
        gridEl.querySelectorAll('.sheet-ep-btn').forEach(btn => {
            const ep = parseInt(btn.getAttribute('data-ep'), 10) || 1;
            const epUrl = btn.getAttribute('data-ep-url') || '';

            setupEpisodeButtonInteraction(btn, {
                onPlay: () => {
                    if (PlayerState.currentDrama) {
                        closeEpisodesSheet();
                        const targetUrl = epUrl || getEpisodeWatchUrl(PlayerState.currentDrama.url, ep);
                        playEpisode(PlayerState.currentDrama, ep, targetUrl);
                    }
                },
                onToggleWatched: () => {
                    if (!PlayerState.currentDrama) return;
                    const nowWatched = UserDataManager.toggleEpisodeWatched(PlayerState.currentDrama, ep);
                    btn.classList.toggle('watched', nowWatched);
                    const statusBadge = btn.querySelector('.sheet-ep-status-badge');
                    if (statusBadge) {
                        const isCurrentlyActive = btn.classList.contains('active');
                        statusBadge.innerHTML = isCurrentlyActive
                            ? `<span class="sheet-ep-playing-badge">▶</span>`
                            : (nowWatched ? `<span class="sheet-ep-eye-badge" title="Watched" aria-label="Watched">${EYE_ICON_SVG}</span>` : `<span></span>`);
                    }
                    showToast(nowWatched ? `Marked EP ${ep} as watched` : `Marked EP ${ep} as unwatched`, nowWatched ? 'success' : 'info');
                }
            });
        });

        // Auto-scroll active episode into center view if in current group
        const activeBtn = gridEl.querySelector('.sheet-ep-btn.active');
        if (activeBtn) {
            setTimeout(() => {
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
        }
    }

    if (elements.sheetEpisodesSearchInput) {
        elements.sheetEpisodesSearchInput.oninput = () => {
            filterText = elements.sheetEpisodesSearchInput.value.trim().toLowerCase();
            renderActiveEpisodes();
        };
    }

    renderActiveEpisodes();
}

/**
 * Display player error overlay
 */
function showPlayerError(msg) {
    showPlayerBuffering(false);
    if (elements.playerErrorOverlay) elements.playerErrorOverlay.style.display = 'flex';
    if (elements.playerErrorText) elements.playerErrorText.textContent = msg;
}

/**
 * Close streaming player and cleanup
 */
function closePlayer() {
    showPlayerBuffering(false);
    closeEpisodesSheet();
    closeSheetRangeMenu();
    toggleQualityMenu(false);
    if (PlayerState.controlsHideTimer) {
        clearTimeout(PlayerState.controlsHideTimer);
        PlayerState.controlsHideTimer = null;
    }
    if (elements.reelPlayerContainer) {
        elements.reelPlayerContainer.classList.remove('controls-hidden');
    }
    if (PlayerState.hls) {
        PlayerState.hls.destroy();
        PlayerState.hls = null;
    }
    if (elements.playerVideoElement) {
        elements.playerVideoElement.pause();
        elements.playerVideoElement.removeAttribute('src');
        elements.playerVideoElement.load();
    }
    // Clear playing state so the detail page no longer highlights any episode as active
    PlayerState.currentDrama = null;
    PlayerState.currentEpisodeNumber = null;
    closeModal(elements.playerModal);
}

/**
 * Play Next Episode
 */
function playNextEpisode(isSeamless = false) {
    if (!PlayerState.currentDrama) return;
    const nextEp = PlayerState.currentEpisodeNumber + 1;
    const maxEp = PlayerState.episodes.length || PlayerState.currentDrama.episodes || 100;
    if (nextEp <= maxEp) {
        const nextUrl = getEpisodeWatchUrl(PlayerState.currentDrama.url, nextEp);
        playEpisode(PlayerState.currentDrama, nextEp, nextUrl, false, isSeamless);
    } else {
        showToast('Reached the final episode of this drama!');
    }
}

/**
 * Play Previous Episode
 */
function playPrevEpisode(isSeamless = false) {
    if (!PlayerState.currentDrama) return;
    const prevEp = PlayerState.currentEpisodeNumber - 1;
    if (prevEp >= 1) {
        const prevUrl = getEpisodeWatchUrl(PlayerState.currentDrama.url, prevEp);
        playEpisode(PlayerState.currentDrama, prevEp, prevUrl, false, isSeamless);
    }
}

/**
 * Update Next / Prev button states
 */
function updatePlayerNavButtons() {
    const cur = PlayerState.currentEpisodeNumber;
    const total = PlayerState.episodes.length || (PlayerState.currentDrama && PlayerState.currentDrama.episodes) || 60;
    
    if (elements.playerPrevEpBtn) {
        elements.playerPrevEpBtn.style.opacity = cur <= 1 ? '0.3' : '1';
        elements.playerPrevEpBtn.style.pointerEvents = cur <= 1 ? 'none' : 'auto';
    }
    if (elements.playerNextEpBtn) {
        elements.playerNextEpBtn.style.opacity = cur >= total ? '0.3' : '1';
        elements.playerNextEpBtn.style.pointerEvents = cur >= total ? 'none' : 'auto';
    }
}

function formatTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}



function sortAndRender() {
    if (!elements.sortSelect) return;
    AppState.sortOrder = elements.sortSelect.value;
    localStorage.setItem('nd_sort_order', AppState.sortOrder);
    renderAnimeCards(AppState.results, AppState.currentQuery);
}

/**
 * Proxy configuration settings
 */
function setupProxySettings() {
    if (elements.proxySelect) {
        elements.proxySelect.value = AppState.proxyMethod;
    }
    if (elements.customProxyInput) {
        elements.customProxyInput.value = AppState.customProxy;
    }
    if (elements.ndSessionCookieInput) {
        elements.ndSessionCookieInput.value = localStorage.getItem('nd_session_cookie') || '';
    }
    if (elements.customProxyWrap) {
        elements.customProxyWrap.style.display = AppState.proxyMethod === 'custom' ? 'block' : 'none';
    }
}

function saveProxySettings() {
    if (elements.proxySelect) AppState.proxyMethod = elements.proxySelect.value;
    if (elements.customProxyInput) AppState.customProxy = elements.customProxyInput.value.trim();
    if (elements.ndSessionCookieInput) {
        localStorage.setItem('nd_session_cookie', elements.ndSessionCookieInput.value.trim());
    }
    localStorage.setItem('nd_proxy_method', AppState.proxyMethod);
    localStorage.setItem('nd_custom_proxy', AppState.customProxy);

    closeModal(elements.proxyModal);
    showToast('Settings saved!');
}

/**
 * UI State Visibility Helpers
 */
function showLoading() {
    hideAllResults();
    if (AppState.mode !== 'detail' && AppState.mode !== 'bookmarks') {
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'flex';
        if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
        if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    }
    if (elements.skeletonGrid) elements.skeletonGrid.style.display = 'grid';
}

function showEmpty(queryText = '', providerLabel = '') {
    hideAllResults();
    if (AppState.mode !== 'detail' && AppState.mode !== 'bookmarks') {
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'flex';
        if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
        if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    }
    if (elements.emptyState) {
        elements.emptyState.style.display = 'block';
        const pLabel = providerLabel || getProviderLabel(AppState.activeProvider);
        const descEl = elements.emptyState.querySelector('.state-desc');
        if (descEl) {
            descEl.textContent = queryText 
                ? `No dramas found for "${queryText}" in ${pLabel}. Try another search term or switch provider above.`
                : `No dramas currently available for ${pLabel}. Switch to another provider above.`;
        }
    }
}

function showError(message) {
    hideAllResults();
    if (AppState.mode !== 'detail' && AppState.mode !== 'bookmarks') {
        if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'flex';
        if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
        if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    }
    if (elements.errorState) elements.errorState.style.display = 'block';
    if (elements.errorDesc) elements.errorDesc.textContent = message || 'An error occurred while fetching drama data.';
}

function hideAllResults() {
    if (elements.sectionHeaderBlock) elements.sectionHeaderBlock.style.display = 'none';
    if (elements.resultsBar) elements.resultsBar.style.display = 'none';
    if (elements.skeletonGrid) elements.skeletonGrid.style.display = 'none';
    if (elements.animeGrid) elements.animeGrid.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.errorState) elements.errorState.style.display = 'none';
    if (elements.contentContainer) elements.contentContainer.style.display = 'none';
    if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'none';
}

function openModal(modal) {
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            const hasActiveModal = document.querySelector('.modal-overlay.active');
            if (!hasActiveModal) {
                document.body.classList.remove('modal-open');
            }
        }, 10);
    }
}

/**
 * Toast Notification Helper
 */
function showToast(message) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span><span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Fetch with custom timeout
 */
function fetchWithTimeout(resource, options = {}) {
    const { timeout = 12000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => {
        try {
            controller.abort(new Error(`Timed out after ${Math.round(timeout / 1000)}s`));
        } catch (_) {
            controller.abort();
        }
    }, timeout);

    return fetch(resource, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(id));
}

// Escape HTML utility
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Get initials for fallback poster
function getInitials(str) {
    return (str || '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0] ? w[0].toUpperCase() : '')
        .join('') || '?';
}

/**
 * Progressive Web App (PWA) Controller
 * Fully relative paths for GitHub Pages subfolder compatibility
 */
let deferredInstallPrompt = null;

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js', { scope: './' })
                .then((reg) => {
                    // Service worker registered
                })
                .catch((err) => {
                    console.log('[PWA SW Registration Note]', err.message);
                });
        });
    }
}

function setupPwaInstall() {
    // Detect if already installed/running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true ||
                         document.referrer.includes('android-app://');

    // On Zen Browser, Firefox, Safari, and other browsers without beforeinstallprompt,
    // ensure the install button remains visible unless already running in standalone mode!
    if (elements.pwaInstallBtn) {
        elements.pwaInstallBtn.style.display = isStandalone ? 'none' : 'inline-flex';
    }

    // Capture Chromium beforeinstallprompt if available
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (elements.pwaInstallBtn && !isStandalone) {
            elements.pwaInstallBtn.style.display = 'inline-flex';
        }
    });

    if (elements.pwaInstallBtn) {
        elements.pwaInstallBtn.addEventListener('click', async () => {
            if (deferredInstallPrompt) {
                // Native Chromium install flow (Chrome, Edge, Android Chrome)
                deferredInstallPrompt.prompt();
                const { outcome } = await deferredInstallPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('🎉 Installing ReelDrama app...');
                }
                deferredInstallPrompt = null;
                elements.pwaInstallBtn.style.display = 'none';
            } else {
                // Non-Chromium browser flow (Zen Browser, Firefox Desktop, Firefox Android, Safari iOS/macOS)
                showPwaInstallGuide();
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        if (elements.pwaInstallBtn) {
            elements.pwaInstallBtn.style.display = 'none';
        }
        showToast('🎉 ReelDrama app installed successfully!');
    });
}

/**
 * Universal PWA Install Guidance for Zen Browser, Firefox, Safari, and other environments
 */
function showPwaInstallGuide() {
    if (!elements.pwaGuideContent || !elements.pwaGuideModal) return;

    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isFirefox = /Firefox|FxiOS/i.test(ua);
    const isZen = /Zen/i.test(ua) || (isFirefox && (ua.includes('Zen') || navigator.vendor?.includes('Zen')));
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|Edg/i.test(ua);

    let headerHtml = '';
    let steps = [];

    if (isZen || (isFirefox && !isMobile)) {
        headerHtml = `
            <div class="pwa-guide-header">
                <span class="pwa-guide-badge">🌀</span>
                <div>
                    <h4 class="pwa-guide-title">Zen Browser &amp; Firefox Desktop</h4>
                    <p class="pwa-guide-subtitle">Use ReelDrama as a standalone web app or pinned tab</p>
                </div>
            </div>
        `;
        steps = [
            '<strong>Zen Web App Mode:</strong> In Zen Browser, click the <strong>Page Actions</strong> (or <code>···</code>) icon in the address bar and choose <strong>"Add as Web App"</strong> or <strong>"Add to Sidebar"</strong>.',
            '<strong>Pin Tab for Instant 1-Click Access:</strong> Right-click the ReelDrama tab and choose <strong>"Pin Tab"</strong> to keep your dramas always open.',
            '<strong>Firefox PWA Extension (Optional):</strong> If you use the <em>Progressive Web Apps for Firefox</em> extension, click the PWA icon in the address bar to install in a standalone desktop window.'
        ];
    } else if (isFirefox && isMobile) {
        headerHtml = `
            <div class="pwa-guide-header">
                <span class="pwa-guide-badge">🦊</span>
                <div>
                    <h4 class="pwa-guide-title">Firefox Mobile (Android)</h4>
                    <p class="pwa-guide-subtitle">Add ReelDrama directly to your home screen</p>
                </div>
            </div>
        `;
        steps = [
            'Tap the <strong>three dots (⋮)</strong> menu button next to the address bar.',
            'Select <strong>"Install"</strong> or <strong>"Add to Home screen"</strong>.',
            'Tap <strong>Add</strong> to launch ReelDrama in full-screen mode anytime!'
        ];
    } else if (isIOS || isSafari) {
        headerHtml = `
            <div class="pwa-guide-header">
                <span class="pwa-guide-badge">🍏</span>
                <div>
                    <h4 class="pwa-guide-title">Safari &amp; Apple Devices</h4>
                    <p class="pwa-guide-subtitle">Add to Home Screen or Dock</p>
                </div>
            </div>
        `;
        steps = isMobile ? [
            'Tap the <strong>Share</strong> button (the square with an arrow <strong>⎋</strong>) at the bottom of Safari.',
            'Scroll down and select <strong>"Add to Home Screen"</strong> (➕).',
            'Tap <strong>Add</strong> in the top-right corner to install.'
        ] : [
            'Click <strong>File</strong> in the macOS menu bar at the top of your screen.',
            'Select <strong>"Add to Dock..."</strong>.',
            'Click <strong>Add</strong> to run ReelDrama as a dedicated macOS app.'
        ];
    } else {
        headerHtml = `
            <div class="pwa-guide-header">
                <span class="pwa-guide-badge">⬇️</span>
                <div>
                    <h4 class="pwa-guide-title">Install ReelDrama App</h4>
                    <p class="pwa-guide-subtitle">Fast, lightweight, and works offline</p>
                </div>
            </div>
        `;
        steps = [
            'Look for the <strong>Install App icon (💻 or ⊕)</strong> in your browser\'s address bar.',
            'Or open your browser menu (<code>⋮</code> or <code>···</code>) and select <strong>"Install ReelDrama..."</strong> or <strong>"Create Shortcut..."</strong>.',
            'Select <strong>Open as window</strong> and click Install.'
        ];
    }

    const stepsHtml = steps.map((s, idx) => `
        <li class="pwa-step-item">
            <span class="pwa-step-num">${idx + 1}</span>
            <div class="pwa-step-text">${s}</div>
        </li>
    `).join('');

    elements.pwaGuideContent.innerHTML = `
        ${headerHtml}
        <ul class="pwa-step-list">
            ${stepsHtml}
        </ul>
    `;

    openModal(elements.pwaGuideModal);
}

