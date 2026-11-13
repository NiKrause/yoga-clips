import { afterEach, describe, expect, it } from 'vitest';
import { readPlayerMessage, readYouTubeDuration } from './youtube-duration.js';

const VIDEO = 'dQw4w9WgXcQ';
const probes = () => document.querySelectorAll('[data-testid="youtube-duration-probe"]');

/** @type {string[]} */
let made = [];

/**
 * A stand-in for YouTube's player: a page of this origin that behaves as the
 * player does towards its embedder — silent until greeted, then reporting.
 * These tests never contact YouTube.
 *
 * @param {string} script what the page runs; `report(message)` posts to the embedder
 */
function playerThat(script) {
	const html = `<!doctype html><script>
		const report = (message) => parent.postMessage(JSON.stringify(message), '*');
		const greeted = new Promise((resolve) =>
			addEventListener('message', (event) => {
				try {
					if (JSON.parse(event.data).event === 'listening') resolve();
				} catch {}
			})
		);
		${script}
	</script>`;
	const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
	made.push(url);
	return { origin: window.location.origin, url: () => url };
}

afterEach(() => {
	for (const url of made) URL.revokeObjectURL(url);
	made = [];
	for (const frame of probes()) frame.remove();
});

describe('readPlayerMessage', () => {
	it('reads the length from the player’s info messages', () => {
		const said = (/** @type {unknown} */ message) => readPlayerMessage(JSON.stringify(message));
		expect(said({ event: 'initialDelivery', info: { duration: 214 } })).toEqual({
			durationSec: 214,
			failed: false
		});
		expect(said({ event: 'infoDelivery', info: { duration: 213.6 } }).durationSec).toBe(214);
	});

	it('takes a length of 0 as "not known yet", and onError as "there will be none"', () => {
		expect(
			readPlayerMessage(JSON.stringify({ event: 'initialDelivery', info: { duration: 0 } }))
		).toEqual({ durationSec: null, failed: false });
		expect(readPlayerMessage(JSON.stringify({ event: 'onError', info: 150 }))).toEqual({
			durationSec: null,
			failed: true
		});
	});

	it('finds nothing in what is not the player’s JSON', () => {
		for (const data of [
			undefined,
			null,
			214,
			{ info: { duration: 214 } },
			'not json',
			'214',
			'[]'
		]) {
			expect(readPlayerMessage(data), String(data)).toEqual({ durationSec: null, failed: false });
		}
		expect(
			readPlayerMessage(JSON.stringify({ event: 'infoDelivery', info: { duration: '214' } }))
				.durationSec
		).toBeNull();
	});
});

describe('readYouTubeDuration', () => {
	it('greets the player, takes the length it reports, and removes its frame', async () => {
		const player = playerThat(`
			greeted.then(() => {
				report({ event: 'initialDelivery', info: { duration: 0 } });
				report({ event: 'infoDelivery', info: { duration: 754.4 } });
			});
		`);
		const pending = readYouTubeDuration(VIDEO, { player, timeoutMs: 5000 });

		const frame = /** @type {HTMLIFrameElement} */ (probes()[0]);
		expect(frame.hidden).toBe(true);
		expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
		expect(frame.hasAttribute('credentialless')).toBe(true);

		expect(await pending).toBe(754);
		expect(probes().length).toBe(0);
	});

	it('asks the embed without autoplay, from youtube-nocookie.com', async () => {
		/** @type {string[]} */
		const asked = [];
		const player = playerThat(`greeted.then(() => report({ event: 'onError', info: 150 }));`);
		await readYouTubeDuration(VIDEO, {
			timeoutMs: 5000,
			player: {
				origin: player.origin,
				url: (videoId, pageOrigin) => {
					asked.push(`${videoId} ${pageOrigin}`);
					return player.url();
				}
			}
		});
		expect(asked).toEqual([`${VIDEO} ${window.location.origin}`]);

		// The real address, without loading it: a frame that is aborted at once.
		const aborted = new AbortController();
		aborted.abort();
		expect(await readYouTubeDuration(VIDEO, { signal: aborted.signal })).toBeNull();
		expect(probes().length).toBe(0);
	});

	it('gives up with null when the player says the video cannot be had', async () => {
		const player = playerThat(`greeted.then(() => report({ event: 'onError', info: 100 }));`);
		expect(await readYouTubeDuration(VIDEO, { player, timeoutMs: 5000 })).toBeNull();
		expect(probes().length).toBe(0);
	});

	it('gives up with null when the player never answers', async () => {
		const player = playerThat(`/* silent */`);
		const started = performance.now();
		expect(await readYouTubeDuration(VIDEO, { player, timeoutMs: 300 })).toBeNull();
		expect(performance.now() - started).toBeGreaterThanOrEqual(250);
		expect(probes().length).toBe(0);
	});

	it('stops at once when the link is replaced', async () => {
		const player = playerThat(`/* silent */`);
		const controller = new AbortController();
		const pending = readYouTubeDuration(VIDEO, {
			player,
			signal: controller.signal,
			timeoutMs: 5000
		});
		expect(probes().length).toBe(1);
		controller.abort();
		expect(await pending).toBeNull();
		expect(probes().length).toBe(0);
	});

	it('listens to its own frame only', async () => {
		// A silent player, and somebody else on the page claiming a length:
		// this window itself, which has the right origin and the wrong source.
		const player = playerThat(`/* silent */`);
		const pending = readYouTubeDuration(VIDEO, { player, timeoutMs: 400 });
		window.postMessage(
			JSON.stringify({ event: 'infoDelivery', info: { duration: 999 } }),
			window.location.origin
		);
		expect(await pending).toBeNull();

		// And the right frame speaking from an origin that is not the player's.
		const speaking = playerThat(`report({ event: 'infoDelivery', info: { duration: 999 } });`);
		expect(
			await readYouTubeDuration(VIDEO, {
				timeoutMs: 400,
				player: { origin: 'https://www.youtube-nocookie.com', url: speaking.url }
			})
		).toBeNull();
	});

	it('loads nothing for something that is not a video id', async () => {
		expect(await readYouTubeDuration('../../evil?x=1')).toBeNull();
		expect(await readYouTubeDuration('')).toBeNull();
		expect(probes().length).toBe(0);
	});
});
