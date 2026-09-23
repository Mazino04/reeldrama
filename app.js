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
    lastTapTime: 0
};

// Safe DOM Element Selector
function getEl(id) {
    return document.getElementById(id);
}

/**
 * LOCAL DATA MANAGER: Bookmarks ("Watch Later") & Episode Progress Tracking
 * 100% Offline and Private - stored in browser localStorage
 */
const UserDataManager = {
    STORAGE_KEY: 'reeldrama_user_data',
    data: {
        bookmarks: {},  // dramaKey -> { id, title, poster, url, tags, episodes, savedAt }
        progress: {}    // dramaKey -> { lastWatchedEp, lastWatchedAt, watchedList: [] }
    },

    init() {
        this.load();
        this.updateBadge();
    },

    getDramaKey(dramaUrl) {
        if (!dramaUrl) return '';
        return String(dramaUrl).split('?')[0].replace(/\/+$/, '').replace(/\/\d+$/, '').toLowerCase();
    },

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    const cleanBookmarks = {};
                    for (const [k, v] of Object.entries(parsed.bookmarks || {})) {
                        if (v && v.url && !/^file:/i.test(v.url) && !/^file:/i.test(v.poster || '')) {
                            cleanBookmarks[k] = v;
                        }
                    }
                    this.data.bookmarks = cleanBookmarks;
                    this.data.progress = parsed.progress || {};
                }
            }
        } catch (e) {
            console.warn('[UserDataManager] Failed to read from localStorage:', e);
        }
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[UserDataManager] Failed to write to localStorage:', e);
        }
        this.updateBadge();
    },

    updateBadge() {
        if (!elements.navBookmarkCount) return;
        const count = Object.keys(this.data.bookmarks || {}).length;
        if (count > 0) {
            elements.navBookmarkCount.textContent = count > 99 ? '99+' : count;
            elements.navBookmarkCount.style.display = 'inline-block';
        } else {
            elements.navBookmarkCount.style.display = 'none';
        }
        if (elements.bookmarksCountBadge) {
            elements.bookmarksCountBadge.textContent = `${count} saved`;
        }
    },

    isBookmarked(dramaUrl) {
        const key = this.getDramaKey(dramaUrl);
        return Boolean(key && this.data.bookmarks[key]);
    },

    toggleBookmark(drama) {
        if (!drama || !drama.url || /^file:/i.test(drama.url)) return false;
        const key = this.getDramaKey(drama.url);
        if (!key) return false;

        const isCurrentlySaved = Boolean(this.data.bookmarks[key]);
        if (isCurrentlySaved) {
            delete this.data.bookmarks[key];
        } else {
            const safePoster = (drama.poster && !/^file:/i.test(drama.poster)) ? drama.poster : '';
            this.data.bookmarks[key] = {
                id: key,
                title: drama.title || 'Untitled Drama',
                poster: safePoster,
                url: drama.url,
                tags: Array.isArray(drama.tags) ? drama.tags : [],
                episodes: drama.episodes || (drama.episodeList ? drama.episodeList.length : 0),
                savedAt: Date.now()
            };
        }
        this.save();
        return !isCurrentlySaved;
    },

    getBookmarksList() {
        const list = Object.values(this.data.bookmarks || {});
        return list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    },

    clearAllBookmarks() {
        this.data.bookmarks = {};
        this.save();
    },

    getDramaProgress(dramaUrl) {
        const key = this.getDramaKey(dramaUrl);
        if (!key || !this.data.progress[key]) {
            return { lastWatchedEp: 1, lastWatchedAt: 0, watchedList: [] };
        }
        const prog = this.data.progress[key];
        return {
            lastWatchedEp: parseInt(prog.lastWatchedEp, 10) || 1,
            lastWatchedAt: prog.lastWatchedAt || 0,
            watchedList: Array.isArray(prog.watchedList) ? prog.watchedList : []
        };
    },

    recordEpisodeWatched(drama, epNum) {
        if (!drama || !drama.url) return;
        const key = this.getDramaKey(drama.url);
        if (!key) return;

        const ep = parseInt(epNum, 10) || 1;
        if (!this.data.progress[key]) {
            this.data.progress[key] = {
                lastWatchedEp: ep,
                lastWatchedAt: Date.now(),
                watchedList: [ep]
            };
        } else {
            const prog = this.data.progress[key];
            prog.lastWatchedEp = ep;
            prog.lastWatchedAt = Date.now();
            if (!prog.watchedList.includes(ep)) {
                prog.watchedList.push(ep);
                prog.watchedList.sort((a, b) => a - b);
            }
        }

        // If this drama is bookmarked and we now know real episode count, sync it
        if (this.data.bookmarks[key] && drama.episodes && drama.episodes > 0) {
            this.data.bookmarks[key].episodes = drama.episodes;
        }

        this.save();
    },

    toggleEpisodeWatched(drama, epNum) {
        if (!drama || !drama.url) return false;
        const key = this.getDramaKey(drama.url);
        if (!key) return false;

        const ep = parseInt(epNum, 10) || 1;
        if (!this.data.progress[key]) {
            this.data.progress[key] = {
                lastWatchedEp: ep,
                lastWatchedAt: Date.now(),
                watchedList: [ep]
            };
            this.save();
            return true;
        }

        const prog = this.data.progress[key];
        const idx = prog.watchedList.indexOf(ep);
        let nowWatched = false;
        if (idx >= 0) {
            prog.watchedList.splice(idx, 1);
            nowWatched = false;
        } else {
            prog.watchedList.push(ep);
            prog.watchedList.sort((a, b) => a - b);
            prog.lastWatchedEp = ep;
            nowWatched = true;
        }
        prog.lastWatchedAt = Date.now();
        this.save();
        return nowWatched;
    }
};

