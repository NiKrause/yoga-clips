/**
 * Links into this app.
 *
 * `?db=<address>` opens a playlist — what a friend receives, as text or as a
 * QR code. `?clip=<id>` opens a clip in the player; the `yoga-break` mod
 * sends people here with it. Both may be combined. Nothing else is read from
 * the URL, and both values are validated before use: the address must be an
 * OrbitDB address, the id must look like one of ours.
 */

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
