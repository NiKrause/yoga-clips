/**
 * What the library can say about a playlist without opening it: how many
 * clips and minutes it had when this browser last had it open, and the clip
 * played last. Kept per browser; a playlist not opened here yet shows none.
 */

import { writable } from 'svelte/store';

const SUMMARY_KEY = 'yogaClips.playlistSummaries';
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
