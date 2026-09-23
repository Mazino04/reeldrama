/**
 * AnimeDrama - Main Application Controller
 * Optimized & Clean:
 * - On-demand fetching: Only 1 request on search, and 1 request on card click (~350ms)
 * - Zero background batch spam
 * - Silent console (only true network failures logged)
 */

// Application State & Caches
const AppState = {
    mode: 'home', // 'home' | 'results'
    currentQuery: '',
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
    lastTapTime: 0
};

// Safe DOM Element Selector
function getEl(id) {
    return document.getElementById(id);
}

// Elements Cache
const elements = {
    body: document.body,
    navBrand: getEl('nav-brand'),
    pwaInstallBtn: getEl('pwa-install-btn'),
    pwaGuideModal: getEl('pwa-guide-modal'),
    pwaGuideContent: getEl('pwa-guide-content'),
    pwaGuideCloseBtn: getEl('pwa-guide-close-btn'),
    pwaGuideOkBtn: getEl('pwa-guide-ok-btn'),
    heroLogo: getEl('hero-logo'),
    heroSection: getEl('hero-section'),
    searchForm: getEl('search-form'),
    searchInput: getEl('search-input'),
    searchClearBtn: getEl('search-clear-btn'),
    searchHints: document.querySelectorAll('.search-hint-pill'),
    
    // Results & Controls
    resultsBar: getEl('results-bar'),
    resultsQuery: getEl('results-query'),
    resultsCount: getEl('results-count'),
    sortSelect: getEl('sort-select'),
    contentContainer: getEl('content-container'),
    animeGrid: getEl('anime-grid'),
    skeletonGrid: getEl('skeleton-grid'),
    emptyState: getEl('empty-state'),
    errorState: getEl('error-state'),
    errorDesc: getEl('error-desc'),
    retryBtn: getEl('retry-btn'),
    openPasteFromError: getEl('open-paste-from-error'),

    // Quick View Modal
    quickViewModal: getEl('quick-view-modal'),
    quickViewCloseBtn: getEl('quick-view-close'),
    quickViewPoster: getEl('quick-view-poster'),
    quickViewTitle: getEl('quick-view-title'),
    quickViewMeta: getEl('quick-view-meta'),
    quickViewDesc: getEl('quick-view-desc'),
    quickViewEpisodesCount: getEl('quick-view-ep-count'),
    quickViewEpisodesLoading: getEl('quick-view-episodes-loading'),
    quickViewEpisodesGrid: getEl('quick-view-episodes-grid'),
    quickViewStreamBtn: getEl('quick-view-stream-btn'),

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
    playerCloseBtn: getEl('player-close-btn'),
    playerCloseBtnAlt: getEl('player-close-btn-alt'),
    playerLikeBtn: getEl('player-like-btn'),
    playerLikeIcon: getEl('player-like-icon'),
    playerLikeCount: getEl('player-like-count'),
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
    playerEpisodesStrip: getEl('player-episodes-strip'),

    // Paste HTML Modal (Optional)
    pasteModal: getEl('paste-modal'),
    openPasteBtn: getEl('btn-open-paste'),
    pasteCloseBtn: getEl('paste-close-btn'),
    pasteCancelBtn: getEl('paste-cancel-btn'),
    pasteSubmitBtn: getEl('paste-submit-btn'),
    pasteTextarea: getEl('paste-textarea'),

    // Proxy Settings Modal (Optional)
    proxyModal: getEl('proxy-modal'),
    openProxyBtn: getEl('btn-open-proxy'),
    proxyCloseBtn: getEl('proxy-close-btn'),
    proxySelect: getEl('proxy-select'),
    customProxyWrap: getEl('custom-proxy-wrap'),
    customProxyInput: getEl('custom-proxy-input'),
    saveProxyBtn: getEl('save-proxy-btn'),

    // Toast Container
    toastContainer: getEl('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupProxySettings();
    registerServiceWorker();
    setupPwaInstall();

    // Check if URL has ?q= parameter
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    if (initialQuery && initialQuery.trim()) {
        if (elements.searchInput) {
            elements.searchInput.value = initialQuery.trim();
        }
        if (elements.searchClearBtn) {
            elements.searchClearBtn.classList.add('visible');
        }
        triggerDynamicSearch(initialQuery.trim());
    } else {
        // Initial state: Pure minimalist homepage with ONLY logo and search bar
        setAppMode('home');
    }
});

