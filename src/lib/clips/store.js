import { writable, derived, get } from 'svelte/store';
import { Documents, OrbitDBAccessController } from '@orbitdb/core';
import { rememberList, listRegistryStore, openListRegistry } from '../list-registry.js';
import { relayHttpStatusStore } from '../relay-status.js';
import { canWrite, moveOrCopy } from './move-copy.js';
import { createClip, toExportDocument, validateClip } from './schema.js';
import { parseAppLink } from './share.js';
import { rememberSummary } from './summaries.js';
export { playlistDisplayName } from './names.js';

/**
 * The playlists: one OrbitDB *documents* database per playlist, one document
 * per clip, indexed by the clip's `id` (the schema's field, not OrbitDB's
 * default `_id`, so the stored record is exactly what the export writes).
 *
 * Every playlist is created with `OrbitDBAccessController({ write: [owner] })`
 * — the acl01 mechanism from simple-todo, unchanged: the owner grants and
 * revokes other DIDs at runtime through the permissions panel, and the
 * controller's own replicated store carries the change to peers without the
 * playlist's address changing. There is no public, world-writable list here.
 *
 * Which playlists an identity knows lives in the registry (`list-registry.js`,
 * also from acl01), so they come back after a reload and follow the passkey.
 */

/** @typedef {import('./schema.js').Clip} Clip */

/**
 * @typedef {{
 *   address: unknown
 *   name?: string
 *   access?: any
 *   peers?: Set<string>
 *   all: () => Promise<{ hash: string, key: string, value: Clip }[]>
 *   iterator?: (options?: { amount?: number }) => AsyncIterable<{ hash: string, key: string, value: Clip }>
 *   get: (key: string) => Promise<{ hash: string, key: string, value: Clip } | null | undefined>
 *   put: (doc: Clip) => Promise<unknown>
 *   del: (key: string) => Promise<unknown>
 *   close?: () => Promise<unknown>
 *   sync?: { start?: () => Promise<unknown>, stop?: () => Promise<unknown> }
 *   events: { on: (event: string, handler: (...args: any[]) => void) => void }
 * }} PlaylistDatabase
 */

/** @typedef {{ kind: 'none' | 'owner' | 'guest', name: string, address: string }} ActivePlaylist */

export const orbitdbStore = writable(/** @type {any} */ (null));
export const playlistDBStore = writable(/** @type {PlaylistDatabase | null} */ (null));
export const playlistAddressStore = writable('');
export const activePlaylistStore = writable(
	/** @type {ActivePlaylist} */ ({ kind: 'none', name: '', address: '' })
);
export const clipsStore = writable(/** @type {Clip[]} */ ([]));
export const clipsCountStore = derived(clipsStore, ($clips) => $clips.length);
/**
 * The address of the playlist whose clips clipsStore holds: set when they are
 * loaded, cleared when another playlist opens. Until the new one's clips are
 * read, clipsStore still holds the old ones, and a summary must not take them
 * for the new playlist's.
 */
const clipsAddressStore = writable('');
derived([clipsStore, clipsAddressStore], (pair) => pair).subscribe(([clips, address]) => {
	if (address && address === get(playlistAddressStore)) rememberSummary(address, clips);
});

/**
 * The clip a link asked for (`?clip=<id>`), until the player has shown it.
 * Set once at startup from the URL; the page clears it.
 */
export const requestedClipStore = writable(/** @type {string | null} */ (null));

const LAST_PLAYLIST_KEY = 'yogaClips.lastPlaylist';
const INITIAL_CLIP_LIMIT = 500;

const observedDatabases = new WeakSet();
/** @type {Promise<void> | null} */
let pendingLoad = null;
let reloadRequested = false;
/** @type {any[]} */
let entriesReceivedDuringLoad = [];

/** The database options every open uses, so no playlist is ever opened with
 * OrbitDB's `_id` index by mistake. */
function playlistOptions() {
	return { type: 'documents', Database: Documents({ indexBy: 'id' }), sync: true };
}

/** @param {PlaylistDatabase | null | undefined} db */
function addressOf(db) {
	const address = db?.address;
	if (typeof address === 'string') return address;
	return address && typeof address.toString === 'function' ? address.toString() : '';
}

/**
 * @param {PlaylistDatabase | null} db
 * @param {{ kind: ActivePlaylist['kind'], name?: string }} meta
 */
