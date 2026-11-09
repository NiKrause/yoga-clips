/**
 * "Done" marks: which clips this person did, and when.
 *
 * Local only, per identity, in localStorage — not in the playlist. The
 * playlist is shared with friends, and whether you did your shoulder opener
 * this morning is nobody else's data. The identity key (the DID, or the
 * anonymous id) scopes it so two passkeys in one browser do not count each
 * other's minutes.
 *
 * Pure functions over a `DoneLog`, plus thin load/save helpers, so the
 * statistics are unit-tested without a browser.
 */

/** @typedef {Record<string, string[]>} DoneLog clip id → ISO timestamps, oldest first */

const STORAGE_PREFIX = 'yogaClips.done.';

/** @param {string} identityId */
function storageKey(identityId) {
	return `${STORAGE_PREFIX}${identityId || 'anonymous'}`;
}

/**
 * @param {string} identityId
 * @returns {DoneLog}
 */
export function loadDoneLog(identityId) {
	try {
		const raw = localStorage.getItem(storageKey(identityId));
		const parsed = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * @param {string} identityId
 * @param {DoneLog} log
 */
export function saveDoneLog(identityId, log) {
	try {
		localStorage.setItem(storageKey(identityId), JSON.stringify(log));
	} catch {
		// No storage: the marks hold for this page view and no longer.
	}
}

/**
 * @param {DoneLog} log
 * @param {string} clipId
 * @param {Date} [at]
 * @returns {DoneLog} a new log
 */
export function markDone(log, clipId, at = new Date()) {
	return { ...log, [clipId]: [...(log[clipId] ?? []), at.toISOString()] };
}

/**
 * Take back the most recent mark of a clip — the one a slipped finger made.
 * @param {DoneLog} log
 * @param {string} clipId
 * @returns {DoneLog}
 */
export function unmarkLast(log, clipId) {
	const stamps = (log[clipId] ?? []).slice(0, -1);
	const next = { ...log };
	if (stamps.length) next[clipId] = stamps;
	else delete next[clipId];
	return next;
}

/** @param {Date} day */
export function startOfDay(day) {
	const d = new Date(day);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Monday 00:00 of the week `day` is in. Monday, because that is where a
 * German or English calendar starts, and the statistic says "this week".
 * @param {Date} day
 */
export function startOfWeek(day) {
	const d = startOfDay(day);
	const weekday = (d.getDay() + 6) % 7; // Monday = 0
	d.setDate(d.getDate() - weekday);
	return d;
}

/**
 * @param {DoneLog} log
 * @param {string} clipId
 * @param {Date} [today]
 */
export function doneToday(log, clipId, today = new Date()) {
	const from = startOfDay(today).getTime();
	return (log[clipId] ?? []).some((stamp) => new Date(stamp).getTime() >= from);
}

/** @param {DoneLog} log @param {string} clipId */
export function doneCount(log, clipId) {
	return (log[clipId] ?? []).length;
}

/**
 * Minutes practised in [from, now], from the marks and each clip's duration.
 *
 * A mark whose clip is no longer in the playlist counts nothing: its duration
 * is unknown, and guessing would make the number wrong in a way nobody could
 * see.
 *
 * @param {DoneLog} log
 * @param {{ id: string, durationSec: number }[]} clips
 * @param {Date} from
 * @param {Date} [now]
 */
export function minutesSince(log, clips, from, now = new Date()) {
	const durations = new Map(clips.map((clip) => [clip.id, clip.durationSec]));
	const fromMs = from.getTime();
	const nowMs = now.getTime();
	let seconds = 0;
	for (const [clipId, stamps] of Object.entries(log)) {
		const duration = durations.get(clipId);
		if (!duration) continue;
		for (const stamp of stamps) {
			const at = new Date(stamp).getTime();
			if (at >= fromMs && at <= nowMs) seconds += duration;
		}
	}
	return Math.round(seconds / 60);
}

/**
 * @param {DoneLog} log
 * @param {{ id: string, durationSec: number }[]} clips
 * @param {Date} [now]
 * @returns {{ today: number, week: number }} minutes
 */
export function practiceStats(log, clips, now = new Date()) {
	return {
		today: minutesSince(log, clips, startOfDay(now), now),
		week: minutesSince(log, clips, startOfWeek(now), now)
	};
}
