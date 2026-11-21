/**
 * "How much time do you have?" (Practise, NiKrause/yoga-clips#1, step 4):
 * the clips that fit, in the yoga-break mod's order — the longest that fits
 * first, and clips done today after the others, so a repeat comes only when
 * nothing new fits.
 *
 * @template {{ id: string, durationSec: number }} C
 * @param {C[]} clips
 * @param {number} minutes the time there is
 * @param {(id: string) => boolean} doneToday
 * @returns {C[]}
 */
export function fittingClips(clips, minutes, doneToday) {
	const free = minutes * 60;
	return clips
		.filter((clip) => clip.durationSec <= free)
		.sort((a, b) => {
			const seenA = doneToday(a.id) ? 1 : 0;
			const seenB = doneToday(b.id) ? 1 : 0;
			return seenA - seenB || b.durationSec - a.durationSec;
		});
}

/**
 * The one clip a free-time link plays (`?db=…&free=<seconds>`): the longest
 * that fits the free time, in the same order as `fittingClips` — a clip done
 * today ranks after the others, so a repeat comes only when nothing new fits.
 * A clip of unknown length (`durationSec` 0) is never picked. Null when none
 * fits.
 *
 * Pure: no store, no clock, no write to the playlist.
 *
 * @template {{ id: string, durationSec: number }} C
 * @param {C[]} clips
 * @param {number} freeSec the free time, in seconds
 * @param {(id: string) => boolean} doneToday
 * @returns {C | null}
 */
export function pickForFree(clips, freeSec, doneToday) {
	const fitting = clips
		.filter((clip) => clip.durationSec > 0 && clip.durationSec <= freeSec)
		.sort((a, b) => {
			const seenA = doneToday(a.id) ? 1 : 0;
			const seenB = doneToday(b.id) ? 1 : 0;
			return seenA - seenB || b.durationSec - a.durationSec;
		});
	return fitting[0] ?? null;
}

/**
 * The shortest known length among the clips, in seconds — for the line that
 * says nothing fits. Clips of unknown length (0) do not count; null when no
 * clip has a known length.
 *
 * @param {{ durationSec: number }[]} clips
 * @returns {number | null}
 */
export function shortestKnownSec(clips) {
	let shortest = null;
	for (const clip of clips) {
		if (clip.durationSec > 0 && (shortest === null || clip.durationSec < shortest)) {
			shortest = clip.durationSec;
		}
	}
	return shortest;
}