function setActivePlaylist(db, meta) {
	const address = addressOf(db);
	clipsAddressStore.set('');
	playlistDBStore.set(db);
	playlistAddressStore.set(address);
	activePlaylistStore.set({ kind: meta.kind, name: meta.name ?? '', address });
	try {
		if (address) localStorage.setItem(LAST_PLAYLIST_KEY, address);
		else localStorage.removeItem(LAST_PLAYLIST_KEY);
	} catch {
		// No storage: the next start opens nothing, and the switcher is there.
	}
}

/**
 * Called once OrbitDB exists. Opens the registry, then the playlist the page
 * was opened with (`?db=`), else the one used last, else nothing — a new
 * identity starts with the "new playlist" button rather than with a database
 * it did not ask for.
 *
 * @param {any} orbitdb
 * @param {{ search?: string }} [options] `location.search`, for tests
 */
export async function initializeDatabase(orbitdb, { search } = {}) {
	orbitdbStore.set(orbitdb);
	const link = parseAppLink(search ?? (typeof location === 'undefined' ? '' : location.search));
	requestedClipStore.set(link.clip);

	try {
		await openListRegistry(orbitdb);
	} catch (error) {
		console.warn('Playlist registry unavailable:', error);
	}

	const address = link.db || lastPlaylistAddress();
	if (!address) {
		setActivePlaylist(null, { kind: 'none' });
		return;
	}
	try {
		await openPlaylist(address);
	} catch (error) {
		console.warn(`Could not open the last playlist ${address}:`, error);
		setActivePlaylist(null, { kind: 'none' });
	}
}

function lastPlaylistAddress() {
	try {
		const address = localStorage.getItem(LAST_PLAYLIST_KEY) ?? '';
		return address.startsWith('/orbitdb/') ? address : '';
	} catch {
		return '';
	}
}

/**
 * Open a playlist by address and make it the active one.
 *
 * @param {string} address
 * @returns {Promise<{ address: string, count: number }>}
 */
export async function openPlaylist(address) {
	const orbitdb = get(orbitdbStore);
	const normalized = address.trim();
	if (!orbitdb) throw new Error('OrbitDB is not initialized yet.');
	if (!normalized.startsWith('/orbitdb/')) {
		throw new Error('A playlist address starts with "/orbitdb/".');
	}

	const db = /** @type {PlaylistDatabase} */ (await orbitdb.open(normalized, playlistOptions()));
	const opened = addressOf(db) || normalized;
	const known = get(listRegistryStore).find((entry) => entry.address === opened);
	setActivePlaylist(db, {
		kind: known?.role === 'owner' ? 'owner' : 'guest',
		name: known?.name || db.name || ''
	});
	setupListeners(db);
	await loadClips();

	try {
		await rememberList(orbitdb, { address: opened, name: db.name ?? '', role: 'guest' });
	} catch (error) {
		console.warn('Could not record the opened playlist in the registry:', error);
	}
	return { address: opened, count: get(clipsCountStore) };
}

/**
 * Create a playlist only this identity may write to, and switch to it.
 *
 * @param {string} [name]
 * @returns {Promise<{ address: string, name: string }>}
 */
export async function createPlaylist(name = '') {
	const orbitdb = get(orbitdbStore);
	if (!orbitdb) throw new Error('OrbitDB is not initialized yet.');

	const playlistName = name.trim() || 'yoga-clips';
	const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const db = /** @type {PlaylistDatabase} */ (
		await orbitdb.open(`${playlistName}-${suffix}`, {
			...playlistOptions(),
			create: true,
			AccessController: OrbitDBAccessController({ write: [orbitdb.identity.id] })
		})
	);
	setActivePlaylist(db, { kind: 'owner', name: playlistName });
	setupListeners(db);
	await loadClips();
	const address = addressOf(db);
	try {
		await rememberList(orbitdb, { address, name: playlistName, role: 'owner' });
	} catch (error) {
		console.warn('Could not record the new playlist in the registry:', error);
	}
	return { address, name: playlistName };
}

/** Re-read the active playlist into the store; coalesces concurrent calls. */
export async function loadClips() {
	reloadRequested = true;
	if (pendingLoad) return pendingLoad;
	pendingLoad = (async () => {
		do {
			reloadRequested = false;
			await loadSnapshot();
		} while (reloadRequested);
	})().finally(() => {
		pendingLoad = null;
	});
	return pendingLoad;
}

