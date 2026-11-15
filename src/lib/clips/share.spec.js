import { describe, expect, it } from 'vitest';
import {
	buildAppLink,
	LINK_TEXT_MAX,
	linkText,
	parseAppLink,
	parseStandaloneClip,
	withoutClipLink
} from './share.js';

describe('app links', () => {
	const address = '/orbitdb/zdpuAzyoga000000000000000000000000000000000000000';

	it('round-trips a playlist address and a clip id', () => {
		const link = buildAppLink('https://yoga-clips.example.com/', {
			db: address,
			clip: 'clip-0001'
		});
		expect(link).toBe(
			`https://yoga-clips.example.com/?db=${encodeURIComponent(address)}&clip=clip-0001`
		);
		expect(parseAppLink(new URL(link).search)).toEqual({ db: address, clip: 'clip-0001' });
	});

	it('ignores values that are not an address or an id', () => {
		expect(parseAppLink('?db=javascript:alert(1)&clip=<img>')).toEqual({ db: null, clip: null });
		expect(parseAppLink('')).toEqual({ db: null, clip: null });
	});
});

describe('a clip link that carries the clip', () => {
	const address = '/orbitdb/zdpuAzyoga000000000000000000000000000000000000000';
	/** @param {Record<string, string>} params */
	const link = (params) => `?${new URLSearchParams(params)}`;

	it('builds the clip from the link alone, the frame from the parsed id', () => {
		const found = parseStandaloneClip(
			link({
				db: address,
				clip: 'clip-0001',
				url: 'https://youtu.be/dQw4w9WgXcQ?t=42&list=x',
				title: 'Shoulder opener',
				teacher: 'Example Teacher',
				sec: '300'
			})
		);
		expect(found).toMatchObject({
			db: address,
			host: 'www.youtube.com',
			clip: {
				id: 'clip-0001',
				url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				source: 'youtube',
				title: 'Shoulder opener',
				teacher: 'Example Teacher',
				durationSec: 300
			},
			parsed: { embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0' }
		});
		// The ordinary reading of the same link is unchanged.
		expect(parseAppLink(link({ clip: 'clip-0001', url: 'https://youtu.be/dQw4w9WgXcQ' }))).toEqual({
			db: null,
			clip: 'clip-0001'
		});
	});

	it('needs only the clip and its url', () => {
		const found = parseStandaloneClip(
			link({ clip: 'clip-0001', url: 'https://vimeo.com/76979871' })
		);
		expect(found?.clip).toMatchObject({ title: '', teacher: '', durationSec: 0, source: 'vimeo' });
		expect(found?.parsed.embedUrl).toBe('https://player.vimeo.com/video/76979871?autoplay=1&dnt=1');
		expect(found?.db).toBeNull();
	});

	it('is an ordinary clip link without a url, or without a clip id', () => {
		expect(parseStandaloneClip(link({ clip: 'clip-0001' }))).toBeNull();
		expect(parseStandaloneClip(link({ clip: 'clip-0001', url: '' }))).toBeNull();
		expect(parseStandaloneClip(link({ url: 'https://youtu.be/dQw4w9WgXcQ' }))).toBeNull();
		expect(
			parseStandaloneClip(link({ clip: '<img>', url: 'https://youtu.be/dQw4w9WgXcQ' }))
		).toBeNull();
	});

	it('refuses an address that is not https written out in full', () => {
		for (const url of [
			'javascript:alert(1)',
			'data:text/html,<script>alert(1)</script>',
			'http://youtu.be/dQw4w9WgXcQ',
			'youtu.be/dQw4w9WgXcQ',
			'//youtu.be/dQw4w9WgXcQ',
			'https://localhost/clip',
			'https://user:secret@example.com/clip',
			`https://example.com/${'a'.repeat(3000)}`
		]) {
			expect(parseStandaloneClip(link({ clip: 'clip-0001', url })), url).toBeNull();
		}
	});

	it('frames nothing for an address that is not a service it knows, and names its host', () => {
		const found = parseStandaloneClip(
			link({
				clip: 'clip-0001',
				url: 'https://yoga-clips.le-space.de.example.com/?clip=1',
				title: 'Yoga Clips'
			})
		);
		expect(found?.clip.source).toBe('other');
		expect(found?.parsed.embedUrl).toBeNull();
		expect(found?.host).toBe('yoga-clips.le-space.de.example.com');
		// A YouTube address without a video id frames nothing either.
		const channel = parseStandaloneClip(
			link({ clip: 'clip-0001', url: 'https://www.youtube.com/@example' })
		);
		expect(channel?.parsed.embedUrl).toBeNull();
	});

	it('keeps the texts as plain text, short', () => {
		const found = parseStandaloneClip(
			link({
				clip: 'clip-0001',
				url: 'https://youtu.be/dQw4w9WgXcQ',
				title: `<img src=x onerror=alert(1)>\u202eevil\u0000\n${'x'.repeat(500)}`,
				teacher: '  Example\tTeacher  '
			})
		);
		expect(found?.clip.title.startsWith('<img src=x onerror=alert(1)> evil x')).toBe(true);
		expect(Array.from(found?.clip.title ?? '').length).toBeLessThanOrEqual(LINK_TEXT_MAX);
		// eslint-disable-next-line no-control-regex
		expect(found?.clip.title).not.toMatch(/[\u0000-\u001f\u202e]/);
		expect(found?.clip.teacher).toBe('Example Teacher');
		expect(linkText(null)).toBe('');
	});

	it('takes a length in whole seconds within what a clip may last, else none', () => {
		/** @param {string} sec */
		const length = (sec) =>
			parseStandaloneClip(link({ clip: 'clip-0001', url: 'https://youtu.be/dQw4w9WgXcQ', sec }))
				?.clip.durationSec;
		expect(length('90')).toBe(90);
		expect(length('3600')).toBe(3600);
		for (const sec of ['0', '-5', '1.5', '1e3', '3601', '99999999', 'NaN', ' ']) {
			expect(length(sec), sec).toBe(0);
		}
	});

	it('leads to the full app with the playlist kept and the clip left out', () => {
		const url = withoutClipLink(
			`https://yoga-clips.example.com/${link({
				db: address,
				clip: 'clip-0001',
				url: 'https://youtu.be/dQw4w9WgXcQ',
				title: 't',
				teacher: 'x',
				sec: '60'
			})}#library`
		);
		expect(url.search).toBe(`?db=${encodeURIComponent(address)}`);
		expect(url.hash).toBe('#library');
	});
});
