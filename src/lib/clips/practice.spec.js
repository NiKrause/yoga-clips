import { describe, expect, it } from 'vitest';
import { fittingClips } from './practice.js';

const clips = [
	{ id: 'a', durationSec: 120 },
	{ id: 'b', durationSec: 300 },
	{ id: 'c', durationSec: 600 },
	{ id: 'd', durationSec: 290 }
];

describe('fittingClips', () => {
	it('offers the longest clip that fits first', () => {
		expect(fittingClips(clips, 5, () => false).map((c) => c.id)).toEqual(['b', 'd', 'a']);
		expect(fittingClips(clips, 20, () => false).map((c) => c.id)).toEqual(['c', 'b', 'd', 'a']);
	});

	it('puts clips done today after the others', () => {
		expect(fittingClips(clips, 5, (id) => id === 'b').map((c) => c.id)).toEqual(['d', 'a', 'b']);
	});

	it('has nothing when nothing fits', () => {
		expect(fittingClips(clips, 1, () => false)).toEqual([]);
	});
});
