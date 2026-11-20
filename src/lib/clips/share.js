/**
 * Links into this app.
 *
 * `?db=<address>` opens a playlist — what a friend receives, as text or as a
 * QR code. `?clip=<id>` opens a clip in the cinema page — the clip alone,
 * large, on a dark page. Every clip link gets the cinema: there is no
 * parameter for it. Both may be combined. The address must be an OrbitDB
 * address, the id must look like one of ours.
 *
 * A clip link may also carry the clip itself — `url`, and optionally
 * `title`, `teacher` and `sec` — which is how the `yoga-break` mod sends
 * people here. Such a link plays without the app starting: the cinema page
 * is built from the link alone, so there is no consent screen, no identity,
 * no relay and no database, and nobody is contacted until the start control
 * is pressed. The press loads the clip's player from its service, and the
 * page says which one before it. `parseStandaloneClip` reads such a link;
 * the frame is built from the id `parseClipUrl` finds in `url`, never from
 * the string itself, and the texts are plain text, cut short. Without a
 * valid `url` the link is an ordinary clip link: the app starts, and the
 * clip is fetched from the playlist. Nothing else is read from the URL.
 */

import { MAX_DURATION_SEC, parseClipUrl } from './schema.js';

const ADDRESS = /^\/orbitdb\/[A-Za-z0-9]+$/;
const CLIP_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * @param {string} search `location.search`, with or without the `?`
 * @returns {{ db: string | null, clip: string | null }}
 */
export function parseAppLink(search) {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const db = params.get('db')?.trim() ?? '';
	const clip = params.get('clip')?.trim() ?? '';
	return {
		db: ADDRESS.test(db) ? db : null,
		clip: CLIP_ID.test(clip) ? clip : null
	};
}

/**
 * @param {string} origin e.g. `https://yoga-clips.le-space.de`
 * @param {{ db?: string | null, clip?: string | null }} parts
 */
export function buildAppLink(origin, { db, clip } = {}) {
	const params = new URLSearchParams();
	if (db) params.set('db', db);
	if (clip) params.set('clip', clip);
	const query = params.toString();
	return `${origin.replace(/\/$/, '')}/${query ? `?${query}` : ''}`;
}

/** The parameters a clip link may carry besides `db` and `clip`. */
export const CLIP_LINK_FIELDS = /** @type {const} */ (['url', 'title', 'teacher', 'sec']);

export const LINK_TEXT_MAX = 120;
const LINK_URL_MAX = 2048;

/**
 * A text from a link, as text: control characters and the marks that turn
 * the direction of text around are dropped, white space is collapsed, and
 * it is cut at `LINK_TEXT_MAX` characters.
 *
 * @param {string | null} value
 */
export function linkText(value) {
	const text = String(value ?? '')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069\u2028\u2029]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return Array.from(text).slice(0, LINK_TEXT_MAX).join('').trim();
}

/**
 * The clip a link carries, or null when it carries none that can be shown.
 *
 * `clip` must be one of our ids and `url` an `https://` address written out
 * in full. A YouTube, Vimeo or Instagram address keeps only what
 * `parseClipUrl` takes from it; any other address is kept as it is and is
 * only ever opened in a new tab, with its host shown beside the button.
 *
 * @param {string} search `location.search`, with or without the `?`
 * @returns {{
 *   db: string | null,
 *   clip: import('./schema.js').Clip,
 *   parsed: import('./schema.js').ParsedClipUrl,
 *   host: string
 * } | null}
 */
export function parseStandaloneClip(search) {
	const { db, clip: id } = parseAppLink(search);
	if (!id) return null;
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const raw = params.get('url')?.trim() ?? '';
	if (!raw || raw.length > LINK_URL_MAX || !/^https:\/\//i.test(raw)) return null;
	const parsed = parseClipUrl(raw);
	if (!parsed) return null;
	/** @type {URL} */
	let address;
	try {
		address = new URL(parsed.url);
	} catch {
		return null;
	}
	if (address.protocol !== 'https:' || address.username || address.password) return null;

	const secText = params.get('sec')?.trim() ?? '';
	const sec = /^\d{1,5}$/.test(secText) ? Number(secText) : 0;
	return {
		db,
		clip: {
			id,
			url: address.href,
			source: parsed.source,
			title: linkText(params.get('title')),
			teacher: linkText(params.get('teacher')),
			durationSec: sec > 0 && sec <= MAX_DURATION_SEC ? sec : 0,
			tags: [],
			addedAt: '',
			addedBy: ''
		},
		parsed,
		host: address.hostname
	};
}

/**
 * The address of the full app for a clip link: what "To the library" leads
 * to. The clip's own parameters go, `db` stays.
 *
 * @param {string} href `location.href`
 */
export function withoutClipLink(href) {
	const url = new URL(href);
	for (const name of ['clip', ...CLIP_LINK_FIELDS]) url.searchParams.delete(name);
	return url;
}
