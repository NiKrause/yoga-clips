import { describe, expect, it } from 'vitest';
import { formatPosted, instagramPostedAt, postedAt } from './posted.js';

// The sample post of Meta's oEmbed documentation. Its id, as Instagram
// answers it, is 558717847597368461; the code is that number in base 64.
const CODE = 'fA9uwTtkSN';
const POSTED = '2013-10-03T18:19:39.392Z';
const NOW = new Date('2026-11-17T12:00:00.000Z');

describe('instagramPostedAt', () => {
	it('reads the moment a post was made from its code', () => {
		expect(instagramPostedAt(CODE, NOW)?.toISOString()).toBe(POSTED);
	});

	it('reads a code of today’s length', () => {
		// 2024-01-01T00:00:00.000Z, shard and sequence zero.
		const id = (BigInt(Date.UTC(2024, 0, 1)) - 1314220021721n) << 23n;
		let code = '';
		for (let rest = id; rest > 0n; rest /= 64n) {
			code =
				'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Number(rest % 64n)] +
				code;
		}
		expect(code).toHaveLength(11);
		expect(instagramPostedAt(code, NOW)?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
	});

	it('has no date for what is not a code', () => {
		for (const code of [null, undefined, '', 'not a code', 'abc.def', 'fA9uwTtkSN='])
			expect(instagramPostedAt(code, NOW)).toBeNull();
	});

	it('has no date for an id from before the scheme, which counted up from 1', () => {
		// 150 000 000 in base 64: every bit of it lies after the time.
		expect(instagramPostedAt('I8NGA', NOW)).toBeNull();
		expect(instagramPostedAt('B', NOW)).toBeNull();
	});

	it('has no date for a moment that has not come', () => {
		expect(instagramPostedAt(CODE, new Date('2013-10-01T00:00:00.000Z'))).toBeNull();
		expect(instagramPostedAt('___________', NOW)).toBeNull();
	});

	it('leaves the longer code of a private account alone', () => {
		expect(instagramPostedAt(`${CODE}AbCdEfGhIjKlMnOpQrStUvWxYz01`, NOW)).toBeNull();
	});
});

describe('postedAt', () => {
	it('finds the date in an Instagram link, post or reel', () => {
		for (const url of [
			`https://www.instagram.com/p/${CODE}/`,
			`https://www.instagram.com/reel/${CODE}/?igsh=example`,
			`instagram.com/reels/${CODE}`
		])
			expect(postedAt(url, NOW)?.toISOString()).toBe(POSTED);
	});

	it('has none for other services, and none for an Instagram profile', () => {
		for (const url of [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			'https://vimeo.com/123456789',
			`https://example.com/p/${CODE}/`,
			'https://www.instagram.com/example_teacher/',
			'not a link'
		])
			expect(postedAt(url, NOW)).toBeNull();
	});
});

describe('formatPosted', () => {
	it('says the date in the language asked for', () => {
		const noon = new Date('2013-10-03T12:00:00.000Z');
		expect(formatPosted(noon, 'en')).toMatch(/Oct 3, 2013/);
		expect(formatPosted(noon, 'de')).toMatch(/03\.10\.2013/);
		expect(formatPosted(noon, null)).toMatch(/2013/);
	});
});
