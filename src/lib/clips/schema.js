/**
 * The clip record, as the `yoga-break` Claude Code mod reads it from
 * `~/.yoga/clips.json` (https://github.com/NiKrause/yoga-break).
 *
 * This PWA is the source of that file, so the shape is fixed here and nowhere
 * else: every document in a playlist has exactly these fields, the export
 * writes exactly these fields, and the import accepts a file that has them
 * and ignores anything else. `addedBy` is the one field the mod does not know;
 * it ignores unknown fields, and the author's DID is what makes a shared
 * playlist attributable.
 *
 * Pure functions, no browser APIs: the same module runs in vitest and in the
 * export the e2e suite checks.
 */

/** @typedef {'youtube' | 'instagram' | 'vimeo' | 'other'} ClipSource */

/**
 * @typedef {{
 *   id: string
 *   url: string
 *   source: ClipSource
 *   title: string
 *   teacher: string
 *   durationSec: number
 *   tags: string[]
 *   addedAt: string
 *   addedBy: string
 * }} Clip
 */

export const SOURCES = /** @type {const} */ (['youtube', 'instagram', 'vimeo', 'other']);

/** The fields of a clip, in the order the file lists them. */
export const CLIP_FIELDS = /** @type {const} */ ([
	'id',
	'url',
	'source',
	'title',
	'teacher',
	'durationSec',
	'tags',
	'addedAt',
	'addedBy'
]);

/** Two to ten minutes is what the mod suggests between tool calls; the store
 * is more lenient so a 90-second breathing clip is not refused. */
export const MIN_DURATION_SEC = 30;
export const MAX_DURATION_SEC = 60 * 60;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]+$/;

/**
 * Parse something a person pasted into a URL, or null when it is not one.
 *
 * `https://` is assumed when the scheme is missing, because that is how links
 * arrive from a chat or a notes app. Anything that is not http(s) is refused:
 * the url is rendered as a link and opened in a new tab, and `javascript:`
 * must never get that far.
 *
 * @param {string} input
 * @returns {URL | null}
 */
export function parseUrl(input) {
	const text = String(input ?? '').trim();
	if (!text) return null;
	const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
	try {
		const url = new URL(withScheme);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
		if (!url.hostname.includes('.')) return null;
		return url;
	} catch {
		return null;
	}
}

/** @param {string} hostname */
function hostOf(hostname) {
	return hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
}

/**
 * Everything the app derives from a clip's url.
 *
 * @typedef {{
 *   source: ClipSource
 *   url: string
 *   videoId: string | null
 *   embedUrl: string | null
 *   thumbnailUrl: string | null
 * }} ParsedClipUrl
 */

/**
 * Which service a link points at, and how to show it.
 *
 * YouTube and Vimeo can be embedded (youtube-nocookie.com, player.vimeo.com),
 * and YouTube's thumbnail follows from the id alone. An Instagram post or
 * reel has an `/embed/` page of its own, the one Instagram's embed code
 * frames; the player frames it directly, so Instagram's script never runs in
 * this app's page. Whether the video then plays in the frame is Instagram's
 * decision (it did for a public reel in Chrome and WebKit, 2026-11-13), and
 * a private account shows nothing — the player keeps its "open" button.
 *
 * @param {string} input
 * @returns {ParsedClipUrl | null} null when the input is not a URL at all
 */
export function parseClipUrl(input) {
	const url = parseUrl(input);
	if (!url) return null;
	const host = hostOf(url.hostname);
	const path = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

	if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
		const id = youtubeId(host, path, url.searchParams);
		if (id) {
			return {
				source: 'youtube',
				url: `https://www.youtube.com/watch?v=${id}`,
				videoId: id,
				embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
				thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
			};
		}
		return { source: 'youtube', url: url.href, videoId: null, embedUrl: null, thumbnailUrl: null };
	}

	if (host === 'vimeo.com' || host === 'player.vimeo.com') {
		const id = vimeoId(path);
		if (id) {
			return {
				source: 'vimeo',
				url: `https://vimeo.com/${id}`,
				videoId: id,
				embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1`,
				// Vimeo's thumbnail comes with the oEmbed answer, not from the id.
				thumbnailUrl: null
			};
		}
		return { source: 'vimeo', url: url.href, videoId: null, embedUrl: null, thumbnailUrl: null };
	}

	if (host === 'instagram.com' || host === 'instagr.am') {
		const code = instagramCode(path);
		return {
			source: 'instagram',
			url: code ? `https://www.instagram.com/${path[0]}/${code}/` : url.href,
			videoId: code,
			// `/reels/<code>` is how the app shares a reel; its embed page
			// lives under `/reel/`. Everything else with a code is a post.
			embedUrl: code
				? `https://www.instagram.com/${path[0].startsWith('reel') ? 'reel' : 'p'}/${code}/embed/`
				: null,
			thumbnailUrl: null
		};
	}

	return { source: 'other', url: url.href, videoId: null, embedUrl: null, thumbnailUrl: null };
}