// Event Listeners Setup
function setupEventListeners() {
    // Brand click: Reset back to clean homepage
    if (elements.navBrand) {
        elements.navBrand.addEventListener('click', resetToHomePage);
    }
    if (elements.heroLogo) {
        elements.heroLogo.addEventListener('click', resetToHomePage);
    }

    // Search Form Submit
    if (elements.searchForm) {
        elements.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = elements.searchInput ? elements.searchInput.value.trim() : '';
            if (query) {
                triggerDynamicSearch(query);
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
                    triggerDynamicSearch(query);
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
            if (AppState.currentQuery) {
                triggerDynamicSearch(AppState.currentQuery, true);
            }
        });
    }

    if (elements.openPasteFromError) {
        elements.openPasteFromError.addEventListener('click', () => openModal(elements.pasteModal));
    }

    // Modal Events - Quick View
    if (elements.quickViewCloseBtn) {
        elements.quickViewCloseBtn.addEventListener('click', closeQuickView);
    }
    if (elements.quickViewModal) {
        elements.quickViewModal.addEventListener('click', (e) => {
            if (e.target === elements.quickViewModal) closeQuickView();
        });
    }
    if (elements.quickViewStreamBtn) {
        elements.quickViewStreamBtn.addEventListener('click', () => {
            if (AppState.selectedDrama) {
                const ep1Url = (AppState.selectedDrama.episodeList && AppState.selectedDrama.episodeList[0]) 
                    ? AppState.selectedDrama.episodeList[0].url 
                    : getEpisodeWatchUrl(AppState.selectedDrama.url, 1);
                playEpisode(AppState.selectedDrama, 1, ep1Url);
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
            playPrevEpisode();
        });
    }
    if (elements.playerNextEpBtn) {
        elements.playerNextEpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playNextEpisode();
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

    // Modal Events - Paste HTML
    if (elements.openPasteBtn) {
        elements.openPasteBtn.addEventListener('click', () => openModal(elements.pasteModal));
    }
    if (elements.pasteCloseBtn) {
        elements.pasteCloseBtn.addEventListener('click', () => closeModal(elements.pasteModal));
    }
    if (elements.pasteCancelBtn) {
        elements.pasteCancelBtn.addEventListener('click', () => closeModal(elements.pasteModal));
    }
    if (elements.pasteSubmitBtn) {
        elements.pasteSubmitBtn.addEventListener('click', handlePasteHtml);
    }

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
            closePlayer();
            closeQuickView();
            closeModal(elements.pasteModal);
            closeModal(elements.proxyModal);
            closeModal(elements.pwaGuideModal);
        }
    });
}

/**
 * Switch View Mode: 'home' (only logo + search bar) vs 'results' (compact search + anime cards)
 */
function setAppMode(mode) {
    AppState.mode = mode;
    if (elements.body) {
        elements.body.className = mode === 'home' ? 'app-mode-home' : 'app-mode-results';
    }
    if (mode === 'home') {
        hideAllResults();
    }
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
    AppState.results = [];
    window.history.pushState({}, '', window.location.pathname);
    setAppMode('home');
}

/**
 * Trigger dynamic search to Narto Drama with Instant Caching
 * Only 1 single network request is made!
 */
