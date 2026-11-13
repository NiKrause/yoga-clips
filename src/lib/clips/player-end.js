/**
 * Hearing from a framed player that its video has ended.
 *
 * The cinema page wants to come back from fullscreen when a clip is over.
 * Both players that can tell do so by `postMessage` to the page that frames
 * them, without any script of theirs in this page:
 *
 * - YouTube, once the page has said it is listening and the embed carries
 *   `enablejsapi=1`: `{ event: 'infoDelivery', info: { playerState: 0 } }`
 *   (measured 2026-11-13).
 * - Vimeo, once asked for it after its `ready`: `{ event: 'ended' }`, as its
 *   player documents (not seen in a headless browser, where its video did
 *   not start).
 *
 * Instagram's embed page tells nothing. For it, and for a player that stays
 * silent, the clip simply does not end by itself: leaving fullscreen is the
 * person's, as it always may be.
 */

/** @type {Record<string, string>} */
export const PLAYER_ORIGINS = {
	youtube: 'https://www.youtube-nocookie.com',
	vimeo: 'https://player.vimeo.com'
};

const GREETING_EVERY_MS = 250;
const GREETINGS_AT_MOST = 40;

/**
 * The embed address that also reports. Only YouTube needs to be told in the
 * address; everything else is returned as it came.
 *
 * @param {string} embedUrl
 * @param {string} source
 * @param {string} pageOrigin
 */
export function endReportingUrl(embedUrl, source, pageOrigin) {
	if (source !== 'youtube') return embedUrl;
	const url = new URL(embedUrl);
	url.searchParams.set('enablejsapi', '1');
	url.searchParams.set('origin', pageOrigin);
	return url.href;
}

/**
 * A player's message as an object, whether it came as JSON in a string
 * (YouTube) or as an object (Vimeo does either).
 *
 * @param {unknown} data
 * @returns {Record<string, any> | null}
 */
function messageOf(data) {
	let message = data;
	if (typeof data === 'string') {
		try {
			message = JSON.parse(data);
		} catch {
			return null;
		}
	}
	return typeof message === 'object' && message !== null
		? /** @type {Record<string, any>} */ (message)
		: null;
}

/**
 * @param {string} source
 * @param {unknown} data what the player posted
 */
export function saysEnded(source, data) {
	const message = messageOf(data);
	if (!message) return false;
	if (source === 'youtube') {
		if (message.event === 'onStateChange') return message.info === 0;
		return message.event === 'infoDelivery' && message.info?.playerState === 0;
	}
	if (source === 'vimeo') return message.event === 'ended' || message.event === 'finish';
	return false;
}

/**
 * @param {HTMLIFrameElement} frame the player's frame
 * @param {string} source
 * @param {() => void} onEnded may be called more than once for one ending
 * @param {{ origin?: string }} [options] `origin` exists for the tests
 * @returns {() => void} stop listening
 */
export function watchEnd(frame, source, onEnded, { origin = PLAYER_ORIGINS[source] } = {}) {
	if (!origin) return () => {};

	/** @type {ReturnType<typeof setInterval> | undefined} */
	let greeting;
	let greetings = 0;

	/** @param {Record<string, unknown>} message */
	const say = (message) => {
		try {
			frame.contentWindow?.postMessage(JSON.stringify(message), origin);
		} catch {
			// A frame that is gone has nothing more to end.
		}
	};

	/** @param {MessageEvent} event */
	const onMessage = (event) => {
		// Only this frame, speaking from its player's origin, is listened to.
		if (event.origin !== origin || event.source !== frame.contentWindow) return;
		clearInterval(greeting);
		if (source === 'vimeo' && messageOf(event.data)?.event === 'ready') {
			say({ method: 'addEventListener', value: 'ended' });
		}
		if (saysEnded(source, event.data)) onEnded();
	};

	const onLoad = () => {
		if (source !== 'youtube') return;
		// YouTube reports to whoever says it is listening, and may not be
		// ready at `load`: the greeting repeats until the player answers.
		clearInterval(greeting);
		greetings = 0;
		const greet = () => {
			if (++greetings > GREETINGS_AT_MOST) return clearInterval(greeting);
			say({ event: 'listening', id: 1, channel: 'widget' });
		};
		greet();
		greeting = setInterval(greet, GREETING_EVERY_MS);
	};

	window.addEventListener('message', onMessage);
	frame.addEventListener('load', onLoad);
	return () => {
		clearInterval(greeting);
		window.removeEventListener('message', onMessage);
		frame.removeEventListener('load', onLoad);
	};
}
