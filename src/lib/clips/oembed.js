import { parseClipUrl } from './schema.js';

/**
 * Title and thumbnail for a pasted link, from the service's public oEmbed
 * endpoint. No API key, no script: one GET to youtube.com or vimeo.com, and
 * both answer with `Access-Control-Allow-Origin` (checked 2026-11). The
 * person who pastes a link is told in the consent screen that this request
 * happens, and it happens only then — never for clips somebody else added.
 *
 * oEmbed carries no duration, so the form still asks for it.
 */

const ENDPOINTS = {
	youtube: (/** @type {string} */ url) =>
		`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
	vimeo: (/** @type {string} */ url) =>
		`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
};

/**
 * @typedef {{ title: string, thumbnailUrl: string | null, authorName: string }} OEmbedInfo
 */

/**
 * @param {string} input the pasted link
 * @param {{ fetch?: typeof fetch, signal?: AbortSignal }} [options]
 * @returns {Promise<OEmbedInfo | null>} null for Instagram, "other", and when
 *   the service does not answer — the form then stays empty, which is not an
 *   error.
 */
export async function fetchOEmbed(input, { fetch: fetchImpl = fetch, signal } = {}) {
	const parsed = parseClipUrl(input);
	if (!parsed || !(parsed.source in ENDPOINTS)) return null;
	const endpoint = ENDPOINTS[/** @type {'youtube' | 'vimeo'} */ (parsed.source)](parsed.url);

	try {
		const response = await fetchImpl(endpoint, { signal, headers: { accept: 'application/json' } });
		if (!response.ok) return null;
		const data = await response.json();
		return {
			title: typeof data.title === 'string' ? data.title : '',
			thumbnailUrl:
				typeof data.thumbnail_url === 'string' && /^https:\/\//.test(data.thumbnail_url)
					? data.thumbnail_url
					: parsed.thumbnailUrl,
			authorName: typeof data.author_name === 'string' ? data.author_name : ''
		};
	} catch {
		return null;
	}
}
