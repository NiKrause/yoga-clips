import { afterEach, describe, expect, it } from 'vitest';
import { lastClip, rememberLastClip, rememberSummary, summaryOf } from './summaries.js';

afterEach(() => localStorage.clear());

describe('summaries', () => {
	it('remembers a playlist’s clips and minutes by its address', () => {
		rememberSummary('/orbitdb/a', [{ durationSec: 300 }, { durationSec: 180 }]);
		expect(summaryOf('/orbitdb/a')).toMatchObject({ clips: 2, seconds: 480 });
		expect(summaryOf('/orbitdb/b')).toBeNull();
	});

	it('remembers the clip played last, and survives a broken entry', () => {
		expect(lastClip()).toBeNull();
		rememberLastClip({ playlist: '/orbitdb/a', clip: 'clip_1' });
		expect(lastClip()).toEqual({ playlist: '/orbitdb/a', clip: 'clip_1' });
		localStorage.setItem('yogaClips.lastClip', '{broken');
		expect(lastClip()).toBeNull();
	});
});
