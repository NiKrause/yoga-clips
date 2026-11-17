import { parseClipUrl } from './schema.js';

/**
 * When a clip was posted, where the link itself says so.
 *
 * An Instagram link does: the code in `/p/<code>/` or `/reel/<code>/` is the
 * post's id written in base 64, and the id begins with the moment it was made
 * — 41 bits of milliseconds since Instagram's own epoch, then 13 bits for the
 * shard and 10 for a sequence ("Sharding & IDs at Instagram", Instagram
 * Engineering, 2012). So the date costs no request and nobody is asked; it is
 * computed wherever a clip is shown and is not stored in the playlist.
 *
 * Checked 2026-11-17 against the sample post in Meta's oEmbed documentation:
 * the id computed from its code is the `media_id` Instagram answers with.
 *
 * YouTube and Vimeo ids carry no date, so there is none for them.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Instagram's epoch, 2011-08-24T21:07:01.721Z, in milliseconds. */
const EPOCH_MS = 1314220021721n;
/** The bits after the time: 13 for the shard, 10 for the sequence. */
const AFTER_TIME = 23n;
/**
 * The longest code that is an id alone. A post of a private account has a
 * longer one, with more than the id in it; that one is left alone.
 */
const LONGEST_CODE = 11;
const DAY_MS = 86_400_000;

/**
 * @param {string | null | undefined} code the code of an Instagram post or reel
 * @param {Date} [now]
 * @returns {Date | null} null when the code does not hold a believable date:
 *   not a code, an id from before this scheme (those counted up from 1), or a
 *   moment that has not come yet
 */
export function instagramPostedAt(code, now = new Date()) {
	if (typeof code !== 'string' || !code || code.length > LONGEST_CODE) return null;
	let id = 0n;
	for (const char of code) {
		const value = ALPHABET.indexOf(char);
		if (value < 0) return null;
		id = id * 64n + BigInt(value);
	}
	const sinceEpoch = id >> AFTER_TIME;
	if (sinceEpoch < BigInt(DAY_MS)) return null;
	const at = sinceEpoch + EPOCH_MS;
	if (at > BigInt(now.getTime() + DAY_MS)) return null;
	return new Date(Number(at));
}

/**
 * @param {string} url a clip's link
 * @param {Date} [now]
 * @returns {Date | null}
 */
export function postedAt(url, now = new Date()) {
	const parsed = parseClipUrl(url);
	if (parsed?.source !== 'instagram') return null;
	return instagramPostedAt(parsed.videoId, now);
}

/**
 * The date as a person reads it, in their language and their own time zone:
 * "Oct 3, 2013", "03.10.2013".
 *
 * @param {Date} date
 * @param {string | null | undefined} locale
 */
export function formatPosted(date, locale) {
	return new Intl.DateTimeFormat(locale || 'en', { dateStyle: 'medium' }).format(date);
}
