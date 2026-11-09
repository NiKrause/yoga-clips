import { describe, expect, it } from 'vitest';
import { doneToday, markDone, practiceStats, startOfWeek, unmarkLast } from './done.js';

const clips = [
	{ id: 'a', durationSec: 300 },
	{ id: 'b', durationSec: 600 }
];

describe('the done log', () => {
	it('counts minutes today and this week from the marks and the durations', () => {
		// A Thursday. Monday of that week is the 2nd.
		const now = new Date('2026-11-05T18:00:00');
		/** @type {import('./done.js').DoneLog} */
		let log = {};
		log = markDone(log, 'a', new Date('2026-11-05T07:00:00')); // today
		log = markDone(log, 'b', new Date('2026-11-03T07:00:00')); // Tuesday
		log = markDone(log, 'a', new Date('2026-11-01T07:00:00')); // Sunday before: last week
		log = markDone(log, 'gone', new Date('2026-11-05T08:00:00')); // clip no longer here
		expect(practiceStats(log, clips, now)).toEqual({ today: 5, week: 15 });
		expect(doneToday(log, 'a', now)).toBe(true);
		expect(doneToday(log, 'b', now)).toBe(false);
	});

	it('starts the week on Monday', () => {
		expect(startOfWeek(new Date('2026-11-08T12:00:00')).getDay()).toBe(1); // a Sunday → Monday 2nd
		expect(startOfWeek(new Date('2026-11-08T12:00:00')).getDate()).toBe(2);
		expect(startOfWeek(new Date('2026-11-02T00:30:00')).getDate()).toBe(2);
	});

	it('takes back the last mark only', () => {
		let log = markDone({}, 'a', new Date('2026-11-05T07:00:00'));
		log = markDone(log, 'a', new Date('2026-11-05T19:00:00'));
		log = unmarkLast(log, 'a');
		expect(log.a).toEqual([new Date('2026-11-05T07:00:00').toISOString()]);
		expect(unmarkLast(log, 'a')).toEqual({});
	});
});