async function loadSnapshot() {
	const db = get(playlistDBStore);
	if (!db) {
		clipsStore.set([]);
		return;
	}
	try {
		const records = await readRecent(db);
		if (get(playlistDBStore) !== db) return;
		const clips = records
			.map((record) => validateClip(record.value))
			.flatMap((result) => (result.ok ? [result.clip] : []));
		clipsStore.set(sortClips(clips));
		clipsAddressStore.set(addressOf(db));
		const pending = entriesReceivedDuringLoad;
		entriesReceivedDuringLoad = [];
		for (const entry of pending) applyEntry(entry, false);
	} catch (error) {
		console.error('Error loading clips:', error);
	}
}

/** @param {PlaylistDatabase} db */
async function readRecent(db) {
	if (!db.iterator) return db.all();
	const records = [];
	for await (const record of db.iterator({ amount: INITIAL_CLIP_LIMIT })) records.push(record);
	return records;
}

/** Newest first. @param {Clip[]} clips */
function sortClips(clips) {
	return clips.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/**
 * @param {any} entry
 * @param {boolean} [trackDuringLoad=true]
 */
function applyEntry(entry, trackDuringLoad = true) {
	const { op, key, value } = entry?.payload ?? {};
	if (!key || (op !== 'PUT' && op !== 'DEL')) return false;
	if (trackDuringLoad && pendingLoad) entriesReceivedDuringLoad.push(entry);

	clipsStore.update((clips) => {
		const rest = clips.filter((clip) => clip.id !== key);
		if (op === 'DEL') return rest;
		const result = validateClip(value);
		// A document that is not a clip — written by another client of this
		// playlist — is simply not shown. It stays in the log; it is not ours to
		// delete.
		return result.ok ? sortClips([...rest, result.clip]) : rest;
	});
	return true;
}

/** @param {PlaylistDatabase} db */
function setupListeners(db) {
	if (observedDatabases.has(db)) return;
	observedDatabases.add(db);
	// A playlist stays open after another one became the active one, and a
	// clip copied or moved into it is an update there. Only the active
	// playlist's events may reach the list on screen.
	db.events.on('join', () => {
		if (get(playlistDBStore) === db) void loadClips();
	});
	db.events.on('update', (...args) => {
		if (get(playlistDBStore) !== db) return;
		const entry = args.find((value) => value?.payload);
		if (!applyEntry(entry)) void loadClips();
	});
}

/**
 * After a write, make sure the relay has it and the heads exchange ran.
 *
 * Carried over from simple-todo's relay replication proof, minus the proof:
 * a POST to the relay's `/pinning/sync` makes it open the database and sync,
 * and restarting this side's sync re-triggers OrbitDB's heads exchange while
 * the relay has the database open. Without it, an entry written on one
 * browser was seen to reach the relay and still not the second browser —
 * gossipsub alone drops the first head now and then.
 *
 * Best effort and fire-and-forget: a relay without the HTTP origin, or none
 * at all, leaves the write exactly as valid.
 *
 * @param {PlaylistDatabase} db
 * @param {{ evenIfNotActive?: boolean }} [options] for the target of a move
 *   or copy, which is open but not the playlist on screen
 */
function nudgeReplication(db, { evenIfNotActive = false } = {}) {
	const { origin } = get(relayHttpStatusStore);
	const dbAddress = addressOf(db);
	void (async () => {
		try {
			if (origin && dbAddress) {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 30_000);
				fetch(`${origin}/pinning/sync`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ dbAddress }),
					signal: controller.signal
				})
					.catch(() => undefined)
					.finally(() => clearTimeout(timeout));
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
			const current = evenIfNotActive || get(playlistDBStore) === db;
			if (current && db.sync?.stop && db.sync.start) {
				await db.sync.stop();
				await db.sync.start();
			}
		} catch (error) {
			console.warn('Replication nudge failed:', error);
		}
	})();
}

/**
 * Why a write was refused, in words the page can translate.
 * @param {unknown} error
 * @returns {'denied' | 'failed'}
 */
export function writeErrorKind(error) {
	const message = error instanceof Error ? error.message : String(error);
	return /not allowed to write|does not have write access|access denied/i.test(message)
		? 'denied'
		: 'failed';
}

/**
 * Add a clip to the active playlist.
 *
 * `addedBy` is this identity: the DID of the passkey, or the anonymous id.
 * OrbitDB signs the entry with the same identity, so a reader who wants proof
 * has `entry.identity`; the field is there so the export carries the author.
 *
 * @param {{ url: string, title: string, teacher: string, durationSec: number, tags: string[] | string }} input
 * @returns {Promise<{ ok: true, clip: Clip } | { ok: false, kind: 'invalid' | 'denied' | 'failed' | 'noPlaylist', message: string }>}
 */