async function triggerDynamicSearch(query, bypassCache = false) {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    AppState.currentQuery = cleanQuery;

    // Update URL query parameter without full reload
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(cleanQuery)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Transition view to results mode
    setAppMode('results');

    // Invalidate any ongoing background resolution from prior search
    AppState.currentSearchSessionId = (AppState.currentSearchSessionId || 0) + 1;
    const sessionId = AppState.currentSearchSessionId;

    // Check In-Memory Cache first for instant 0ms display
    const cacheKey = cleanQuery.toLowerCase();
    if (!bypassCache && SearchCache.has(cacheKey)) {
        AppState.results = SearchCache.get(cacheKey);
        renderAnimeCards(AppState.results, cleanQuery);
        resolveAllCardEpisodes(AppState.results, sessionId);
        return;
    }

    showLoading();

    const targetUrl = `https://narto-drama.com/search?lang=en-US&q=${encodeURIComponent(cleanQuery)}`;

    try {
        const { html } = await fetchFastHtml(targetUrl);

        // Parse HTML document with DramaParser
        const parsed = DramaParser.parse(html, 'https://narto-drama.com');
        AppState.results = parsed.items || [];

        // Save to cache
        SearchCache.set(cacheKey, AppState.results);

        if (AppState.results.length === 0) {
            showEmpty();
        } else {
            renderAnimeCards(AppState.results, cleanQuery);
            resolveAllCardEpisodes(AppState.results, sessionId);
            showToast(`Loaded ${AppState.results.length} dramas`);
        }
    } catch (err) {
        console.error('[Search Failed]:', err.message);
        showError(`Could not fetch "${cleanQuery}" (${err.message}). Check CORS proxy settings or use "Paste HTML" below.`);
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
 * FAST Multi-Tier Fetch Pipeline:
 * Priority 1: DIRECT FETCH (Direct browser fetch in ~350ms)
 * Priority 2: AllOrigins JSON GET (CORS fallback)
 * Priority 3: CodeTabs Proxy
 */
async function fetchFastHtml(targetUrl) {
    if (DetailCache.has(targetUrl)) {
        return { html: DetailCache.get(targetUrl), source: 'Cache' };
    }

    const method = AppState.proxyMethod || 'auto';
    const pipeline = [];

    // Custom Proxy if configured by user
    if (AppState.customProxy && AppState.customProxy.trim()) {
        const customUrl = AppState.customProxy.replace('{url}', encodeURIComponent(targetUrl));
        pipeline.push({
            name: 'Custom Proxy',
            fetcher: async () => {
                const res = await fetchWithTimeout(customUrl, { timeout: 6000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return await res.text();
            }
        });
    }

    if (method === 'direct' || method === 'auto') {
        // DIRECT FETCH FIRST! (Direct browser fetch in ~350ms)
        pipeline.push({
            name: 'Direct Fetch',
            fetcher: async () => {
                const res = await fetchWithTimeout(targetUrl, { mode: 'cors', timeout: 5000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return await res.text();
            }
        });
    }

    if (method === 'allorigins' || method === 'auto') {
        // AllOrigins Fallback (3.5s timeout)
        pipeline.push({
            name: 'AllOrigins',
            fetcher: async () => {
                const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, { timeout: 4000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const data = await res.json();
                if (!data || !data.contents) throw new Error('Empty response contents');
                return data.contents;
            }
        });
    }

    if (method === 'codetabs' || method === 'auto') {
        // CodeTabs Fallback (3.5s timeout)
        pipeline.push({
            name: 'CodeTabs',
            fetcher: async () => {
                const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, { timeout: 4000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                return await res.text();
            }
        });
    }

    let lastError = null;

    for (const step of pipeline) {
        try {
            const html = await step.fetcher();
            if (html && html.length > 300) {
                DetailCache.set(targetUrl, html);
                return { html, source: step.name };
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error(`[Fetch Failed] ${step.name}:`, e.message);
            }
            lastError = e;
        }
    }

    throw lastError || new Error('All fetch methods failed.');
}

/**
 * Format total episode label
 */
function getEpisodeTotalText(item) {
    if (item.episodes && item.episodes > 0) {
        return `${item.episodes} Episodes`;
    }
    if (item.episodeList && item.episodeList.length > 0) {
        return `${item.episodeList.length} Episodes`;
    }
    return '... Eps';
}

/**
 * Render Anime Cards into Grid
 */
function renderAnimeCards(items, queryText = '') {
    hideAllResults();
    if (elements.resultsBar) elements.resultsBar.style.display = 'flex';
    if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    if (elements.animeGrid) elements.animeGrid.style.display = 'grid';

    if (elements.resultsQuery) {
        elements.resultsQuery.innerHTML = queryText ? `Search results for <strong>"${escapeHtml(queryText)}"</strong>` : 'Dramas';
    }
    if (elements.resultsCount) {
        elements.resultsCount.textContent = `${items.length} dramas`;
    }

    if (elements.animeGrid) {
        elements.animeGrid.innerHTML = items.map((item, index) => createAnimeCardHtml(item, index)).join('');
    }

    // Attach click handlers
    items.forEach((item, index) => {
        const cardEl = document.getElementById(`anime-card-${index}`);
        if (cardEl) {
            // Click to open quick view, or click play circle to play Episode 1 directly
            cardEl.addEventListener('click', (e) => {
                if (e.target.closest('.btn-play-circle')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const ep1Url = (item.episodeList && item.episodeList[0]) 
                        ? item.episodeList[0].url 
                        : getEpisodeWatchUrl(item.url, 1);
                    playEpisode(item, 1, ep1Url);
                    return;
                }
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
    const badgeEl = document.getElementById(`card-ep-badge-${index}`);
    if (!badgeEl) return;
    badgeEl.classList.remove('badge-resolving');
    if (count && count > 0) {
        badgeEl.textContent = `🎬 ${count} Episodes`;
    } else {
        badgeEl.textContent = '🎬 Full Drama';
    }
}

/**
 * Generate HTML for an Anime Card
 */
function createAnimeCardHtml(item, index) {
    const title = escapeHtml(item.title || 'Untitled Drama');
    const poster = item.poster || '';
    const hasEpisodes = (item.episodes && item.episodes > 0) || (item.episodeList && item.episodeList.length > 0);
    const episodeTotalText = getEpisodeTotalText(item);
    const badgeClass = hasEpisodes ? 'card-badge-top-left' : 'card-badge-top-left badge-resolving';
    const typeBadge = (item.tags && item.tags.some(t => /dub/i.test(t))) ? 'DUB' : 'SUB';
    const watchUrl = item.url || '#';
    const tagsHtml = (item.tags || []).slice(0, 3).map(tag => 
        `<span class="card-tag">#${escapeHtml(tag)}</span>`
    ).join('');

    const posterMarkup = poster 
        ? `<img class="card-poster" src="${escapeHtml(poster)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">`
        : `<div class="card-poster-fallback">${getInitials(title)}</div>`;

    return `
        <article class="anime-card" id="anime-card-${index}" tabindex="0" role="button" aria-label="${title}">
            <div class="card-poster-wrap">
                <span class="${badgeClass}" id="card-ep-badge-${index}">🎬 ${escapeHtml(episodeTotalText)}</span>
                <span class="card-badge-top-right">${typeBadge}</span>
                ${posterMarkup}
                <div class="poster-gradient"></div>
                <div class="card-overlay-actions">
                    <button class="btn-play-circle" type="button" title="Play Episode 1">▶</button>
                </div>
            </div>
            <div class="card-body">
                <h3 class="card-title" title="${title}">${title}</h3>
                <div class="card-tags">
                    ${tagsHtml}
                </div>
                <div class="card-footer-action">
                    <span class="card-provider-text">HD Quality</span>
                    <button class="card-episodes-btn" type="button" title="View all episodes">
                        <span>📑</span> View Episodes
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Open Quick View Modal and DYNAMICALLY fetch real episodes in ~350ms
 * Only fires a single request when clicked!
 */
async function openQuickView(item, cardEl = null) {
    AppState.selectedDrama = item;

    if (elements.quickViewTitle) elements.quickViewTitle.textContent = item.title;
    if (elements.quickViewDesc) elements.quickViewDesc.textContent = item.description || 'Loading drama synopsis...';

    // Poster
    if (elements.quickViewPoster) {
        elements.quickViewPoster.src = item.poster || '';
        elements.quickViewPoster.alt = item.title;
        elements.quickViewPoster.onerror = () => {
            elements.quickViewPoster.src = 'https://via.placeholder.com/300x400/192033/ffffff?text=' + encodeURIComponent(item.title);
        };
    }

    // Metadata badges
    const episodeTotalText = getEpisodeTotalText(item);
    if (elements.quickViewMeta) {
        const tagsHtml = (item.tags || []).map(t => `<span class="detail-badge">#${escapeHtml(t)}</span>`).join('');
        elements.quickViewMeta.innerHTML = `
            <span class="detail-badge" id="quick-view-total-badge" style="background:rgba(0, 242, 254, 0.15); color:var(--accent-cyan); border-color:rgba(0, 242, 254, 0.3)">
                🎬 ${escapeHtml(episodeTotalText)}
            </span>
            ${tagsHtml}
        `;
    }

    openModal(elements.quickViewModal);

    // If episodes are ALREADY cached / parsed, render instantly in 0ms!
    if (item.episodeList && item.episodeList.length > 0) {
        renderEpisodesList(item.episodeList, item.episodes || item.episodeList.length);
        return;
    }

    // Otherwise, fetch the single drama detail HTML page (~350ms)
    if (elements.quickViewEpisodesGrid) elements.quickViewEpisodesGrid.innerHTML = '';
    if (elements.quickViewEpisodesLoading) elements.quickViewEpisodesLoading.style.display = 'flex';
    if (elements.quickViewEpisodesCount) elements.quickViewEpisodesCount.textContent = 'Loading...';

    try {
        const { html } = await fetchFastHtml(item.url);
        
        // Parse episodes from detail page HTML
        const detailData = DramaParser.parseEpisodesFromDetailPage(html, 'https://narto-drama.com');
        
        if (detailData.description && elements.quickViewDesc) {
            elements.quickViewDesc.textContent = detailData.description;
            item.description = detailData.description;
        }

        if (detailData.episodeList && detailData.episodeList.length > 0) {
            item.episodeList = detailData.episodeList;
            item.episodes = detailData.episodeCount || detailData.episodeList.length;
            renderEpisodesList(item.episodeList, item.episodes);
            
            // Update total badge in modal and card
            const totalBadge = getEl('quick-view-total-badge');
            if (totalBadge) {
                totalBadge.textContent = `🎬 ${item.episodes} Episodes`;
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
        console.error('[Episode Fetch Failed]:', epErr.message);
    }

    // Graceful fallback: Generate episode links from URL pattern
    if (elements.quickViewEpisodesLoading) elements.quickViewEpisodesLoading.style.display = 'none';
    const totalEps = item.episodes || 60;
    const cleanBase = (item.url || '').split('?')[0].replace(/\/+$/, '').replace(/\/\d+$/, '');
    const fallbackList = Array.from({ length: totalEps }, (_, i) => ({
        number: `EP ${i + 1}`,
        url: `${cleanBase}/${i + 1}?lang=en-US`
    }));

    item.episodeList = fallbackList;
    renderEpisodesList(fallbackList, totalEps);
}

function renderEpisodesList(episodeList, count) {
    if (elements.quickViewEpisodesLoading) elements.quickViewEpisodesLoading.style.display = 'none';
    if (elements.quickViewEpisodesCount) elements.quickViewEpisodesCount.textContent = `(${count || episodeList.length})`;

    const html = episodeList.map((ep, idx) => {
        const epNum = typeof ep.number === 'number' ? ep.number : (idx + 1);
        const epLabel = typeof ep.number === 'string' && ep.number.toUpperCase().startsWith('EP') ? ep.number : `EP ${epNum}`;
        return `<button class="episode-btn" type="button" data-ep-index="${idx}" data-ep-num="${epNum}" data-ep-url="${escapeHtml(ep.url)}">${escapeHtml(epLabel)}</button>`;
    }).join('');

    if (elements.quickViewEpisodesGrid) {
        elements.quickViewEpisodesGrid.innerHTML = html;
        // Attach click listeners to launch in-app player for that episode
        elements.quickViewEpisodesGrid.querySelectorAll('.episode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const epNum = parseInt(btn.getAttribute('data-ep-num'), 10) || 1;
                const epUrl = btn.getAttribute('data-ep-url') || '';
                if (AppState.selectedDrama) {
                    playEpisode(AppState.selectedDrama, epNum, epUrl);
                }
            });
        });
    }
}

function closeQuickView() {
    closeModal(elements.quickViewModal);
}

/**
 * ==========================================================================
 * STREAMING VIDEO PLAYER CONTROLLER
 * ==========================================================================
 */

/**
 * Dedicated helper to construct valid episode watch URLs
 * Formats: https://narto-drama.com/detail/watch/{slug}/{epNum}?lang=en-US
 */
function getEpisodeWatchUrl(dramaUrl, epNum = 1) {
    if (!dramaUrl) return '';
    let clean = dramaUrl.split('?')[0].replace(/\/+$/, '');
    clean = clean.replace(/\/\d+$/, '');
    return `${clean}/${epNum}?lang=en-US`;
}

/**
 * Play an episode in our in-app TikTok-style streaming player
 */
async function playEpisode(drama, episodeNumber, episodeUrl = '', forceRefresh = false) {
    if (!drama) return;

    const epNum = parseInt(episodeNumber, 10) || 1;
    PlayerState.currentDrama = drama;
    PlayerState.currentEpisodeNumber = epNum;

    // Deduce clean episode watch URL
    const cleanWatchUrl = getEpisodeWatchUrl(drama.url || episodeUrl, epNum);
    PlayerState.currentEpisodeUrl = cleanWatchUrl;

    // Update Player Modal UI
    if (elements.playerDramaTitle) elements.playerDramaTitle.textContent = drama.title;
    if (elements.playerEpIndicator) elements.playerEpIndicator.textContent = `EP ${epNum}`;
    if (elements.playerInfoTitle) elements.playerInfoTitle.textContent = drama.title;
    if (elements.playerInfoDesc) elements.playerInfoDesc.textContent = drama.description || 'Swipe up for next episode...';
    if (elements.playerErrorOverlay) elements.playerErrorOverlay.style.display = 'none';

    // Initialize Like State
    initLikeStateForDrama(drama);

    // Swipe hint animation (briefly displays, then fades out)
    if (elements.reelSwipeHint) {
        elements.reelSwipeHint.classList.remove('fade-out');
        clearTimeout(PlayerState.swipeHintTimer);
        PlayerState.swipeHintTimer = setTimeout(() => {
            if (elements.reelSwipeHint) elements.reelSwipeHint.classList.add('fade-out');
        }, 3200);
    }

    if (elements.playerBuffering) {
        elements.playerBuffering.style.display = 'flex';
        if (elements.playerBufferingText) elements.playerBufferingText.textContent = `Streaming EP ${epNum}...`;
    }

    // Update Next / Prev buttons
    updatePlayerNavButtons();

    // Open Player Modal
    openModal(elements.playerModal);

    // If stream data for this entire drama is ALREADY cached, instant playback!
    const dramaKey = (drama.url || '').split('?')[0].replace(/\/+$/, '').replace(/\/\d+$/, '');
    if (!forceRefresh && StreamCache.has(dramaKey)) {
        const cached = StreamCache.get(dramaKey);
        if (cached && cached.episodes && cached.episodes.length > 0) {
            PlayerState.episodes = cached.episodes;
            renderEpisodesSheet(PlayerState.episodes, epNum);

            const activeEp = cached.episodes.find(e => Number(e.number) === epNum);
            if (activeEp && activeEp.playUrl) {
                loadStreamInVideo(activeEp.playUrl, activeEp.isHls);
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

            if (targetUrl) {
                loadStreamInVideo(targetUrl, streamData.isHls);
                return;
            }
        } else if (streamData.streamUrl) {
            loadStreamInVideo(streamData.streamUrl, streamData.isHls);
            return;
        }

        // Stream URL could not be found
        showPlayerError('Video stream could not be extracted from this episode.');
    } catch (err) {
        console.error('[Stream Fetch Failed]:', err.message);
        showPlayerError(`Could not load episode stream (${err.message}). Tap Retry to try again.`);
    }
}

/**
 * Load and play a stream URL (.m3u8 or .mp4) in HTML5 video using adaptive Hls.js
 */
function loadStreamInVideo(streamUrl, isHlsHint = false) {
    if (!streamUrl) {
        showPlayerError('No video stream URL found for this episode.');
        return;
    }

    PlayerState.currentStreamUrl = streamUrl;
    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;

    // Reset previous HLS instance
    if (PlayerState.hls) {
        PlayerState.hls.destroy();
        PlayerState.hls = null;
    }

    // Reset video element
    videoEl.onerror = null;
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.removeAttribute('controls');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('x5-playsinline', '');
    videoEl.setAttribute('referrerpolicy', 'no-referrer');
    videoEl.load();

    // Set blurred backdrop poster if drama poster available
    if (elements.reelBackdrop && PlayerState.currentDrama?.poster) {
        elements.reelBackdrop.style.backgroundImage = `url("${PlayerState.currentDrama.poster}")`;
    }

    // Determine format
    const isExplicitMp4 = /\.mp4(?:\?|$)/i.test(streamUrl) || /\.webm(?:\?|$)/i.test(streamUrl);
    const isHls = isHlsHint || /\.m3u8(?:\?|$)/i.test(streamUrl) || !isExplicitMp4;

    // Show buffering indicator
    if (elements.playerBuffering) {
        elements.playerBuffering.style.display = 'flex';
        if (elements.playerBufferingText) {
            elements.playerBufferingText.textContent = `Streaming EP ${PlayerState.currentEpisodeNumber}...`;
        }
    }
    if (elements.playerErrorOverlay) {
        elements.playerErrorOverlay.style.display = 'none';
    }

    // Adaptive playback strategy:
    // On modern browsers (Chrome/Firefox/Edge), almost all drama streams are HLS, so route through Hls.js
    if (isHls && window.Hls && Hls.isSupported()) {
        loadWithHlsJs(streamUrl, videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS for Safari on iOS / macOS
        loadNativeVideo(streamUrl, videoEl, true);
    } else {
        // Direct MP4 / WebM
        loadNativeVideo(streamUrl, videoEl, false);
    }
}

/**
 * Robust Hls.js stream loader with automatic proxy fallback
 */
function loadWithHlsJs(streamUrl, videoEl, isProxyAttempt = false) {
    const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        xhrSetup: (xhr) => {
            xhr.withCredentials = false;
        }
    });
    PlayerState.hls = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(videoEl);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (elements.playerBuffering) elements.playerBuffering.style.display = 'none';
        videoEl.play().catch(() => {});
    });

    let networkRetryCount = 0;
    hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                if (networkRetryCount === 0) {
                    networkRetryCount++;
                    hls.startLoad();
                } else if (!isProxyAttempt) {
                    // Direct manifest fetch failed due to CORS/network, retry via raw proxy
                    hls.destroy();
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(streamUrl)}`;
                    loadWithHlsJs(proxyUrl, videoEl, true);
                } else {
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
 * Native video playback with format recovery
 */
function loadNativeVideo(streamUrl, videoEl, isAppleHls = false) {
    videoEl.onerror = () => {
        const err = videoEl.error;
        // If native video failed on Chrome/Firefox because it's an HLS stream passed to <video src>:
        if (err && err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && window.Hls && Hls.isSupported() && !PlayerState.hls) {
            loadWithHlsJs(streamUrl, videoEl);
            return;
        }

        // Check if there is an alternative play URL in active episode
        if (PlayerState.episodes && PlayerState.episodes.length > 0) {
            const activeEp = PlayerState.episodes.find(e => Number(e.number) === PlayerState.currentEpisodeNumber);
            if (activeEp && activeEp.directPlayUrl && activeEp.directPlayUrl !== streamUrl) {
                loadStreamInVideo(activeEp.directPlayUrl);
                return;
            }
        }

        if (err && err.code === MediaError.MEDIA_ERR_DECODE) {
            showPlayerError('Failed to decode video stream (unsupported codec or corrupt video).');
        } else if (err && err.code === MediaError.MEDIA_ERR_NETWORK) {
            showPlayerError('Network connection error while streaming episode.');
        } else {
            showPlayerError('Video playback error. Tap Retry to reconnect.');
        }
    };

    videoEl.src = streamUrl;
    videoEl.addEventListener('loadedmetadata', () => {
        if (elements.playerBuffering) elements.playerBuffering.style.display = 'none';
        videoEl.play().catch(() => {});
    }, { once: true });
}

/**
 * Configure video element events (timeupdate, progress, auto-next on ended)
 */
function setupVideoPlayerEvents() {
    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;

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
        if (elements.playerBuffering) elements.playerBuffering.style.display = 'flex';
    };

    videoEl.onplaying = () => {
        if (elements.playerBuffering) elements.playerBuffering.style.display = 'none';
        if (elements.playerErrorOverlay) elements.playerErrorOverlay.style.display = 'none';
        PlayerState.isPlaying = true;
    };

    videoEl.onpause = () => {
        PlayerState.isPlaying = false;
    };

    videoEl.onended = () => {
        // Auto-advance to next episode when current finishes
        playNextEpisode();
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
        seekToEvent(e);
    });

    container.addEventListener('touchstart', (e) => {
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

    viewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('.reel-right-rail') || e.target.closest('.reel-top-bar') || e.target.closest('.reel-bottom-bar') || e.target.closest('.reel-episodes-sheet')) {
            return;
        }
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
            if (diffY < -55) {
                // Swipe UP -> Next Episode!
                triggerReelSwipeTransition('up');
                playNextEpisode();
            } else if (diffY > 55) {
                // Swipe DOWN -> Prev Episode!
                triggerReelSwipeTransition('down');
                playPrevEpisode();
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
            triggerReelSwipeTransition('up');
            playNextEpisode();
        } else if (e.deltaY < -60) {
            wheelDebounceTimer = setTimeout(() => { wheelDebounceTimer = null; }, 600);
            triggerReelSwipeTransition('down');
            playPrevEpisode();
        }
    }, { passive: true });
}

/**
 * Handle Tap vs Double-Tap on screen
 */
function handleScreenTap(e) {
    const now = Date.now();
    const timeSinceLast = now - (PlayerState.lastTapTime || 0);

    if (timeSinceLast < 280) {
        // Double-Tap -> Trigger Heart animation & Like!
        triggerHeartBubble();
        if (!PlayerState.isLiked) toggleLike();
    } else {
        // Single Tap -> Toggle Play / Pause with center ripple icon
        togglePlayPause();
    }
    PlayerState.lastTapTime = now;
}

/**
 * Toggle Play / Pause with center ripple icon
 */
function togglePlayPause() {
    const videoEl = elements.playerVideoElement;
    if (!videoEl) return;

    if (videoEl.paused) {
        videoEl.play().catch(() => {});
        triggerCenterFeedback('▶');
    } else {
        videoEl.pause();
        triggerCenterFeedback('⏸');
    }
}

function triggerCenterFeedback(icon) {
    if (!elements.reelCenterFeedback || !elements.reelFeedbackIcon) return;
    elements.reelFeedbackIcon.textContent = icon;
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

function triggerReelSwipeTransition(direction) {
    const container = elements.reelPlayerContainer;
    if (!container) return;
    container.style.transition = 'transform 0.15s ease-out';
    container.style.transform = direction === 'up' ? 'translateY(-12px)' : 'translateY(12px)';
    setTimeout(() => {
        container.style.transform = 'translateY(0)';
        setTimeout(() => {
            container.style.transition = '';
        }, 150);
    }, 150);
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
    renderEpisodesSheet(PlayerState.episodes, PlayerState.currentEpisodeNumber);
}

function closeEpisodesSheet() {
    if (!elements.reelEpisodesSheet) return;
    elements.reelEpisodesSheet.classList.remove('active');
}

function renderEpisodesSheet(episodes, activeEpisodeNum) {
    if (!elements.playerEpisodesStrip) return;
    const total = (episodes && episodes.length > 0) ? episodes.length : (PlayerState.currentDrama?.episodes || 60);

    if (elements.sheetEpTotal) {
        elements.sheetEpTotal.textContent = `(${total})`;
    }

    const pills = [];
    for (let i = 1; i <= total; i++) {
        const isActive = i === Number(activeEpisodeNum);
        pills.push(`
            <button class="sheet-ep-btn ${isActive ? 'active' : ''}" type="button" data-ep="${i}">
                EP ${i}
            </button>
        `);
    }

    elements.playerEpisodesStrip.innerHTML = pills.join('');

    // Attach click listeners to jump to episode
    elements.playerEpisodesStrip.querySelectorAll('.sheet-ep-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ep = parseInt(btn.getAttribute('data-ep'), 10);
            if (ep && PlayerState.currentDrama) {
                closeEpisodesSheet();
                const epUrl = getEpisodeWatchUrl(PlayerState.currentDrama.url, ep);
                playEpisode(PlayerState.currentDrama, ep, epUrl);
            }
        });
    });

    // Auto-scroll active episode into center view
    const activeBtn = elements.playerEpisodesStrip.querySelector('.sheet-ep-btn.active');
    if (activeBtn) {
        setTimeout(() => {
            activeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

/**
 * Display player error overlay
 */
function showPlayerError(msg) {
    if (elements.playerBuffering) elements.playerBuffering.style.display = 'none';
    if (elements.playerErrorOverlay) elements.playerErrorOverlay.style.display = 'flex';
    if (elements.playerErrorText) elements.playerErrorText.textContent = msg;
}

/**
 * Close streaming player and cleanup
 */
function closePlayer() {
    closeEpisodesSheet();
    if (PlayerState.hls) {
        PlayerState.hls.destroy();
        PlayerState.hls = null;
    }
    if (elements.playerVideoElement) {
        elements.playerVideoElement.pause();
        elements.playerVideoElement.removeAttribute('src');
        elements.playerVideoElement.load();
    }
    closeModal(elements.playerModal);
}

/**
 * Play Next Episode
 */
function playNextEpisode() {
    if (!PlayerState.currentDrama) return;
    const nextEp = PlayerState.currentEpisodeNumber + 1;
    const maxEp = PlayerState.episodes.length || PlayerState.currentDrama.episodes || 100;
    if (nextEp <= maxEp) {
        const nextUrl = getEpisodeWatchUrl(PlayerState.currentDrama.url, nextEp);
        playEpisode(PlayerState.currentDrama, nextEp, nextUrl);
    } else {
        showToast('Reached the final episode of this drama!');
    }
}

/**
 * Play Previous Episode
 */
function playPrevEpisode() {
    if (!PlayerState.currentDrama) return;
    const prevEp = PlayerState.currentEpisodeNumber - 1;
    if (prevEp >= 1) {
        const prevUrl = getEpisodeWatchUrl(PlayerState.currentDrama.url, prevEp);
        playEpisode(PlayerState.currentDrama, prevEp, prevUrl);
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

/**
 * Handle manual HTML paste for local testing or custom inspection
 */
function handlePasteHtml() {
    if (!elements.pasteTextarea) return;
    const rawHtml = elements.pasteTextarea.value.trim();
    if (!rawHtml) {
        showToast('Please paste valid HTML before submitting.');
        return;
    }

    try {
        const parsed = DramaParser.parse(rawHtml, 'https://narto-drama.com');
        closeModal(elements.pasteModal);
        setAppMode('results');

        if (parsed.items && parsed.items.length > 0) {
            AppState.results = parsed.items;
            renderAnimeCards(parsed.items, 'Pasted HTML Inspection');
            showToast(`Extracted ${parsed.items.length} dramas dynamically!`);
        } else {
            showToast('No drama cards found in pasted HTML.');
        }
    } catch (e) {
        showToast('Parse error: ' + e.message);
    }
}

/**
 * Sorting logic
 */
function sortAndRender() {
    if (!elements.sortSelect) return;
    const sortVal = elements.sortSelect.value;
    const sorted = [...AppState.results];

    if (sortVal === 'title-asc') {
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortVal === 'title-desc') {
        sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    }

    renderAnimeCards(sorted, AppState.currentQuery);
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
    if (elements.customProxyWrap) {
        elements.customProxyWrap.style.display = AppState.proxyMethod === 'custom' ? 'block' : 'none';
    }
}

function saveProxySettings() {
    if (elements.proxySelect) AppState.proxyMethod = elements.proxySelect.value;
    if (elements.customProxyInput) AppState.customProxy = elements.customProxyInput.value.trim();
    localStorage.setItem('nd_proxy_method', AppState.proxyMethod);
    localStorage.setItem('nd_custom_proxy', AppState.customProxy);

    closeModal(elements.proxyModal);
    showToast('Proxy settings saved!');
}

/**
 * UI State Visibility Helpers
 */
function showLoading() {
    hideAllResults();
    if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    if (elements.skeletonGrid) elements.skeletonGrid.style.display = 'grid';
}

function showEmpty() {
    hideAllResults();
    if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    if (elements.emptyState) elements.emptyState.style.display = 'block';
}

function showError(message) {
    hideAllResults();
    if (elements.contentContainer) elements.contentContainer.style.display = 'block';
    if (elements.errorState) elements.errorState.style.display = 'block';
    if (elements.errorDesc) elements.errorDesc.textContent = message || 'An error occurred while fetching drama data.';
}

function hideAllResults() {
    if (elements.resultsBar) elements.resultsBar.style.display = 'none';
    if (elements.skeletonGrid) elements.skeletonGrid.style.display = 'none';
    if (elements.animeGrid) elements.animeGrid.style.display = 'none';
    if (elements.emptyState) elements.emptyState.style.display = 'none';
    if (elements.errorState) elements.errorState.style.display = 'none';
    if (elements.contentContainer) elements.contentContainer.style.display = 'none';
}

function openModal(modal) {
    if (modal) modal.classList.add('active');
}

function closeModal(modal) {
    if (modal) modal.classList.remove('active');
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
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

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

