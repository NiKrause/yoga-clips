import { describe, expect, it } from 'vitest';
import { fetchOEmbed, wholeSeconds } from './oembed.js';

/**
 * A service that answers every request with one body, and remembers what it
 * was asked.
 *
 * @param {unknown} body
 * @param {{ ok?: boolean }} [options]
 */
function service(body, { ok = true } = {}) {
	/** @type {string[]} */
	const asked = [];
	/** @type {any} */
	const fetchImpl = async (/** @type {string} */ url) => {
		asked.push(String(url));
		return { ok, json: async () => body };
	};
	return { asked, fetch: fetchImpl };
}

describe('fetchOEmbed', () => {
	it('takes the length from a Vimeo answer', async () => {
		const vimeo = service({
			title: 'Morning flow',
			author_name: 'Wolkenfabrik Yoga',
			thumbnail_url: 'https://i.vimeocdn.com/video/1.jpg',
			duration: 754
		});
		const info = await fetchOEmbed('https://vimeo.com/123456789', { fetch: vimeo.fetch });
		expect(info).toEqual({
			title: 'Morning flow',
			authorName: 'Wolkenfabrik Yoga',
			thumbnailUrl: 'https://i.vimeocdn.com/video/1.jpg',
			durationSec: 754
		});
		expect(vimeo.asked).toEqual([
			'https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F123456789'
		]);
	});

	it('has no length for YouTube, whose answer carries none', async () => {
		const youtube = service({ title: 'Shoulder opener', author_name: 'Example Channel' });
		const info = await fetchOEmbed('https://youtu.be/dQw4w9WgXcQ', { fetch: youtube.fetch });
		expect(info?.title).toBe('Shoulder opener');
		expect(info?.durationSec).toBeNull();
	});

	it('reads a length only from a positive number', async () => {
		for (const duration of ['754', 0, -5, Number.NaN, null, { seconds: 754 }]) {
			const vimeo = service({ title: 'x', duration });
			const info = await fetchOEmbed('https://vimeo.com/123456789', { fetch: vimeo.fetch });
			expect(info?.durationSec, JSON.stringify(duration)).toBeNull();
		}
	});

	it('answers null, not an error, when the service refuses or is not one we ask', async () => {
		const refusing = service({}, { ok: false });
		expect(await fetchOEmbed('https://vimeo.com/123456789', { fetch: refusing.fetch })).toBeNull();

		const never = service({ title: 'x', duration: 60 });
		expect(
			await fetchOEmbed('https://www.instagram.com/reel/Cabc123/', { fetch: never.fetch })
		).toBeNull();
		expect(await fetchOEmbed('https://example.com/video', { fetch: never.fetch })).toBeNull();
		expect(never.asked).toEqual([]);
	});
});

describe('wholeSeconds', () => {
	it('rounds to whole seconds and never to zero', () => {
		expect(wholeSeconds(213.6)).toBe(214);
		expect(wholeSeconds(0.2)).toBe(1);
		expect(wholeSeconds(Number.POSITIVE_INFINITY)).toBeNull();
	});
});