export async function addClip(input) {
	const db = get(playlistDBStore);
	const orbitdb = get(orbitdbStore);
	if (!db || !orbitdb) {
		return { ok: false, kind: 'noPlaylist', message: 'No playlist is open.' };
	}

	/** @type {Clip} */
	let clip;
	try {
		clip = createClip({ ...input, addedBy: String(orbitdb.identity?.id ?? '') });
	} catch (error) {
		return { ok: false, kind: 'invalid', message: error instanceof Error ? error.message : '' };
	}

	try {
		await db.put(clip);
		nudgeReplication(db);
		return { ok: true, clip };
	} catch (error) {
		// A denied write throws inside OrbitDB's canAppend gate before anything
		// is appended locally, so nothing ever looks saved.
		console.error('Error adding clip:', error);
		return {
			ok: false,
			kind: writeErrorKind(error),
			message: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * @param {string} id
 * @returns {Promise<{ ok: true } | { ok: false, kind: 'denied' | 'failed', message: string }>}
 */
export async function removeClip(id) {
	const db = get(playlistDBStore);
	if (!db) return { ok: false, kind: 'failed', message: 'No playlist is open.' };
	try {
		await db.del(id);
		nudgeReplication(db);
		return { ok: true };
	} catch (error) {
		console.error('Error removing clip:', error);
		return {
			ok: false,
			kind: writeErrorKind(error),
			message: error instanceof Error ? error.message : String(error)
		};
	}
}

/** How long the question "may I write here" waits for a playlist to open. */
const WRITE_CHECK_PATIENCE_MS = 8000;

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withPatience(promise, ms) {
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let timer;
	const late = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`No answer within ${ms} ms.`)), ms);
	});
	return /** @type {Promise<T>} */ (Promise.race([promise, late])).finally(() =>
		clearTimeout(timer)
	);
}

/**
 * Open a playlist without making it the one on screen: the target of a move
 * or copy. OrbitDB hands back the open database where it has one.
 *
 * @param {string} address
 * @returns {Promise<PlaylistDatabase>}
 */
async function openBeside(address) {
	const orbitdb = get(orbitdbStore);
	if (!orbitdb) throw new Error('OrbitDB is not initialized yet.');
	if (!address.startsWith('/orbitdb/')) {
		throw new Error('A playlist address starts with "/orbitdb/".');
	}
	return /** @type {PlaylistDatabase} */ (await orbitdb.open(address, playlistOptions()));
}

/**
 * May this identity write to that playlist? Asked of the playlist's access
 * controller, not of the registry's "owner": the answer is the same question
 * OrbitDB asks at the write, so a playlist somebody else owns and has let
 * this identity into is a yes, and one's own would be a no once its owner
 * took the right away.
 *
 * A playlist that does not open in time is a no for now: it cannot be
 * written to either.
 *
 * @param {string} address
 * @param {{ patienceMs?: number }} [options]
 */
export async function canWriteTo(address, { patienceMs = WRITE_CHECK_PATIENCE_MS } = {}) {
	const identityId = String(get(orbitdbStore)?.identity?.id ?? '');
	if (!identityId) return false;
	try {
		const db = await withPatience(openBeside(address), patienceMs);
		const access = db.access;
		const capabilities =
			typeof access?.capabilities === 'function'
				? await withPatience(Promise.resolve(access.capabilities()), patienceMs)
				: { write: access?.write };
		return canWrite(capabilities, identityId);
	} catch (error) {
		console.warn('Could not ask whether a playlist is writable:', error);
		return false;
	}
}

/**
 * Copy a clip of the active playlist into another one, or move it there.
 * What travels and in which order things are written: `move-copy.js`.
 *
 * @param {Clip} clip
 * @param {string} targetAddress
 * @param {'copy' | 'move'} mode
 * @returns {Promise<
 *   | { ok: true, mode: 'copy' | 'move' }
 *   | { ok: false, kind: 'duplicate' }
 *   | { ok: false, kind: 'denied' | 'failed', message: string }
 *   | { ok: false, kind: 'notRemoved', reason: 'denied' | 'failed', message: string }
 * >}
 */
