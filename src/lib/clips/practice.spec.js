import { describe, expect, it } from 'vitest';
import { fittingClips, pickForFree, shortestKnownSec } from './practice.js';

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

describe('pickForFree', () => {
	it('picks the longest clip that fits the free seconds', () => {
		expect(pickForFree(clips, 300, () => false)?.id).toBe('b'); // 300 fits exactly
		expect(pickForFree(clips, 299, () => false)?.id).toBe('d'); // 300 no longer fits
		expect(pickForFree(clips, 3600, () => false)?.id).toBe('c');
	});

	it('prefers a clip not done today, repeating only when nothing new fits', () => {
		// b (300) is the longest, but done today → d, the next new one.
		expect(pickForFree(clips, 300, (id) => id === 'b')?.id).toBe('d');
		// Everything new is done today → the longest done one comes back.
		expect(pickForFree(clips, 300, () => true)?.id).toBe('b');
	});

	it('never picks a clip of unknown length (0), even when it would "fit"', () => {
		const withUnknown = [
			{ id: 'x', durationSec: 0 },
			{ id: 'y', durationSec: 120 }
		];
		expect(pickForFree(withUnknown, 300, () => false)?.id).toBe('y');
		expect(pickForFree([{ id: 'x', durationSec: 0 }], 300, () => false)).toBeNull();
	});

	it('is null when nothing fits', () => {
		expect(pickForFree(clips, 60, () => false)).toBeNull();
		expect(pickForFree([], 300, () => false)).toBeNull();
	});
});

describe('shortestKnownSec', () => {
	it('is the shortest known length', () => {
		expect(shortestKnownSec(clips)).toBe(120);
	});

	it('ignores clips of unknown length', () => {
		expect(shortestKnownSec([{ durationSec: 0 }, { durationSec: 450 }])).toBe(450);
	});

	it('is null when no clip has a known length', () => {
		expect(shortestKnownSec([{ durationSec: 0 }])).toBeNull();
		expect(shortestKnownSec([])).toBeNull();
	});
});