// Elements Cache
const elements = {
    body: document.body,
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

    // Bookmarks Section
    bookmarksSection: getEl('bookmarks-section'),
    bookmarksGrid: getEl('bookmarks-grid'),
    bookmarksEmptyState: getEl('bookmarks-empty-state'),
    bookmarksCountBadge: getEl('bookmarks-count-badge'),
    bookmarksBackBtn: getEl('bookmarks-back-btn'),
    bookmarksClearBtn: getEl('bookmarks-clear-btn'),
    bookmarksExploreBtn: getEl('bookmarks-explore-btn'),

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
    UserDataManager.init();
    setupEventListeners();
    setupProxySettings();
    registerServiceWorker();
    setupPwaInstall();

    // Check if URL has #mylist or ?q= parameter
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    if (window.location.hash === '#mylist' || urlParams.get('view') === 'mylist') {
        setAppMode('bookmarks');
    } else if (initialQuery && initialQuery.trim()) {
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

    // Browser back/forward navigation support
    window.addEventListener('popstate', () => {
        if (window.location.hash === '#mylist') {
            setAppMode('bookmarks');
        } else {
            const currentParams = new URLSearchParams(window.location.search);
            const q = currentParams.get('q');
            if (q && q.trim()) {
                if (elements.searchInput) elements.searchInput.value = q.trim();
                triggerDynamicSearch(q.trim());
            } else {
                resetToHomePage();
            }
        }
    });
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

    if (elements.bookmarksBackBtn) {
        elements.bookmarksBackBtn.addEventListener('click', () => {
            resetToHomePage();
        });
    }

    if (elements.bookmarksClearBtn) {
        elements.bookmarksClearBtn.addEventListener('click', () => {
            const list = UserDataManager.getBookmarksList();
            if (list.length === 0) return;
            if (confirm('Clear all saved reels from My List?')) {
                UserDataManager.clearAllBookmarks();
                renderBookmarksView();
                showToast('Cleared My List');
            }
        });
    }

    if (elements.bookmarksExploreBtn) {
        elements.bookmarksExploreBtn.addEventListener('click', () => {
            resetToHomePage();
            if (elements.searchInput) elements.searchInput.focus();
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
            closeModal(elements.proxyModal);
            closeModal(elements.pwaGuideModal);
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
    AppState.mode = mode;
    if (elements.body) {
        elements.body.className = `app-mode-${mode}`;
    }
    if (mode === 'home') {
        hideAllResults();
        if (elements.heroSection) elements.heroSection.style.display = 'flex';
        if (elements.navBookmarkBtn) elements.navBookmarkBtn.classList.remove('active');
    } else if (mode === 'bookmarks') {
        hideAllResults();
        if (elements.heroSection) elements.heroSection.style.display = 'none';
        if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'block';
        if (elements.navBookmarkBtn) elements.navBookmarkBtn.classList.add('active');
        renderBookmarksView();
    } else if (mode === 'results') {
        if (elements.heroSection) elements.heroSection.style.display = 'flex';
        if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'none';
        if (elements.navBookmarkBtn) elements.navBookmarkBtn.classList.remove('active');
    }
}

/**
 * Render Bookmarks / Watch Later View ("My List")
 */
function renderBookmarksView() {
    if (!elements.bookmarksGrid) return;
    const bookmarks = UserDataManager.getBookmarksList();

    if (elements.bookmarksCountBadge) {
        elements.bookmarksCountBadge.textContent = `${bookmarks.length} ${bookmarks.length === 1 ? 'reel' : 'reels'}`;
    }

    if (bookmarks.length === 0) {
        elements.bookmarksGrid.style.display = 'none';
        if (elements.bookmarksEmptyState) elements.bookmarksEmptyState.style.display = 'block';
        return;
    }

    if (elements.bookmarksEmptyState) elements.bookmarksEmptyState.style.display = 'none';
    elements.bookmarksGrid.style.display = 'grid';

    elements.bookmarksGrid.innerHTML = bookmarks.map((item, index) => createAnimeCardHtml(item, index, true)).join('');

    // Attach card click handlers for bookmarks view
    attachCardListeners(elements.bookmarksGrid, bookmarks, true);
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
        showError(`Could not fetch "${cleanQuery}" (${err.message}). Tap "Retry Search" to try again.`);
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
 * HIGH-AVAILABILITY MULTI-TIER PROXY ENGINE
 * Designed for mobile networks and GitHub Pages cross-origin hosting
 * Staggers requests to prevent single-proxy timeouts from blocking the app
 */
async function fetchFastHtml(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string' || /^file:\/\//i.test(targetUrl) || /^file:/i.test(targetUrl)) {
        throw new Error('Invalid URL or disallowed file protocol.');
    }

    if (DetailCache.has(targetUrl)) {
        return { html: DetailCache.get(targetUrl), source: 'Cache' };
    }

    const method = AppState.proxyMethod || 'auto';

    // Helper to validate that a response is real drama HTML and not a proxy 502/522 error page
    function isValidDramaHtml(text) {
        if (!text || typeof text !== 'string' || text.length < 500) return false;
        if (text.includes('502 Bad Gateway') || text.includes('522 Connection timed out') || text.includes('Cloudflare Ray ID')) {
            return false;
        }
        return text.includes('<html') || text.includes('<body') || text.includes('<!DOCTYPE') || text.includes('drama');
    }

    // 1. User Custom Proxy
    if (AppState.customProxy && AppState.customProxy.trim()) {
        const customUrl = AppState.customProxy.replace('{url}', encodeURIComponent(targetUrl));
        try {
            const res = await fetchWithTimeout(customUrl, { timeout: 12000 });
            if (!res.ok) throw new Error(`Custom Proxy status ${res.status}`);
            const text = await res.text();
            if (isValidDramaHtml(text)) {
                DetailCache.set(targetUrl, text);
                return { html: text, source: 'Custom Proxy' };
            }
        } catch (err) {
            console.warn('[Custom Proxy Error]:', err.message);
        }
    }

    // 2. Specific method selected by user
    if (method === 'direct') {
        const res = await fetchWithTimeout(targetUrl, { mode: 'cors', timeout: 8000 });
        if (!res.ok) throw new Error(`Direct Fetch status ${res.status}`);
        const text = await res.text();
        DetailCache.set(targetUrl, text);
        return { html: text, source: 'Direct Fetch' };
    }

    if (method === 'allorigins') {
        const res = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
        if (!res.ok) throw new Error(`AllOrigins status ${res.status}`);
        const text = await res.text();
        if (!isValidDramaHtml(text)) throw new Error('Invalid or empty response from AllOrigins');
        DetailCache.set(targetUrl, text);
        return { html: text, source: 'AllOrigins' };
    }

    if (method === 'codetabs') {
        const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
        if (!res.ok) throw new Error(`CodeTabs status ${res.status}`);
        const text = await res.text();
        if (!isValidDramaHtml(text)) throw new Error('Invalid or empty response from CodeTabs');
        DetailCache.set(targetUrl, text);
        return { html: text, source: 'CodeTabs' };
    }

    // 3. 'auto' mode: Intelligent Staggered Race across multiple proxies + direct fetch
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const candidates = [
        // Candidate 1: AllOrigins Raw (direct raw streaming without JSON encoding overhead)
        {
            name: 'AllOrigins Raw',
            fetcher: async () => {
                const res = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const text = await res.text();
                if (!isValidDramaHtml(text)) throw new Error('Invalid or error payload');
                return text;
            }
        },
        // Candidate 2: CodeTabs Proxy
        {
            name: 'CodeTabs',
            fetcher: async () => {
                const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const text = await res.text();
                if (!isValidDramaHtml(text)) throw new Error('Invalid or error payload');
                return text;
            }
        },
        // Candidate 3: Direct Fetch (instant on localhost or if browser permits CORS)
        {
            name: 'Direct Fetch',
            fetcher: async () => {
                const res = await fetchWithTimeout(targetUrl, { mode: 'cors', timeout: isLocalhost ? 5000 : 7000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const text = await res.text();
                if (!isValidDramaHtml(text)) throw new Error('Empty payload');
                return text;
            }
        },
        // Candidate 4: AllOrigins JSON GET (fallback)
        {
            name: 'AllOrigins GET',
            fetcher: async () => {
                const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
                if (!res.ok) throw new Error(`Status ${res.status}`);
                const data = await res.json();
                if (!data || !data.contents || !isValidDramaHtml(data.contents)) throw new Error('Empty JSON contents');
                return data.contents;
            }
        }
    ];

    // If on localhost, try direct fetch first
    if (isLocalhost) {
        candidates.unshift(candidates.splice(2, 1)[0]);
    }

    // Staggered execution: starts candidate 0 immediately, candidate 1 at 1200ms, candidate 2 at 2400ms...
    // The FIRST candidate that completes with valid drama HTML wins immediately!
    return new Promise((resolve, reject) => {
        let isResolved = false;
        let errors = [];

        candidates.forEach((cand, index) => {
            const delay = index === 0 ? 0 : (index * 1200);

            setTimeout(async () => {
                if (isResolved) return;
                try {
                    const text = await cand.fetcher();
                    if (!isResolved) {
                        isResolved = true;
                        DetailCache.set(targetUrl, text);
                        resolve({ html: text, source: cand.name });
                    }
                } catch (err) {
                    errors.push(`${cand.name}: ${err.message}`);
                    if (errors.length === candidates.length && !isResolved) {
                        isResolved = true;
                        reject(new Error(errors.join(' | ')));
                    }
                }
            }, delay);
        });
    });
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
        elements.animeGrid.innerHTML = items.map((item, index) => createAnimeCardHtml(item, index, false)).join('');
    }

    // Attach click & bookmark handlers
    attachCardListeners(elements.animeGrid, items, false);
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
        cardEl.addEventListener('click', (e) => {
            // Check if bookmark toggle button clicked
            const bookmarkBtn = e.target.closest('.card-bookmark-btn');
            if (bookmarkBtn) {
                e.preventDefault();
                e.stopPropagation();
                const nowSaved = UserDataManager.toggleBookmark(item);
                if (isBookmarkView) {
                    showToast(`Removed "${item.title}" from Saved`);
                    renderBookmarksView();
                } else {
                    bookmarkBtn.classList.toggle('is-saved', nowSaved);
                    const iconEl = bookmarkBtn.querySelector('.bookmark-icon');
                    const textEl = bookmarkBtn.querySelector('.bookmark-text');
                    if (iconEl) iconEl.textContent = nowSaved ? '✓' : '+';
                    if (textEl) textEl.textContent = nowSaved ? 'Saved' : 'Save';
                    bookmarkBtn.title = nowSaved ? 'Remove from Saved' : 'Add to Watch Later';
                    showToast(nowSaved ? `Saved "${item.title}" to Watch Later` : `Removed "${item.title}" from Saved`);
                }
                return;
            }

            // Tapping anywhere on the card launches the reel player directly at last watched episode!
            const prog = UserDataManager.getDramaProgress(item.url);
            const targetEp = (prog.lastWatchedEp && prog.lastWatchedEp > 0) ? prog.lastWatchedEp : 1;
            const epUrl = (item.episodeList && item.episodeList[targetEp - 1]) 
                ? item.episodeList[targetEp - 1].url 
                : getEpisodeWatchUrl(item.url, targetEp);

            playEpisode(item, targetEp, epUrl);
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
function createAnimeCardHtml(item, index, isBookmarkView = false) {
    const title = escapeHtml(item.title || 'Untitled Drama');
    const poster = item.poster || '';
    const hasEpisodes = (item.episodes && item.episodes > 0) || (item.episodeList && item.episodeList.length > 0);
    const episodeTotalText = getEpisodeTotalText(item);
    const badgeClass = hasEpisodes ? 'card-badge-top-left' : 'card-badge-top-left badge-resolving';
    const typeBadge = (item.tags && item.tags.some(t => /dub/i.test(t))) ? 'DUB' : 'SUB';
    const tagsHtml = (item.tags || []).slice(0, 3).map(tag => 
        `<span class="card-tag">#${escapeHtml(tag)}</span>`
    ).join('');

    // Bookmarking & Episode Tracking state
    const isSaved = UserDataManager.isBookmarked(item.url);
    const prog = UserDataManager.getDramaProgress(item.url);
    const watchedCount = prog.watchedList.length;
    const totalEps = (item.episodes && item.episodes > 0) ? item.episodes : (item.episodeList ? item.episodeList.length : 0);
    const progressPct = totalEps > 0 ? Math.min(100, Math.round((watchedCount / totalEps) * 100)) : 0;

    const progressBarMarkup = watchedCount > 0 
        ? `<div class="card-progress-bar-wrap"><div class="card-progress-bar-fill" style="width: ${progressPct}%"></div></div>`
        : '';

    let footerLabel = 'HD Quality';
    if (watchedCount > 0) {
        footerLabel = totalEps > 0 ? `Watched ${watchedCount}/${totalEps} eps` : `Watched ${watchedCount} eps`;
    } else if (totalEps > 0) {
        footerLabel = `${totalEps} Episodes`;
    }
    const progressClass = watchedCount > 0 ? 'card-progress-text has-progress' : 'card-progress-text';

    const posterMarkup = poster 
        ? `<img class="card-poster" src="${escapeHtml(poster)}" alt="${title}" loading="lazy" referrerpolicy="no-referrer">`
        : `<div class="card-poster-fallback">${getInitials(title)}</div>`;

    const cardId = isBookmarkView ? `bookmark-card-${index}` : `anime-card-${index}`;

    return `
        <article class="anime-card" id="${cardId}" tabindex="0" role="button" aria-label="${title}">
            <div class="card-poster-wrap">
                <span class="${badgeClass}" id="card-ep-badge-${index}">🎬 ${escapeHtml(episodeTotalText)}</span>
                <span class="card-badge-top-right">${typeBadge}</span>
                ${posterMarkup}
                <div class="poster-gradient"></div>
                ${progressBarMarkup}
            </div>
            <div class="card-body">
                <h3 class="card-title" title="${title}">${title}</h3>
                <div class="card-tags">
                    ${tagsHtml}
                </div>
                <div class="card-footer-action">
                    <span class="${progressClass}">${escapeHtml(footerLabel)}</span>
                    <button class="card-bookmark-btn ${isSaved ? 'is-saved' : ''}" type="button" title="${isSaved ? 'Remove from Saved' : 'Add to Watch Later'}">
                        <span class="bookmark-icon">${isSaved ? '✓' : '+'}</span>
                        <span class="bookmark-text">${isSaved ? 'Saved' : 'Save'}</span>
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

    const prog = UserDataManager.getDramaProgress(AppState.selectedDrama?.url);
    const html = episodeList.map((ep, idx) => {
        const epNum = typeof ep.number === 'number' ? ep.number : (idx + 1);
        const epLabel = typeof ep.number === 'string' && ep.number.toUpperCase().startsWith('EP') ? ep.number : `EP ${epNum}`;
        const isWatched = prog.watchedList.includes(epNum);
        const watchedClass = isWatched ? ' watched' : '';
        return `<button class="episode-btn${watchedClass}" type="button" data-ep-index="${idx}" data-ep-num="${epNum}" data-ep-url="${escapeHtml(ep.url)}" title="${isWatched ? `Episode ${epNum} (Watched)` : `Episode ${epNum}`}">${escapeHtml(epLabel)}${isWatched ? ' ✓' : ''}</button>`;
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
                if (activeEp.exp && (activeEp.exp * 1000) < Date.now()) {
                    closePlayer();
                    showToast('This episode is not available at this moment');
                    return;
                }
                loadStreamInVideo(activeEp.playUrl, activeEp.isHls, activeEp.key, activeEp.exp);
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
                loadStreamInVideo(targetUrl, streamData.isHls, targetKey, targetExp);
                return;
            }
        } else if (streamData.streamUrl) {
            if (streamData.exp && (streamData.exp * 1000) < Date.now()) {
                closePlayer();
                showToast('This episode is not available at this moment');
                return;
            }
            loadStreamInVideo(streamData.streamUrl, streamData.isHls, streamData.key, streamData.exp);
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
            // 1. Intercept decryption key requests (context.type === 'key')
            if (context.type === 'key') {
                const url = context.url || '';
                if (url.startsWith('local:') || url.startsWith('file:') || url.includes('offline-key') || url.startsWith('data:application/octet-stream;base64,')) {
                    let keyBase64 = PlayerState.currentStreamKey;
                    if (url.startsWith('data:application/octet-stream;base64,')) {
                        keyBase64 = url.split(',')[1];
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
                }
            }

            // 2. Intercept manifest & level playlists to rewrite local: or file: key URIs
            if (context.type === 'manifest' || context.type === 'level') {
                const origSuccess = callbacks.onSuccess;
                callbacks.onSuccess = function(response, stats, ctx, networkDetails) {
                    if (response && typeof response.data === 'string' && PlayerState.currentStreamKey) {
                        const dataUri = `data:application/octet-stream;base64,${PlayerState.currentStreamKey}`;
                        response.data = response.data.replace(/URI=["'](?:local|file):\/\/[^"']+["']/g, `URI="${dataUri}"`);
                    }
                    origSuccess.call(this, response, stats, ctx, networkDetails);
                };
            }

            super.load(context, config, callbacks);
        }
    };
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
                if (elements.playerMuteIcon) elements.playerMuteIcon.textContent = '🔇';
                if (elements.playerMuteLabel) elements.playerMuteLabel.textContent = 'Muted';
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
function loadStreamInVideo(streamUrl, isHlsHint = false, streamKey = null, streamExp = null) {
    if (!streamUrl) {
        showPlayerError('No video stream URL found for this episode.');
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

    PlayerState.currentStreamUrl = streamUrl;
    PlayerState.currentStreamKey = streamKey;
    PlayerState.currentStreamExp = streamExp;

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
    // On modern browsers (Chrome/Firefox/Edge/Samsung Internet), almost all drama streams are HLS, so route through Hls.js
    if (isHls && window.Hls && Hls.isSupported()) {
        loadWithHlsJs(streamUrl, videoEl, false, streamKey, streamExp);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS for Safari on iOS / macOS
        loadNativeVideo(streamUrl, videoEl, true);
    } else {
        // Direct MP4 / WebM
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
        if (elements.playerBuffering) elements.playerBuffering.style.display = 'none';
        attemptAutoplay(videoEl);
    });

    let networkRetryCount = 0;
    hls.on(Hls.Events.ERROR, (event, data) => {
        const statusCode = data.response?.code || data.response?.status || data.context?.xhr?.status;

        // Immediate HTTP 410 detection: close player and inform user
        if (statusCode === 410) {
            hls.destroy();
            PlayerState.hls = null;
            closePlayer();
            showToast('This episode is not available at this moment');
            return;
        }

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
                    loadWithHlsJs(proxyUrl, videoEl, true, PlayerState.currentStreamKey, PlayerState.currentStreamExp);
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
 * Native video playback with format recovery and 410 detection
 */
function loadNativeVideo(streamUrl, videoEl, isAppleHls = false) {
    videoEl.onerror = async () => {
        const err = videoEl.error;

        // 1. Probe for HTTP 410 status code
        try {
            const probe = await fetchWithTimeout(streamUrl, { method: 'HEAD', timeout: 3500 });
            if (probe.status === 410) {
                closePlayer();
                showToast('This episode is not available at this moment');
                return;
            }
        } catch (_) {}

        // If native video failed on Chrome/Firefox because it's an HLS stream passed to <video src>:
        if (err && err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && window.Hls && Hls.isSupported() && !PlayerState.hls) {
            loadWithHlsJs(streamUrl, videoEl, false, PlayerState.currentStreamKey, PlayerState.currentStreamExp);
            return;
        }

        // Check if there is an alternative play URL in active episode
        if (PlayerState.episodes && PlayerState.episodes.length > 0) {
            const activeEp = PlayerState.episodes.find(e => Number(e.number) === PlayerState.currentEpisodeNumber);
            if (activeEp && activeEp.directPlayUrl && activeEp.directPlayUrl !== streamUrl) {
                loadStreamInVideo(activeEp.directPlayUrl, activeEp.isHls, activeEp.key, activeEp.exp);
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
        attemptAutoplay(videoEl);
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

        // Record episode as watched in local storage
        if (PlayerState.currentDrama && PlayerState.currentEpisodeNumber) {
            UserDataManager.recordEpisodeWatched(PlayerState.currentDrama, PlayerState.currentEpisodeNumber);
            if (elements.playerEpisodesStrip) {
                const btn = elements.playerEpisodesStrip.querySelector(`.sheet-ep-btn[data-ep="${PlayerState.currentEpisodeNumber}"]`);
                if (btn) btn.classList.add('watched');
            }
        }
    };

    videoEl.onpause = () => {
        PlayerState.isPlaying = false;
    };

    videoEl.onended = () => {
        // Record finished episode as watched and advance
        if (PlayerState.currentDrama && PlayerState.currentEpisodeNumber) {
            UserDataManager.recordEpisodeWatched(PlayerState.currentDrama, PlayerState.currentEpisodeNumber);
        }
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

    const prog = UserDataManager.getDramaProgress(PlayerState.currentDrama?.url);
    const pills = [];
    for (let i = 1; i <= total; i++) {
        const isActive = i === Number(activeEpisodeNum);
        const isWatched = prog.watchedList.includes(i);
        const classes = ['sheet-ep-btn'];
        if (isActive) classes.push('active');
        if (isWatched) classes.push('watched');

        pills.push(`
            <button class="${classes.join(' ')}" type="button" data-ep="${i}" title="${isWatched ? `Episode ${i} (Watched)` : `Episode ${i}`}">
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

        // Context menu / long-press: Allow manual toggle of watched status
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const ep = parseInt(btn.getAttribute('data-ep'), 10);
            if (ep && PlayerState.currentDrama) {
                const nowWatched = UserDataManager.toggleEpisodeWatched(PlayerState.currentDrama, ep);
                btn.classList.toggle('watched', nowWatched);
                showToast(nowWatched ? `Marked EP ${ep} as watched` : `Marked EP ${ep} as unwatched`);
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
    if (elements.bookmarksSection) elements.bookmarksSection.style.display = 'none';
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

