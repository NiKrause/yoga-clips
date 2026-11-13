import { afterEach, describe, expect, it } from 'vitest';
import { endReportingUrl, saysEnded, watchEnd } from './player-end.js';

/** @type {string[]} */
let made = [];
/** @type {HTMLIFrameElement[]} */
let frames = [];

/**
 * A stand-in for a player: a page of this origin that posts to its embedder
 * what the script says. These tests contact no service.
 *
 * @param {string} script `report(message)` posts JSON; `greeted` resolves on YouTube's greeting
 */
function playerThat(script) {
	const html = `<!doctype html><script>
		const report = (message) => parent.postMessage(JSON.stringify(message), '*');
		const asked = [];
		const greeted = new Promise((resolve) =>
			addEventListener('message', (event) => {
				try {
					const message = JSON.parse(event.data);
					asked.push(message);
					if (message.event === 'listening') resolve();
				} catch {}
			})
		);
		${script}
	</script>`;
	const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
	made.push(url);
	const frame = document.createElement('iframe');
	frame.hidden = true;
	frames.push(frame);
	return {
		frame,
		load: () => {
			frame.src = url;
			document.body.append(frame);
		}
	};
}

/** @param {() => boolean} condition */
async function until(condition, ms = 3000) {
	const deadline = performance.now() + ms;
	while (!condition() && performance.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return condition();
}

afterEach(() => {
	for (const url of made) URL.revokeObjectURL(url);
	for (const frame of frames) frame.remove();
	made = [];
	frames = [];
});

describe('endReportingUrl', () => {
	it('asks YouTube to report, and leaves every other address alone', () => {
		const url = new URL(
			endReportingUrl(
				'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0',
				'youtube',
				'https://yoga-clips.example'
			)
		);
		expect(url.origin + url.pathname).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			autoplay: '1',
			rel: '0',
			enablejsapi: '1',
			origin: 'https://yoga-clips.example'
		});

		const vimeo = 'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1';
		expect(endReportingUrl(vimeo, 'vimeo', 'https://yoga-clips.example')).toBe(vimeo);
		const reel = 'https://www.instagram.com/reel/C0dEexample/embed/';
		expect(endReportingUrl(reel, 'instagram', 'https://yoga-clips.example')).toBe(reel);
	});
});

describe('saysEnded', () => {
	it('hears YouTube’s state 0, and no other state', () => {
		const said = (/** @type {unknown} */ message) => saysEnded('youtube', JSON.stringify(message));
		expect(said({ event: 'infoDelivery', info: { playerState: 0 } })).toBe(true);
		expect(said({ event: 'onStateChange', info: 0 })).toBe(true);
		expect(said({ event: 'infoDelivery', info: { playerState: 1 } })).toBe(false);
		expect(said({ event: 'infoDelivery', info: { currentTime: 0 } })).toBe(false);
		expect(said({ event: 'initialDelivery', info: { playerState: 0 } })).toBe(false);
		expect(said({ event: 'onReady' })).toBe(false);
	});

	it('hears Vimeo’s ended, as a string or as an object', () => {
		expect(saysEnded('vimeo', JSON.stringify({ event: 'ended', data: { seconds: 62 } }))).toBe(
			true
		);
		expect(saysEnded('vimeo', { event: 'ended' })).toBe(true);
		expect(saysEnded('vimeo', { event: 'play' })).toBe(false);
	});

	it('hears nothing from anyone else, or in what is not a message', () => {
		expect(saysEnded('instagram', { event: 'ended' })).toBe(false);
		expect(
			saysEnded('other', JSON.stringify({ event: 'infoDelivery', info: { playerState: 0 } }))
		).toBe(false);
		for (const data of [undefined, null, 0, 'ended', '{', '[]']) {
			expect(saysEnded('youtube', data), String(data)).toBe(false);
			expect(saysEnded('vimeo', data), String(data)).toBe(false);
		}
	});
});

describe('watchEnd', () => {
	const origin = window.location.origin;

	it('greets YouTube’s player and hears it end', async () => {
		const player = playerThat(`
			greeted.then(() => {
				report({ event: 'infoDelivery', info: { playerState: 1 } });
				setTimeout(() => report({ event: 'infoDelivery', info: { playerState: 0 } }), 100);
			});
		`);
		let ended = 0;
		const stop = watchEnd(player.frame, 'youtube', () => (ended += 1), { origin });
		player.load();
		expect(await until(() => ended === 1)).toBe(true);
		stop();
	});

	it('asks Vimeo’s player for its ending once it is ready, and hears it', async () => {
		const player = playerThat(`
			addEventListener('message', (event) => {
				const message = JSON.parse(event.data);
				if (message.method === 'addEventListener' && message.value === 'ended') {
					report({ event: 'ended', data: { seconds: 62 } });
				}
			});
			report({ event: 'ready' });
		`);
		let ended = 0;
		const stop = watchEnd(player.frame, 'vimeo', () => (ended += 1), { origin });
		player.load();
		expect(await until(() => ended === 1)).toBe(true);
		stop();
	});

	it('listens to its own frame only, and not after it was stopped', async () => {
		const player = playerThat(`
			addEventListener('message', (event) => {
				if (JSON.parse(event.data).go) report({ event: 'ended' });
			});
		`);
		let ended = 0;
		const stop = watchEnd(player.frame, 'vimeo', () => (ended += 1), { origin });
		player.load();
		await new Promise((resolve) => player.frame.addEventListener('load', resolve, { once: true }));

		// Somebody else on the page, with the right origin and the wrong window.
		window.postMessage(JSON.stringify({ event: 'ended' }), origin);
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(ended).toBe(0);

		stop();
		player.frame.contentWindow?.postMessage(JSON.stringify({ go: true }), origin);
		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(ended).toBe(0);
	});

	it('does not listen to the right frame speaking from another origin', async () => {
		const player = playerThat(`report({ event: 'ended' });`);
		let ended = 0;
		const stop = watchEnd(player.frame, 'vimeo', () => (ended += 1));
		player.load();
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(ended).toBe(0);
		stop();
	});

	it('has nothing to watch for Instagram', () => {
		const player = playerThat(``);
		expect(typeof watchEnd(player.frame, 'instagram', () => {})).toBe('function');
	});
});