/**
 * @param {string} host
 * @param {string[]} path
 * @param {URLSearchParams} params
 */
function youtubeId(host, path, params) {
	/** @type {string | undefined} */
	let candidate;
	if (host === 'youtu.be') candidate = path[0];
	else if (path[0] === 'watch') candidate = params.get('v') ?? undefined;
	else if (['shorts', 'embed', 'live', 'v'].includes(path[0])) candidate = path[1];
	return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/** @param {string[]} path */
function vimeoId(path) {
	// vimeo.com/123, vimeo.com/channels/x/123, player.vimeo.com/video/123,
	// vimeo.com/123/abcdef (unlisted hash): the first all-digit segment.
	const candidate = path.find((segment) => VIMEO_ID.test(segment));
	return candidate ?? null;
}

/** @param {string[]} path */
function instagramCode(path) {
	if (!['p', 'reel', 'reels', 'tv'].includes(path[0])) return null;
	const code = path[1];
	return code && INSTAGRAM_CODE.test(code) ? code : null;
}

/** @param {unknown} value */
function isIsoDate(value) {
	return (
		typeof value === 'string' && value.length >= 10 && !Number.isNaN(new Date(value).getTime())
	);
}

/**
 * Validate a record against the schema.
 *
 * Returns the errors rather than throwing, so an import can say which of 40
 * clips it refused and why instead of stopping at the first.
 *
 * @param {unknown} input
 * @returns {{ ok: true, clip: Clip, errors: [] } | { ok: false, clip: null, errors: string[] }}
 */
export function validateClip(input) {
	/** @type {string[]} */
	const errors = [];
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return { ok: false, clip: null, errors: ['not an object'] };
	}
	const record = /** @type {Record<string, unknown>} */ (input);

	if (typeof record.id !== 'string' || !record.id.trim()) errors.push('id: missing');
	if (!parseUrl(typeof record.url === 'string' ? record.url : '')) errors.push('url: not a URL');
	if (!SOURCES.includes(/** @type {any} */ (record.source))) {
		errors.push(`source: not one of ${SOURCES.join(', ')}`);
	}
	if (typeof record.title !== 'string' || !record.title.trim()) errors.push('title: missing');
	if (typeof record.teacher !== 'string') errors.push('teacher: not a string');
	if (
		typeof record.durationSec !== 'number' ||
		!Number.isInteger(record.durationSec) ||
		record.durationSec < MIN_DURATION_SEC ||
		record.durationSec > MAX_DURATION_SEC
	) {
		errors.push(`durationSec: integer seconds between ${MIN_DURATION_SEC} and ${MAX_DURATION_SEC}`);
	}
	if (
		!Array.isArray(record.tags) ||
		record.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
	) {
		errors.push('tags: array of non-empty strings');
	}
	if (!isIsoDate(record.addedAt)) errors.push('addedAt: not an ISO-8601 date');
	if (typeof record.addedBy !== 'string') errors.push('addedBy: not a string');

	if (errors.length) return { ok: false, clip: null, errors };

	return {
		ok: true,
		clip: {
			id: /** @type {string} */ (record.id).trim(),
			url: /** @type {string} */ (record.url).trim(),
			source: /** @type {ClipSource} */ (record.source),
			title: /** @type {string} */ (record.title).trim(),
			teacher: /** @type {string} */ (record.teacher).trim(),
			durationSec: /** @type {number} */ (record.durationSec),
			tags: normalizeTags(/** @type {string[]} */ (record.tags)),
			addedAt: /** @type {string} */ (record.addedAt),
			addedBy: /** @type {string} */ (record.addedBy)
		},
		errors: []
	};
}

