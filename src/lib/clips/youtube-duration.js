import { wholeSeconds } from './oembed.js';

/**
 * The length of a YouTube video, read from YouTube's own player.
 *
 * YouTube's oEmbed answer has no duration and its Data API wants a key, so
 * the one keyless source is the embedded player: once loaded it reports the
 * video's length to the page that embeds it, before anything plays (measured
 * 2026-11-13 in Chromium, Firefox and WebKit: about three seconds, no cookie
 * set). The player is the same one `ClipPlayer` shows, from
 * youtube-nocookie.com, here without autoplay and out of sight.
 *
 * This contacts YouTube when a link is pasted, not only at play. The consent
 * screen and the README say so; change them with this file.
 *
 * It never rejects and never blocks: no answer within `timeoutMs`, a video
 * the player refuses, an abort — each is `null`, and the form then leaves the
 * field to the person.
 */

export const YOUTUBE_PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';

const VIDEO_ID = /^[\w-]{11}$/;
const GREETING_EVERY_MS = 250;

/**
 * @param {string} videoId
 * @param {string} pageOrigin
 */
function playerUrl(videoId, pageOrigin) {
	return `${YOUTUBE_PLAYER_ORIGIN}/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(pageOrigin)}`;
}

/**
 * What one message of the player says about the length. The player speaks
 * JSON in a string: `{ event: 'initialDelivery' | 'infoDelivery', info: {
 * duration } }` carries it, `{ event: 'onError' }` says there will be none.
 * A length of 0 is the player not knowing yet, not an answer.
 *
 * @param {unknown} data
 * @returns {{ durationSec: number | null, failed: boolean }}
 */
export function readPlayerMessage(data) {
	const nothing = { durationSec: null, failed: false };
	if (typeof data !== 'string') return nothing;
	let message;
	try {
		message = JSON.parse(data);
	} catch {
		return nothing;
	}
	if (typeof message !== 'object' || message === null) return nothing;
	if (message.event === 'onError') return { durationSec: null, failed: true };
	const info = message.info;
	if (typeof info !== 'object' || info === null) return nothing;
	return { durationSec: wholeSeconds(info.duration), failed: false };
}

/**
 * @param {string} videoId an id `parseClipUrl` accepted
 * @param {{
 *   signal?: AbortSignal,
 *   timeoutMs?: number,
 *   player?: { origin: string, url: (videoId: string, pageOrigin: string) => string }
 * }} [options] `player` exists for the tests, which have no YouTube
 * @returns {Promise<number | null>} whole seconds, or null
 */
export function readYouTubeDuration(videoId, options = {}) {
	const {
		signal,
		timeoutMs = 8000,
		player = { origin: YOUTUBE_PLAYER_ORIGIN, url: playerUrl }
	} = options;
	if (typeof document === 'undefined' || !VIDEO_ID.test(videoId) || signal?.aborted) {
		return Promise.resolve(null);
	}

	return new Promise((resolve) => {
		const frame = document.createElement('iframe');
		// Out of sight, out of the tab order, and with as little as a player
		// that only has to say a number needs: scripts and its own origin, no
		// popups, no navigation of this page, and (where the browser knows the
		// attribute) no cookies or storage of the person's YouTube session.
		frame.hidden = true;
		frame.tabIndex = -1;
		frame.setAttribute('aria-hidden', 'true');
		frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
		frame.setAttribute('credentialless', '');
		frame.referrerPolicy = 'strict-origin-when-cross-origin';
		frame.dataset.testid = 'youtube-duration-probe';

		/** @type {ReturnType<typeof setInterval> | undefined} */
		let greeting;

		/** @param {number | null} seconds */
		const finish = (seconds) => {
			clearInterval(greeting);
			clearTimeout(deadline);
			window.removeEventListener('message', onMessage);
			signal?.removeEventListener('abort', onAbort);
			frame.remove();
			resolve(seconds);
		};

		/** @param {MessageEvent} event */
		const onMessage = (event) => {
			// Any frame and any extension can post to this window. Only this
			// frame, speaking from the player's origin, is listened to.
			if (event.origin !== player.origin || event.source !== frame.contentWindow) return;
			const { durationSec, failed } = readPlayerMessage(event.data);
			if (durationSec !== null) finish(durationSec);
			else if (failed) finish(null);
		};
		const onAbort = () => finish(null);

		// The player reports to whoever says it is listening, and only then.
		// It may not be ready at `load`, so the greeting repeats until an
		// answer or the deadline ends it.
		const greet = () => {
			try {
				frame.contentWindow?.postMessage(
					JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
					player.origin
				);
			} catch {
				// A frame that went away between two greetings: the deadline ends it.
			}
		};
		frame.addEventListener('load', () => {
			greet();
			greeting = setInterval(greet, GREETING_EVERY_MS);
		});

		window.addEventListener('message', onMessage);
		signal?.addEventListener('abort', onAbort, { once: true });
		const deadline = setTimeout(() => finish(null), timeoutMs);

		frame.src = player.url(videoId, window.location.origin);
		document.body.append(frame);
	});
}
