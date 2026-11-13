import { describe, expect, it } from 'vitest';
import {
	CLIP_FIELDS,
	createClip,
	formatDuration,
	parseClipUrl,
	parseDurationInput,
	parseImport,
	parseTagInput,
	toExportDocument,
	validateClip
} from './schema.js';

const valid = {
	id: '3b4a0f6e-1111-4c2d-9a8b-000000000001',
	url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	source: 'youtube',
	title: 'Shoulder Opener',
	teacher: 'Example Teacher',
	durationSec: 300,
	tags: ['schultern', 'sitzen'],
	addedAt: '2026-11-09T10:00:00.000Z',
	addedBy: 'did:key:z6MkExample'
};

describe('parseClipUrl', () => {
	it('recognises the YouTube link shapes and derives embed and thumbnail', () => {
		for (const link of [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s',
			'https://youtu.be/dQw4w9WgXcQ',
			'https://youtube.com/shorts/dQw4w9WgXcQ',
			'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
			'www.youtube.com/watch?v=dQw4w9WgXcQ'
		]) {
			const parsed = parseClipUrl(link);
			expect(parsed?.source, link).toBe('youtube');
			expect(parsed?.videoId, link).toBe('dQw4w9WgXcQ');
			expect(parsed?.embedUrl, link).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
			expect(parsed?.thumbnailUrl, link).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
		}
	});

	it('recognises Vimeo and Instagram, and leaves Instagram without an embed', () => {
		const vimeo = parseClipUrl('https://vimeo.com/76979871');
		expect(vimeo?.source).toBe('vimeo');
		expect(vimeo?.embedUrl).toBe('https://player.vimeo.com/video/76979871?autoplay=1&dnt=1');

		const reel = parseClipUrl('https://www.instagram.com/reel/C0dEexample/?igsh=abc');
		expect(reel?.source).toBe('instagram');
		expect(reel?.url).toBe('https://www.instagram.com/reel/C0dEexample/');
	});

	it('builds Instagram’s embed address from post and reel links', () => {
		const embed = (/** @type {string} */ link) => parseClipUrl(link)?.embedUrl;
		expect(embed('https://www.instagram.com/reel/C0dEexample/?igsh=abc')).toBe(
			'https://www.instagram.com/reel/C0dEexample/embed/'
		);
		expect(embed('https://instagram.com/reels/C0dEexample')).toBe(
			'https://www.instagram.com/reel/C0dEexample/embed/'
		);
		expect(embed('https://www.instagram.com/p/C0dE_ex-mple/')).toBe(
			'https://www.instagram.com/p/C0dE_ex-mple/embed/'
		);
		expect(embed('https://instagr.am/p/C0dEexample/?utm_source=ig_web')).toBe(
			'https://www.instagram.com/p/C0dEexample/embed/'
		);
		expect(embed('https://www.instagram.com/tv/C0dEexample/')).toBe(
			'https://www.instagram.com/p/C0dEexample/embed/'
		);
	});

	it('has no embed address for an Instagram link that is not a post', () => {
		// A profile, a story, a path that only looks like a post: nothing of
		// the link reaches the frame's address.
		for (const link of [
			'https://www.instagram.com/example.teacher/',
			'https://www.instagram.com/stories/example.teacher/123/',
			'https://www.instagram.com/p/',
			'https://www.instagram.com/p/..%2F..%2Faccounts/',
			'https://www.instagram.com/reel/a"b/'
		]) {
			const parsed = parseClipUrl(link);
			expect(parsed?.source, link).toBe('instagram');
			expect(parsed?.embedUrl, link).toBeNull();
		}
	});

	it('calls everything else "other" and refuses what is not a web link', () => {
		expect(parseClipUrl('https://example.com/video/1')?.source).toBe('other');
		expect(parseClipUrl('javascript:alert(1)')).toBeNull();
		expect(parseClipUrl('not a link')).toBeNull();
		expect(parseClipUrl('')).toBeNull();
	});
});

describe('validateClip', () => {
	it('accepts the schema example', () => {
		const result = validateClip(valid);
		expect(result.ok).toBe(true);
		expect(result.clip).toEqual(valid);
	});

	it('names every field that is wrong', () => {
		const result = validateClip({ ...valid, durationSec: '300', source: 'tiktok', tags: 'x' });
		expect(result.ok).toBe(false);
		expect(result.errors.join('\n')).toMatch(/durationSec/);
		expect(result.errors.join('\n')).toMatch(/source/);
		expect(result.errors.join('\n')).toMatch(/tags/);
	});

	it('lower-cases and deduplicates tags', () => {
		const result = validateClip({ ...valid, tags: ['Schultern', ' schultern', 'Sitzen'] });
		expect(result.clip?.tags).toEqual(['schultern', 'sitzen']);
	});
});

describe('createClip', () => {
	it('fills source, id and addedAt from the link and the clock', () => {
		const clip = createClip({
			url: 'https://youtu.be/dQw4w9WgXcQ',
			title: 'Hip Release',
			teacher: 'Example Teacher',
			durationSec: 420,
			tags: 'hüfte, liegen',
			addedBy: 'did:key:z6MkExample',
			now: new Date('2026-11-09T10:00:00Z')
		});
		expect(clip.source).toBe('youtube');
		expect(clip.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
		expect(clip.tags).toEqual(['hüfte', 'liegen']);
		expect(clip.addedAt).toBe('2026-11-09T10:00:00.000Z');
		expect(clip.id).toMatch(/^[0-9a-f-]{8,}$/);
		expect(Object.keys(clip)).toEqual([...CLIP_FIELDS]);
	});

	it('refuses a duration outside the range', () => {
		expect(() => createClip({ ...valid, durationSec: 5 })).toThrow(/durationSec/);
	});
});

describe('export and import', () => {
	it('writes only the schema fields, in order, sorted by addedAt', () => {
		const later = { ...valid, id: 'later-0000', addedAt: '2026-11-10T10:00:00.000Z', extra: 1 };
		const doc = toExportDocument([/** @type {any} */ (later), valid]);
		expect(doc.clips.map((c) => c.id)).toEqual([valid.id, 'later-0000']);
		for (const clip of doc.clips) expect(Object.keys(clip)).toEqual([...CLIP_FIELDS]);
	});

	it('round-trips, drops unknown fields and reports rejected entries by position', () => {
		const file = JSON.stringify({
			clips: [
				{ ...valid, somethingElse: true },
				{ ...valid, id: '' }
			]
		});
		const { clips, rejected } = parseImport(file);
		expect(clips).toEqual([valid]);
		expect(rejected).toEqual([{ index: 1, errors: ['id: missing'] }]);
	});

	it('refuses what is not a clips file', () => {
		expect(() => parseImport('{')).toThrow(/JSON/);
		expect(() => parseImport('{"todos":[]}')).toThrow(/clips/);
	});
});

describe('durations and tags typed by a person', () => {
	it('reads minutes, m:ss and unit forms', () => {
		expect(parseDurationInput('5')).toBe(300);
		expect(parseDurationInput('5:30')).toBe(330);
		expect(parseDurationInput('7m 15s')).toBe(435);
		expect(parseDurationInput('2,5')).toBe(150);
		expect(parseDurationInput('abc')).toBeNull();
	});

	it('formats seconds as m:ss', () => {
		expect(formatDuration(300)).toBe('5:00');
		expect(formatDuration(65)).toBe('1:05');
	});

	it('splits tags on commas and spaces', () => {
		expect(parseTagInput('Schultern, sitzen  nacken')).toEqual(['schultern', 'sitzen', 'nacken']);
	});
});
