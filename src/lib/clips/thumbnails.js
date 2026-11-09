import { fetchOEmbed } from './oembed.js';
import { parseClipUrl } from './schema.js';

/**
 * A preview image per clip, without a field for it in the schema.
 *
 * YouTube's follows from the video id (i.ytimg.com), so it costs nothing to
 * know. Vimeo's only comes with the oEmbed answer, so it is asked for once per
 * clip and remembered in localStorage — a playlist of twenty clips should not
 * ask vimeo.com twenty times on every visit. Instagram and "other" have none;
 * the card shows its fallback.
 */

const CACHE_KEY = 'yogaClips.thumbnails';
/** @type {Record<string, string> | null} */
let cache = null;
/** @type {Map<string, Promise<string | null>>} */
const inFlight = new Map();

/** @returns {Record<string, string>} */
function readCache() {
	if (cache) return cache;
	try {
		const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
		cache = parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		cache = {};
	}
	return /** @type {Record<string, string>} */ (cache);
}

/** @param {string} id @param {string} url */
function remember(id, url) {
	const store = readCache();
	store[id] = url;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(store));
	} catch {
		// Fine: the in-memory copy serves this page view.
	}
}

/**
 * @param {{ id: string, url: string, source: string }} clip
 * @returns {Promise<string | null>}
 */
export function thumbnailFor(clip) {
	const parsed = parseClipUrl(clip.url);
	if (parsed?.thumbnailUrl) return Promise.resolve(parsed.thumbnailUrl);
	if (clip.source !== 'vimeo') return Promise.resolve(null);

	const cached = readCache()[clip.id];
	if (cached) return Promise.resolve(cached);

	const pending = inFlight.get(clip.id);
	if (pending) return pending;
	const lookup = fetchOEmbed(clip.url)
		.then((info) => {
			if (info?.thumbnailUrl) remember(clip.id, info.thumbnailUrl);
			return info?.thumbnailUrl ?? null;
		})
		.finally(() => inFlight.delete(clip.id));
	inFlight.set(clip.id, lookup);
	return lookup;
}

/**
 * The thumbnail the add form already fetched: keep it, so the card does not
 * ask again a second later.
 * @param {string} id @param {string | null | undefined} url
 */
export function rememberThumbnail(id, url) {
	if (url) remember(id, url);
}
