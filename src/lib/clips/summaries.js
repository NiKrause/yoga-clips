/**
 * What the library can say about a playlist without opening it: how many
 * clips and minutes it had when this browser last had it open, and the clip
 * played last. Kept per browser; a playlist not opened here yet shows none.
 */

import { writable } from 'svelte/store';

const SUMMARY_KEY = 'yogaClips.playlistSummaries';
const CLIPS_KEY = 'yogaClips.playlistClips';
/** Enough for Practise to suggest from; a playlist is cut there. */
const CLIPS_PER_PLAYLIST = 500;
const LAST_CLIP_KEY = 'yogaClips.lastClip';

/** @typedef {{ clips: number, seconds: number, at: number }} Summary */

/** @returns {Record<string, Summary>} */
function readAll() {
	try {
		const value = JSON.parse(localStorage.getItem(SUMMARY_KEY) ?? '{}');
		return value && typeof value === 'object' ? value : {};
	} catch {
		return {};
	}
}

/** Every summary this browser has, for the tiles to follow. */
export const summariesStore = writable(
	/** @type {Record<string, Summary>} */ (typeof localStorage === 'undefined' ? {} : readAll())
);

/**
 * @param {string} address
 * @param {{ durationSec: number }[]} clips the clips of that playlist, and only of it
 */
export function rememberSummary(address, clips) {
	if (!address) return;
	const all = readAll();
	const seconds = clips.reduce((sum, clip) => sum + (Number(clip.durationSec) || 0), 0);
	if (all[address]?.clips === clips.length && all[address]?.seconds === seconds) return;
	all[address] = { clips: clips.length, seconds, at: Date.now() };
	summariesStore.set(all);
	try {
		localStorage.setItem(SUMMARY_KEY, JSON.stringify(all));
	} catch {
		// storage full or blocked: the tiles show this session's numbers only
	}
	rememberClips(address, /** @type {any[]} */ (clips));
}

/**
 * The clips of every playlist as this browser last saw them, so Practise can
 * suggest from all of a person's playlists without opening each database.
 * Only what a suggestion shows and plays is kept.
 *
 * @typedef {{ id: string, title: string, teacher: string, durationSec: number,
 *   url: string, source: string, addedAt?: string, addedBy?: string, tags?: string[] }} KnownClip
 */
export const knownClipsStore = writable(
	/** @type {Record<string, KnownClip[]>} */ (
		typeof localStorage === 'undefined' ? {} : readJson(CLIPS_KEY, {})
	)
);

/**
 * @param {string} key
 * @param {any} fallback
 */
function readJson(key, fallback) {
	try {
		const value = JSON.parse(localStorage.getItem(key) ?? 'null');
		return value && typeof value === 'object' ? value : fallback;
	} catch {
		return fallback;
	}
}

/**
 * @param {string} address
 * @param {any[]} clips
 */
function rememberClips(address, clips) {
	const all = readJson(CLIPS_KEY, {});
	all[address] = clips.slice(0, CLIPS_PER_PLAYLIST).map((clip) => ({
		id: clip.id,
		title: clip.title,
		teacher: clip.teacher,
		durationSec: clip.durationSec,
		url: clip.url,
		source: clip.source,
		addedAt: clip.addedAt,
		addedBy: clip.addedBy,
		tags: clip.tags
	}));
	knownClipsStore.set(all);
	try {
		localStorage.setItem(CLIPS_KEY, JSON.stringify(all));
	} catch {
		// too much for this browser's storage: Practise falls back to the open playlist
	}
}

/**
 * @param {string} address
 * @returns {Summary | null}
 */
export function summaryOf(address) {
	return readAll()[address] ?? null;
}

/** @param {{ playlist: string, clip: string }} last */
export function rememberLastClip(last) {
	try {
		localStorage.setItem(LAST_CLIP_KEY, JSON.stringify(last));
	} catch {
		// nothing to continue then
	}
}

/** @returns {{ playlist: string, clip: string } | null} */
export function lastClip() {
	try {
		const value = JSON.parse(localStorage.getItem(LAST_CLIP_KEY) ?? 'null');
		return value && typeof value.playlist === 'string' && typeof value.clip === 'string'
			? value
			: null;
	} catch {
		return null;
	}
}
