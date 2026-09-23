/**
 * DramaParser - Robust HTML & JSON-LD parser for streaming drama websites
 * Handles search result pages, single detail/watch pages, and dynamic episode extraction.
 * Strips all promotional and provider branding text.
 */
const DramaParser = (() => {
    /**
     * Parse HTML string and return an array of drama items plus page metadata
     * @param {string} htmlString - Raw HTML document string
     * @param {string} fallbackBaseUrl - Base URL for relative links
     * @returns {{ items: Array, type: 'search'|'detail', detail?: Object }}
     */
    function parse(htmlString, fallbackBaseUrl = 'https://narto-drama.com') {
        if (!htmlString || typeof htmlString !== 'string') {
            return { items: [], type: 'search' };
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        // 1. Check if this is a single drama detail page (like watch pages)
        const detailInfo = parseDetailPage(doc, fallbackBaseUrl);
        if (detailInfo && detailInfo.title && detailInfo.episodeList && detailInfo.episodeList.length > 0) {
            const relatedItems = parseRelatedItems(doc, fallbackBaseUrl);
            const items = [detailInfo, ...relatedItems];
            return {
                items,
                type: 'detail',
                detail: detailInfo
            };
        }

        // 2. Try parsing DOM search cards (.provider-search-card or .card)
        const domItems = parseDomSearchCards(doc, fallbackBaseUrl);

        // 3. Try parsing JSON-LD ItemList from search collection
        const jsonLdItems = parseJsonLd(doc, fallbackBaseUrl);

        // Merge DOM and JSON-LD results
        const mergedMap = new Map();

        domItems.forEach(item => {
            const key = normalizeKey(item.title || item.url);
            mergedMap.set(key, item);
        });

        jsonLdItems.forEach(item => {
            const key = normalizeKey(item.title || item.url);
            if (!mergedMap.has(key)) {
                mergedMap.set(key, item);
            } else {
                const existing = mergedMap.get(key);
                if (!existing.poster && item.poster) existing.poster = item.poster;
                if (!existing.url && item.url) existing.url = item.url;
                if (!existing.episodes && item.episodes) existing.episodes = item.episodes;
            }
        });

        // 4. Also check "You May Like" cards if search returned nothing
        if (mergedMap.size === 0) {
            const related = parseRelatedItems(doc, fallbackBaseUrl);
            related.forEach(item => {
                const key = normalizeKey(item.title || item.url);
                mergedMap.set(key, item);
            });
        }

        // 5. If it's a detail page without episodes list yet, still return it
        if (mergedMap.size === 0 && detailInfo && detailInfo.title) {
            return {
                items: [detailInfo],
                type: 'detail',
                detail: detailInfo
            };
        }

        return {
            items: Array.from(mergedMap.values()),
            type: 'search'
        };
    }

    /**
     * Parse structured JSON-LD data from <script type="application/ld+json">
     */
    function parseJsonLd(doc, baseUrl) {
        const items = [];
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

        scripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent || '{}');
                // Check for CollectionPage with ItemList
                if (data['@type'] === 'CollectionPage' && data.mainEntity && Array.isArray(data.mainEntity.itemListElement)) {
                    data.mainEntity.itemListElement.forEach(entry => {
                        const title = cleanText(entry.name || 'Untitled Drama');
                        const item = {
                            id: extractIdFromUrl(entry.url || ''),
                            title: title,
                            poster: resolveUrl(entry.image || '', baseUrl),
                            url: resolveUrl(entry.url || '', baseUrl),
                            description: '',
                            episodes: extractEpisodesFromText(title, ''),
                            episodeList: [],
                            tags: extractTagsFromTitle(title)
                        };
                        if (item.title && item.url) {
                            items.push(item);
                        }
                    });
                }
                // Check for direct ItemList
                else if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
                    data.itemListElement.forEach(entry => {
                        if (entry.name && entry.url && !entry['@type']?.includes('SiteNavigationElement')) {
                            const title = cleanText(entry.name);
                            const desc = cleanDescription(entry.description || '');
                            items.push({
                                id: extractIdFromUrl(entry.url || ''),
                                title: title,
                                poster: resolveUrl(entry.image || '', baseUrl),
                                url: resolveUrl(entry.url, baseUrl),
                                description: desc,
                                episodes: extractEpisodesFromText(title, desc),
                                episodeList: [],
                                tags: extractTagsFromTitle(title)
                            });
                        }
                    });
                }
                // Check for single TVSeries
                else if (data['@type'] === 'TVSeries') {
                    const title = cleanText(data.name || '');
                    const desc = cleanDescription(data.description || '');
                    items.push({
                        id: extractIdFromUrl(data.url || ''),
                        title: title,
                        poster: resolveUrl(data.image || '', baseUrl),
                        url: resolveUrl(data.url || '', baseUrl),
                        description: desc,
                        episodes: extractEpisodesFromText(title, desc),
                        episodeList: [],
                        tags: extractTagsFromTitle(title)
                    });
                }
            } catch (e) {
                // Ignore JSON-LD parse errors
            }
        });

        return items;
    }

    /**
     * Parse DOM elements from the search results grid
     */
    function parseDomSearchCards(doc, baseUrl) {
        const items = [];
        const cardElements = doc.querySelectorAll('.provider-search-card, #search-results-grid .card, .grid.provider-results .card');

        cardElements.forEach(card => {
            const watchUrlRaw = card.getAttribute('data-watch-url')
                || card.querySelector('a.card-link-overlay')?.getAttribute('href')
                || card.querySelector('a')?.getAttribute('href')
                || '';
            
            const titleRaw = card.getAttribute('data-search-title')
                || card.querySelector('.title')?.textContent
                || card.querySelector('h3')?.textContent
                || card.querySelector('a.card-link-overlay')?.textContent
                || '';

            const descRaw = card.getAttribute('data-search-description')
                || card.querySelector('.provider-search-desc')?.textContent
                || card.querySelector('.desc')?.textContent
                || '';

            const imgEl = card.querySelector('.poster, img');
            const posterRaw = imgEl?.getAttribute('src')
                || imgEl?.getAttribute('data-src')
                || card.getAttribute('data-poster')
                || '';

            const cleanTitleStr = cleanText(titleRaw);
            const cleanDescStr = cleanDescription(descRaw);

            if (cleanTitleStr) {
                items.push({
                    id: extractIdFromUrl(watchUrlRaw),
                    title: cleanTitleStr,
                    poster: resolveUrl(posterRaw, baseUrl),
                    url: resolveUrl(watchUrlRaw, baseUrl),
                    description: cleanDescStr,
                    episodes: extractEpisodesFromText(cleanTitleStr, cleanDescStr),
                    episodeList: [],
                    tags: extractTagsFromTitle(cleanTitleStr)
                });
            }
        });

        return items;
    }

    /**
     * Parse single drama detail page (e.g. /detail/watch/entes-mas-fuerte)
     */
    function parseDetailPage(doc, baseUrl) {
        const titleEl = doc.querySelector('.movie-title, h1.movie-title')
            || doc.querySelector('meta[property="og:title"]');
        const posterEl = doc.querySelector('.movie-meta .poster, img.poster')
            || doc.querySelector('meta[property="og:image"]');
        const descEl = doc.querySelector('.movie-desc')
            || doc.querySelector('meta[property="og:description"]');
        const subEl = doc.querySelector('.movie-sub');

        let title = '';
        if (titleEl) {
            title = titleEl.tagName === 'META' ? titleEl.getAttribute('content') : titleEl.textContent;
        }

        if (!title) return null;

        let poster = '';
        if (posterEl) {
            poster = posterEl.tagName === 'META' ? posterEl.getAttribute('content') : (posterEl.getAttribute('src') || '');
        }

        let desc = '';
        if (descEl) {
            desc = descEl.tagName === 'META' ? descEl.getAttribute('content') : descEl.textContent;
        }

        // Clean extracted title & description
        title = cleanText(title);
        desc = cleanDescription(desc);

        // Parse tags
        const tags = [];
        doc.querySelectorAll('.movie-tags .movie-tag-pill, .movie-tags a').forEach(tagEl => {
            const tagText = cleanText(tagEl.textContent.replace(/^#/, ''));
            if (tagText && !isBrandedWord(tagText)) tags.push(tagText);
        });

        // Parse episode count & episodes list
        const episodeElements = doc.querySelectorAll('.episode-list .episode-item, .episode-list a');
        const episodeList = [];
        episodeElements.forEach(ep => {
            const epNum = cleanText(ep.textContent);
            const epUrl = ep.getAttribute('href');
            if (epNum) {
                episodeList.push({
                    number: epNum,
                    url: resolveUrl(epUrl || '', baseUrl)
                });
            }
        });

        let episodeCount = episodeList.length;
        if (episodeCount === 0 && subEl) {
            const match = subEl.textContent.match(/(\d+)\s*Episodes/i);
            if (match) episodeCount = parseInt(match[1], 10);
        }

        if (episodeCount === 0) {
            episodeCount = extractEpisodesFromText(title, desc);
        }

        // Canonical watch URL
        const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
            || doc.querySelector('meta[property="og:url"]')?.getAttribute('content')
            || '';

        return {
            id: extractIdFromUrl(canonical || title),
            title: title,
            poster: resolveUrl(poster, baseUrl),
            url: resolveUrl(canonical, baseUrl),
            description: desc,
            episodes: episodeCount > 0 ? episodeCount : (episodeList.length || null),
            episodeList: episodeList,
            tags: tags.length ? tags : extractTagsFromTitle(title),
            isDetailPage: true
        };
    }

    /**
     * Dedicated method to parse real episodes from a fetched detail page
     */
    function parseEpisodesFromDetailPage(htmlString, baseUrl = 'https://narto-drama.com') {
        if (!htmlString) return { episodeCount: 0, episodeList: [], description: '', tags: [] };

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        const episodeElements = doc.querySelectorAll('.episode-list .episode-item, .episode-list a');
        const episodeList = [];

        episodeElements.forEach(ep => {
            const epNum = cleanText(ep.textContent);
            const epUrl = ep.getAttribute('href');
            if (epNum) {
                episodeList.push({
                    number: epNum,
                    url: resolveUrl(epUrl || '', baseUrl)
                });
            }
        });

        const subEl = doc.querySelector('.movie-sub');
        let episodeCount = episodeList.length;
        if (episodeCount === 0 && subEl) {
            const match = subEl.textContent.match(/(\d+)\s*Episodes/i);
            if (match) episodeCount = parseInt(match[1], 10);
        }

        const descEl = doc.querySelector('.movie-desc')
            || doc.querySelector('meta[property="og:description"]');
        const rawDesc = descEl ? (descEl.tagName === 'META' ? descEl.getAttribute('content') : descEl.textContent) : '';
        const desc = cleanDescription(rawDesc);

        if (episodeCount === 0) {
            episodeCount = extractEpisodesFromText('', desc);
        }

        const tags = [];
        doc.querySelectorAll('.movie-tags .movie-tag-pill, .movie-tags a').forEach(tagEl => {
            const tagText = cleanText(tagEl.textContent.replace(/^#/, ''));
            if (tagText && !isBrandedWord(tagText)) tags.push(tagText);
        });

        return {
            episodeCount,
            episodeList,
            description: desc,
            tags
        };
    }

    /**
     * Parse "You May Like" cards from aside / sidebar
     */
    function parseRelatedItems(doc, baseUrl) {
        const items = [];
        const relatedCards = doc.querySelectorAll('.you-may-like-card, .you-may-like a');

        relatedCards.forEach(card => {
            const href = card.getAttribute('href') || '';
            const titleEl = card.querySelector('.you-may-like-name') || card;
            const imgEl = card.querySelector('img, .you-may-like-img');

            const title = card.getAttribute('title') || titleEl.textContent;
            const poster = imgEl?.getAttribute('src') || '';
            const cleanTitleStr = cleanText(title);

            if (cleanTitleStr) {
                items.push({
                    id: extractIdFromUrl(href),
                    title: cleanTitleStr,
                    poster: resolveUrl(poster, baseUrl),
                    url: resolveUrl(href, baseUrl),
                    description: '',
                    episodes: extractEpisodesFromText(cleanTitleStr, ''),
                    episodeList: [],
                    tags: extractTagsFromTitle(cleanTitleStr)
                });
            }
        });

        return items;
    }

    /**
     * Clean text and strip provider branding
     */
    function cleanText(text) {
        if (!text) return '';
        let cleaned = text
            .replace(/\s+/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\bNarto\s*Drama\b/gi, '')
            .replace(/\bNartoDrama\b/gi, '')
            .replace(/\s+-\s+Free Streaming\b/gi, '')
            .replace(/\s+-\s+Narto Drama\b/gi, '')
            .trim();

        return cleaned;
    }

    /**
     * Clean descriptions and remove any provider promotional boilerplate
     */
    function cleanDescription(desc) {
        if (!desc) return '';
        let cleaned = cleanText(desc);

        // Strip provider boilerplate
        cleaned = cleaned
            .replace(/(?:[-–—:]\s*)?Watch\s+Short\s+Dramas[^\n.]*(\.|$)/gi, '')
            .replace(/Watch\s+[^.]*with\s+free\s+streaming(\.|$)/gi, '')
            .replace(/free\s+from\s+providers[^\n.]*(\.|$)/gi, '')
            .replace(/Continue\s+to\s+the\s+first\s+episode[^\n.]*(\.|$)/gi, '')
            .replace(/Synopsis\s+[^:]+:\s*/gi, '')
            .replace(/\s*[-–—:]\s*$/g, '')
            .trim();

        return cleaned;
    }

    /**
     * Check if a tag or word is provider branding
     */
    function isBrandedWord(word) {
        return /narto|dramabox|bilitv|shortical/i.test(word);
    }

    /**
     * Extract total episodes count integer from text/description if present
     */
    function extractEpisodesFromText(title, desc) {
        const fullText = `${title || ''} ${desc || ''}`;
        const match = fullText.match(/(\d+)\s*(?:episodes?|eps?|cap[ií]tulos?|cap\.)/i);
        if (match) {
            const count = parseInt(match[1], 10);
            if (count > 0 && count < 1000) return count;
        }
        return null;
    }

    function resolveUrl(url, baseUrl) {
        if (!url) return '';
        const trimmed = url.trim();
        if (trimmed.startsWith('//')) {
            return 'https:' + trimmed;
        }
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        if (trimmed.startsWith('/')) {
            return baseUrl.replace(/\/+$/, '') + trimmed;
        }
        return baseUrl.replace(/\/+$/, '') + '/' + trimmed;
    }

    function extractIdFromUrl(url) {
        if (!url) return Math.random().toString(36).substring(2, 9);
        const match = url.match(/watch\/([^/?&#]+)/);
        if (match) return match[1];
        const lastPart = url.split('?')[0].split('/').filter(Boolean).pop();
        return lastPart || Math.random().toString(36).substring(2, 9);
    }

    function normalizeKey(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function extractTagsFromTitle(title) {
        const tags = [];
        if (/\[doblado\]|\(dub\)|\(doblado\)/i.test(title)) tags.push('Dubbed');
        if (/ceo/i.test(title)) tags.push('CEO');
        if (/rebirth|regreso|return/i.test(title)) tags.push('Rebirth');
        if (/venganza|revenge/i.test(title)) tags.push('Revenge');
        if (/sistema|system/i.test(title)) tags.push('System');
        return tags;
    }

    /**
     * Clean escaped URLs from JSON strings
     */
    function cleanJsonUrl(str) {
        if (!str) return '';
        return str.replace(/\\\//g, '/').replace(/\\u0026/g, '&').trim();
    }

    /**
     * Extract streaming video data (m3u8, mp4, episode list) from an episode watch page HTML
     */
    function extractStreamData(htmlString, pageUrl = '') {
        if (!htmlString || typeof htmlString !== 'string') {
            return { streamUrl: '', isHls: false, episodes: [], currentEpisode: 1, title: '' };
        }

        let streamUrl = '';
        let episodes = [];
        let currentEpisode = 1;
        let title = '';

        // Extract title from <title> or meta
        const titleMatch = htmlString.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
            title = cleanText(titleMatch[1].replace(/\s*-\s*(?:Free\s+Streaming|Streaming\s+Gratis|Narto\s+Drama).*$/i, ''));
        }

        // Extract current episode number from pageUrl or title
        if (pageUrl) {
            const epMatch = pageUrl.match(/\/watch\/[^/]+\/(\d+)/i);
            if (epMatch) currentEpisode = parseInt(epMatch[1], 10);
        }
        if (!currentEpisode || currentEpisode === 1) {
            const epTitleMatch = title.match(/Episode\s*(\d+)/i);
            if (epTitleMatch) currentEpisode = parseInt(epTitleMatch[1], 10);
        }

        // 1. Direct initialSourceUrl pattern: const initialSourceUrl = "https:\/\/..." or JSON key
        const initMatch = htmlString.match(/(?:const|let|var)?\s*["']?initialSourceUrl["']?\s*[:=]\s*["']([^"']+)["']/i)
            || htmlString.match(/(?:const|let|var)?\s*["']?(?:video_url|videoUrl|streamUrl|playUrl|stream_url)["']?\s*[:=]\s*["']([^"']+)["']/i);
        if (initMatch && initMatch[1]) {
            streamUrl = cleanJsonUrl(initMatch[1]);
        }

        // 2. Direct episodeItemsRaw pattern: const episodeItemsRaw = [ { ... }, ... ]; or JSON key
        const rawMatch = htmlString.match(/(?:const|let|var)?\s*["']?episodeItemsRaw["']?\s*[:=]\s*(\[[\s\S]*?\])\s*(?:const|let|var|;|,\s*["']|\n|}|<\/script>|$)/i);
        if (rawMatch && rawMatch[1]) {
            try {
                const parsed = JSON.parse(rawMatch[1]);
                if (Array.isArray(parsed)) {
                    episodes = parsed.map(item => {
                        const epNum = item.route_episode_number || item.number || 1;
                        const epPlayUrl = cleanJsonUrl(item.play_url || item.direct_play_url || item.stream_url || '');
                        const epDirectUrl = cleanJsonUrl(item.direct_play_url || '');
                        const epThumb = cleanJsonUrl(item.thumb_url || '');
                        const epSub = cleanJsonUrl(item.subtitle_url || '');
                        const isHls = (item.direct_play_is_hls === true) || /\.m3u8(?:\?|$)/i.test(epPlayUrl) || /\.m3u8(?:\?|$)/i.test(epDirectUrl);
                        return {
                            number: epNum,
                            title: item.title ? cleanText(item.title) : `Episode ${epNum}`,
                            playUrl: epPlayUrl || epDirectUrl,
                            directPlayUrl: epDirectUrl,
                            subtitleUrl: epSub,
                            thumbUrl: epThumb,
                            isHls
                        };
                    });
                }
            } catch (e) {
                // Ignore JSON parse error, proceed to fallback
            }
        }

        // If streamUrl not found, see if active episode in parsed episodes array has playUrl
        if (!streamUrl && episodes.length > 0) {
            const activeEp = episodes.find(e => e.number === currentEpisode) || episodes[0];
            if (activeEp && activeEp.playUrl) {
                streamUrl = activeEp.playUrl;
            }
        }

        // 3. Fallback: Search for any .m3u8 in the document (supports escaped \/)
        if (!streamUrl) {
            const m3u8Match = htmlString.match(/https?:[^\s"'<>]+?\.m3u8(?:[^\s"'<>]*)?/i);
            if (m3u8Match) {
                streamUrl = cleanJsonUrl(m3u8Match[0]);
            }
        }

        // 4. Fallback: Search for any .mp4 in the document (supports escaped \/)
        if (!streamUrl) {
            const mp4Match = htmlString.match(/https?:[^\s"'<>]+?\.mp4(?:[^\s"'<>]*)?/i);
            if (mp4Match) {
                streamUrl = cleanJsonUrl(mp4Match[0]);
            }
        }

        // 5. Fallback: Video src or source tag
        if (!streamUrl) {
            const videoSrcMatch = htmlString.match(/<video[^>]+src=["']([^"']+)["']/i) || htmlString.match(/<source[^>]+src=["']([^"']+)["']/i);
            if (videoSrcMatch && videoSrcMatch[1]) {
                streamUrl = cleanJsonUrl(videoSrcMatch[1]);
            }
        }

        const isHls = /\.m3u8(?:\?|$)/i.test(streamUrl);

        return {
            title,
            streamUrl,
            isHls,
            currentEpisode,
            episodes
        };
    }

    return {
        parse,
        parseEpisodesFromDetailPage,
        extractStreamData,
        cleanText,
        cleanDescription,
        cleanJsonUrl,
        resolveUrl
    };
})();

// Global alias for compatibility
const NartoDramaParser = DramaParser;

// Export for Node/testing if present, or global window in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DramaParser;
}
