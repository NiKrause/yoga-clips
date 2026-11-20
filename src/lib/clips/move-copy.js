import { parseClipUrl, validateClip } from './schema.js';

/**
 * A clip into another playlist, as a copy or as a move (NiKrause/yoga-clips#12).
 *
 * What travels is the clip: `id`, `url`, `source`, `title`, `teacher`,
 * `durationSec`, `tags`. The `id` stays, because it is the same clip in
 * another place: what a person marked as done is kept per person and per
 * clip id, outside any playlist (`done.js`), so "done 3 times" stands in
 * both playlists and Practise counts the clip once.
 *
 * What does not travel is how the clip came into the source playlist:
 * `addedAt` and `addedBy` are set anew. In the target it was added now, by
 * whoever copied it — the identity OrbitDB signs the entry with — and that
 * is who may remove it there again.
 *
 * A move writes the target first and removes from the source only after
 * that write succeeded. A move that fails halfway leaves the clip in both
 * playlists, never in none; doing it again finishes it.
 *
 * Everything here works on what a playlist database offers (`all`, `put`,
 * `del`), so it is tested without OrbitDB.
 */

/** @typedef {import('./schema.js').Clip} Clip */

/**
 * @typedef {{
 *   all: () => Promise<{ value: unknown }[]>
 *   put: (clip: Clip) => Promise<unknown>
 *   del: (id: string) => Promise<unknown>
 * }} ClipDatabase
 */

/**
 * Whether an identity may write to a playlist, from what the playlist's
 * access controller says: named as a writer or an admin, or everyone is.
 *
 * This is the one question the target list is built from — not "is this
 * playlist mine". A playlist somebody else owns and has let this identity
 * into answers yes here too.
 *
 * @param {{ write?: Iterable<string> | null, admin?: Iterable<string> | null } | null | undefined} capabilities
 * @param {string} identityId
 */
export function canWrite(capabilities, identityId) {
	if (!capabilities || !identityId) return false;
	for (const list of [capabilities.write, capabilities.admin]) {
		if (!list) continue;
		for (const id of list) if (id === identityId || id === '*') return true;
	}
	return false;
}

/**
 * The address a clip's link leads to, written one way: a `youtu.be` link and
 * its `youtube.com/watch` form are the same clip.
 *
 * @param {string} url
 */
function sameAddress(url) {
	return parseClipUrl(url)?.url ?? url;
}

/**
 * Whether a playlist already has a clip: the clip itself (its id), or
 * another entry with the same link.
 *
 * @param {Clip[]} clips the target's clips
 * @param {Clip} clip
 * @returns {'same' | 'sameUrl' | null}
 */
export function findInPlaylist(clips, clip) {
	if (clips.some((other) => other.id === clip.id)) return 'same';
	const address = sameAddress(clip.url);
	return clips.some((other) => sameAddress(other.url) === address) ? 'sameUrl' : null;
}

/**
 * The clip as it is written into the target.
 *
 * @param {Clip} clip
 * @param {{ addedBy: string, now?: Date }} options
 * @returns {Clip}
 */
export function clipForTarget(clip, { addedBy, now = new Date() }) {
	const result = validateClip({
		id: clip.id,
		url: clip.url,
		source: clip.source,
		title: clip.title,
		teacher: clip.teacher,
		durationSec: clip.durationSec,
		tags: [...clip.tags],
		addedAt: now.toISOString(),
		addedBy
	});
	if (!result.ok) throw new Error(`Not a clip: ${result.errors.join('; ')}`);
	return result.clip;
}

/**
 * @typedef {{ ok: true, mode: 'copy' | 'move', written: boolean }
 *   | { ok: false, kind: 'duplicate', written: false }
 *   | { ok: false, kind: 'target', error: unknown, written: false }
 *   | { ok: false, kind: 'notRemoved', error: unknown, written: boolean }} MoveCopyResult
 *   `written`: whether this call wrote the clip into the target.
 */

/**
 * @param {{
 *   mode: 'copy' | 'move'
 *   clip: Clip
 *   source: Pick<ClipDatabase, 'del'>
 *   target: Pick<ClipDatabase, 'all' | 'put'>
 *   identityId: string
 *   now?: Date
 * }} options
 * @returns {Promise<MoveCopyResult>}
 */
export async function moveOrCopy({ mode, clip, source, target, identityId, now }) {
	/** @type {'same' | 'sameUrl' | null} */
	let there;
	try {
		const records = await target.all();
		const clips = records
			.map((record) => validateClip(record.value))
			.flatMap((result) => (result.ok ? [result.clip] : []));
		there = findInPlaylist(clips, clip);
	} catch (error) {
		return { ok: false, kind: 'target', error, written: false };
	}

	// Another entry with this link, or a copy of a clip that is there: nothing
	// to write. A move of a clip that is there already is the second half of
	// a move that did not finish, and goes on to the removal.
	if (there === 'sameUrl' || (there === 'same' && mode === 'copy')) {
		return { ok: false, kind: 'duplicate', written: false };
	}

	let written = false;
	if (!there) {
		try {
			await target.put(clipForTarget(clip, { addedBy: identityId, now }));
			written = true;
		} catch (error) {
			return { ok: false, kind: 'target', error, written: false };
		}
	}
	if (mode === 'copy') return { ok: true, mode, written };

	try {
		await source.del(clip.id);
	} catch (error) {
		return { ok: false, kind: 'notRemoved', error, written };
	}
	return { ok: true, mode, written };
}
