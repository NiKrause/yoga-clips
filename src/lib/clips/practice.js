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
