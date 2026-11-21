import { describe, expect, it } from 'vitest';
import { cardBox, cinemaBox, clipShape, posterRatio, SHAPE_RATIO } from './aspect.js';
import { parseClipUrl } from './schema.js';

describe('clipShape', () => {
	it('gives an Instagram reel the upright 9:16 shape', () => {
		expect(clipShape(parseClipUrl('https://www.instagram.com/reel/C0dEexample/'))).toBe('reel');
		// The app shares a reel under /reels/ but its embed is /reel/.
		expect(clipShape(parseClipUrl('https://www.instagram.com/reels/C0dEexample/'))).toBe('reel');
	});

	it('gives an Instagram post the portrait shape', () => {
		expect(clipShape(parseClipUrl('https://www.instagram.com/p/C0dEexample/'))).toBe('post');
		expect(clipShape(parseClipUrl('https://www.instagram.com/tv/C0dEexample/'))).toBe('post');
	});

	it('leaves YouTube and Vimeo wide — their players letterbox a vertical video themselves', () => {
		expect(clipShape(parseClipUrl('https://youtu.be/aaaaaaaaaaa'))).toBe('wide');
		// A YouTube Short is canonicalised to a normal watch url, so it is wide
		// too; YouTube's own player shows a vertical short whole inside 16:9.
		expect(clipShape(parseClipUrl('https://www.youtube.com/shorts/aaaaaaaaaaa'))).toBe('wide');
		expect(clipShape(parseClipUrl('https://vimeo.com/123456'))).toBe('wide');
	});

	it('defaults to wide for anything without a known embed', () => {
		expect(clipShape(parseClipUrl('https://example.com/a-video'))).toBe('wide');
		expect(clipShape(null)).toBe('wide');
		// An Instagram link that carried no code has no embed, so no reel/post.
		expect(clipShape(parseClipUrl('https://www.instagram.com/someone/'))).toBe('wide');
	});
});

describe('posterRatio', () => {
	it('is the image ratio when it is within range', () => {
		expect(posterRatio(1280, 720)).toBeCloseTo(16 / 9, 5);
		expect(posterRatio(1080, 1350)).toBeCloseTo(4 / 5, 5); // a 4:5 Vimeo poster
		expect(posterRatio(600, 600)).toBe(1);
	});

	it('clamps a more extreme image to the reel..16:9 range', () => {
		expect(posterRatio(1080, 1920)).toBeCloseTo(SHAPE_RATIO.reel, 5); // 9:16, the floor
		expect(posterRatio(200, 1000)).toBeCloseTo(SHAPE_RATIO.reel, 5); // taller than a reel
		expect(posterRatio(4000, 1000)).toBeCloseTo(SHAPE_RATIO.wide, 5); // wider than 16:9
	});

	it('is null when there is no usable size', () => {
		expect(posterRatio(0, 0)).toBeNull();
		expect(posterRatio(640, 0)).toBeNull();
		expect(posterRatio(NaN, NaN)).toBeNull();
	});
});

describe('cardBox', () => {
	it('fills the column for a landscape clip', () => {
		const style = cardBox(SHAPE_RATIO.wide);
		expect(style).toContain('width: 100%');
		expect(style).toContain('aspect-ratio: 1.7778');
		expect(style).not.toContain('vh');
	});

	it('caps an upright clip by height and centers it', () => {
		const style = cardBox(SHAPE_RATIO.reel);
		expect(style).toContain('aspect-ratio: 0.5625');
		expect(style).toContain('margin-inline: auto');
		expect(style).toContain('60vh'); // the default cap
		// Width never exceeds the column or the viewport.
		expect(style).toContain('min(100%');
	});

	it('honours a smaller height cap', () => {
		expect(cardBox(SHAPE_RATIO.reel, 50)).toContain('50vh');
	});
});

describe('cinemaBox', () => {
	it('fills the stage for a landscape clip', () => {
		expect(cinemaBox(SHAPE_RATIO.wide)).toBe('height: 100%; width: 100%;');
	});

	it('keeps an upright clip to its ratio, centered on the stage', () => {
		const style = cinemaBox(SHAPE_RATIO.reel);
		expect(style).toContain('aspect-ratio: 0.5625');
		expect(style).toContain('height: 100%');
		expect(style).toContain('max-width: 100%');
		expect(style).toContain('margin-inline: auto');
	});
});