/**
 * Tags as they are stored: trimmed, lower-case, without duplicates and in the
 * order typed. Lower-case because "Schultern" and "schultern" are one filter.
 *
 * @param {string[]} tags
 */
export function normalizeTags(tags) {
	return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

/**
 * Comma- or space-separated tags from one input field.
 * @param {string} text
 */
export function parseTagInput(text) {
	return normalizeTags(String(text ?? '').split(/[,\s]+/));
}

/**
 * Build a new clip from the add form. Throws with the first validation error,
 * because the form shows one message.
 *
 * @param {{ url: string, title: string, teacher: string, durationSec: number, tags: string[] | string, addedBy: string, id?: string, now?: Date }} input
 * @returns {Clip}
 */
export function createClip({ url, title, teacher, durationSec, tags, addedBy, id, now }) {
	const parsed = parseClipUrl(url);
	if (!parsed) throw new Error('url: not a URL');
	const result = validateClip({
		id: id ?? randomUuid(),
		url: parsed.url,
		source: parsed.source,
		title,
		teacher,
		durationSec,
		tags: Array.isArray(tags) ? tags : parseTagInput(tags),
		addedAt: (now ?? new Date()).toISOString(),
		addedBy: addedBy ?? ''
	});
	if (!result.ok) throw new Error(result.errors[0]);
	return result.clip;
}

function randomUuid() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	// Node < 19 and very old browsers: not RFC 4122, but unique enough for a key.
	return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * The export: `{ "clips": [ … ] }` with exactly the schema fields, in the
 * schema's order, sorted by `addedAt` so two exports of the same playlist
 * diff cleanly.
 *
 * @param {Clip[]} clips
 */
export function toExportDocument(clips) {
	const sorted = [...clips].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
	return {
		clips: sorted.map((clip) =>
			Object.fromEntries(CLIP_FIELDS.map((field) => [field, clip[field]]))
		)
	};
}

/**
 * Read a clips.json back. Unknown fields are dropped, invalid clips are
 * reported by position, and nothing is written here — the caller decides what
 * to do with duplicates (same id as an existing clip).
 *
 * @param {string | unknown} json the file's text, or an already parsed value
 * @returns {{ clips: Clip[], rejected: { index: number, errors: string[] }[] }}
 */
export function parseImport(json) {
	let data = json;
	if (typeof json === 'string') {
		try {
			data = JSON.parse(json);
		} catch {
			throw new Error('not JSON');
		}
	}
	const list = Array.isArray(data)
		? data
		: data && typeof data === 'object' && Array.isArray(/** @type {any} */ (data).clips)
			? /** @type {any} */ (data).clips
			: null;
	if (!list) throw new Error('expected { "clips": [ … ] }');

	/** @type {Clip[]} */
	const clips = [];
	/** @type {{ index: number, errors: string[] }[]} */
	const rejected = [];
	list.forEach((/** @type {unknown} */ entry, /** @type {number} */ index) => {
		const result = validateClip(entry);
		if (result.ok) clips.push(result.clip);
		else rejected.push({ index, errors: result.errors });
	});
	return { clips, rejected };
}

/**
 * "5:00", "12:30" — what a duration looks like on a card.
 * @param {number} seconds
 */
export function formatDuration(seconds) {
	const total = Math.max(0, Math.round(seconds));
	const minutes = Math.floor(total / 60);
	const rest = total % 60;
	return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * "5:00" or "5" or "5m30s" typed by a person → seconds, or null.
 * @param {string} text
 */
export function parseDurationInput(text) {
	const value = String(text ?? '')
		.trim()
		.toLowerCase();
	if (!value) return null;
	const colon = value.match(/^(\d{1,3}):([0-5]?\d)$/);
	if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
	const units = value.match(/^(?:(\d{1,3})\s*m(?:in)?)?\s*(?:(\d{1,3})\s*s(?:ec)?)?$/);
	if (units && (units[1] || units[2])) return Number(units[1] ?? 0) * 60 + Number(units[2] ?? 0);
	const minutes = value.match(/^(\d{1,3}(?:[.,]\d+)?)$/);
	if (minutes) return Math.round(Number(minutes[1].replace(',', '.')) * 60);
	return null;
}