export async function moveOrCopyClip(clip, targetAddress, mode) {
	const source = get(playlistDBStore);
	const identityId = String(get(orbitdbStore)?.identity?.id ?? '');
	if (!source || !identityId) return { ok: false, kind: 'failed', message: 'No playlist is open.' };
	if (targetAddress === addressOf(source)) {
		return { ok: false, kind: 'failed', message: 'The clip is in that playlist.' };
	}

	/** @type {PlaylistDatabase} */
	let target;
	try {
		target = await openBeside(targetAddress);
	} catch (error) {
		console.error('Error opening the target playlist:', error);
		return { ok: false, kind: 'failed', message: messageOf(error) };
	}

	const result = await moveOrCopy({ mode, clip, source, target, identityId });
	if (result.written) {
		nudgeReplication(target, { evenIfNotActive: true });
		void rememberTargetSummary(target);
	}
	if (result.ok) {
		if (mode === 'move') nudgeReplication(source);
		return { ok: true, mode };
	}
	if (result.kind === 'duplicate') return { ok: false, kind: 'duplicate' };
	console.error(`Error on ${mode} of a clip:`, result.error);
	if (result.kind === 'notRemoved') {
		return {
			ok: false,
			kind: 'notRemoved',
			reason: writeErrorKind(result.error),
			message: messageOf(result.error)
		};
	}
	return { ok: false, kind: writeErrorKind(result.error), message: messageOf(result.error) };
}

/** @param {unknown} error */
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

/**
 * The library's tile of a playlist says how many clips it has, from what this
 * browser last saw. After a write into a playlist that is not on screen, that
 * is read here.
 *
 * @param {PlaylistDatabase} target
 */
async function rememberTargetSummary(target) {
	try {
		const records = await readRecent(target);
		const clips = records
			.map((record) => validateClip(record.value))
			.flatMap((result) => (result.ok ? [result.clip] : []));
		rememberSummary(addressOf(target), sortClips(clips));
	} catch (error) {
		console.warn('Could not read the target playlist after the write:', error);
	}
}

/**
 * Write imported clips into the active playlist. A clip whose id is already
 * there is skipped — the file came from a playlist, and importing it twice
 * must not double anything.
 *
 * @param {Clip[]} clips
 * @returns {Promise<{ added: number, skipped: number, kind?: 'denied' | 'failed', message?: string }>}
 */
export async function importClips(clips) {
	const db = get(playlistDBStore);
	if (!db)
		return { added: 0, skipped: clips.length, kind: 'failed', message: 'No playlist is open.' };
	const existing = new Set(get(clipsStore).map((clip) => clip.id));
	let added = 0;
	let skipped = 0;
	for (const clip of clips) {
		if (existing.has(clip.id)) {
			skipped++;
			continue;
		}
		try {
			await db.put(clip);
			existing.add(clip.id);
			added++;
		} catch (error) {
			return {
				added,
				skipped,
				kind: writeErrorKind(error),
				message: error instanceof Error ? error.message : String(error)
			};
		}
	}
	if (added) nudgeReplication(db);
	return { added, skipped };
}

/** The active playlist as the file the mod reads. */
export function exportClips() {
	return toExportDocument(get(clipsStore));
}

/** Teachers seen in the active playlist, for the autocomplete. */
export const teachersStore = derived(clipsStore, ($clips) =>
	Array.from(new Set($clips.map((clip) => clip.teacher).filter(Boolean))).sort((a, b) =>
		a.localeCompare(b)
	)
);

/** Tags seen in the active playlist, most used first. */
export const tagsStore = derived(clipsStore, ($clips) => {
	/** @type {Map<string, number>} */
	const counts = new Map();
	for (const clip of $clips)
		for (const tag of clip.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([tag]) => tag);
});

/** Forget the open playlist and its clips; used when the node goes away. */
export function resetClipStores() {
	playlistDBStore.set(null);
	playlistAddressStore.set('');
	activePlaylistStore.set({ kind: 'none', name: '', address: '' });
	clipsStore.set([]);
}

// Read-only hooks for the e2e suite. Only in test builds: a production page
// has no reason to expose its stores on `window`.
if (typeof window !== 'undefined' && import.meta.env.VITE_E2E === 'true') {
	/** @type {Window & typeof globalThis & { __yogaClipsStore?: Record<string, unknown> }} */ (
		window
	).__yogaClipsStore = {
		getPlaylistAddress: () => get(playlistAddressStore),
		getClips: () => get(clipsStore),
		getClipCount: () => get(clipsCountStore),
		exportClips
	};
}
