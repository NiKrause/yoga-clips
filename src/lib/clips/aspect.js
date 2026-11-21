/**
 * The shape a clip plays in — so a frame takes the clip's own format instead
 * of cropping it into 16:9.
 *
 * Where the shape comes from, cheapest first and without a new field in the
 * record or a new request to any service:
 *
 *  - the clip's url alone (`clipShape`): an Instagram reel is upright 9:16, an
 *    Instagram post or tv portrait-ish (shown 4:5, the tallest common post, so
 *    a square or a landscape post letterboxes rather than crops); everything
 *    else — YouTube, Vimeo — is 16:9, and their players letterbox a vertical
 *    video themselves inside that frame, so nothing of the clip is cut off.
 *  - a poster that has already loaded (`posterRatio`): its natural size is the
 *    clip's true ratio, so a vertical Vimeo (whose thumbnail is portrait) gets
 *    a portrait box too. The value is clamped: a stray measurement can never
 *    make a frame more extreme than a reel or wider than 16:9.
 *
 * `cardBox` / `cinemaBox` turn a ratio into the frame's size. An upright clip
 * is kept on screen — its width is the largest that fits a height cap, the
 * column and the viewport — so title and "Done" stay above the fold on a
 * laptop and the frame still fits a phone.
 *
 * Pure, no browser APIs: runs in vitest and in the app the same way.
 */

/** @typedef {'reel' | 'post' | 'wide'} ClipShape */

/** width / height for each shape. */
export const SHAPE_RATIO = Object.freeze({
	reel: 9 / 16,
	post: 4 / 5,
	wide: 16 / 9
});

const MIN_RATIO = SHAPE_RATIO.reel;
const MAX_RATIO = SHAPE_RATIO.wide;

/**
 * The shape to default to, from the parsed url alone.
 *
 * @param {import('./schema.js').ParsedClipUrl | null | undefined} parsed
 * @returns {ClipShape}
 */
export function clipShape(parsed) {
	if (parsed?.source === 'instagram' && parsed.embedUrl) {
		// `parseClipUrl` routes a reel through `/reel/<code>/embed/` and
		// everything else through `/p/<code>/embed/`.
		return parsed.embedUrl.includes('/reel/') ? 'reel' : 'post';
	}
	return 'wide';
}

/**
 * The ratio of a poster that has loaded, clamped to a sane range, or null when
 * the image has no usable size (not loaded, broken, or zero-sized).
 *
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @returns {number | null}
 */
export function posterRatio(naturalWidth, naturalHeight) {
	const w = Number(naturalWidth);
	const h = Number(naturalHeight);
	if (!(w > 0) || !(h > 0)) return null;
	return Math.min(Math.max(w / h, MIN_RATIO), MAX_RATIO);
}

/** @param {number} ratio */
function round(ratio) {
	// Enough digits for the layout, short enough for a style attribute.
	return Number(ratio.toFixed(4));
}

/**
 * The frame's size in a card context (the player at the top of a playlist, the
 * library's "continue", a suggestion's poster).
 *
 * A landscape or square clip fills the column. An upright clip is centered and
 * no taller than `maxVh` of the viewport, so what sits below it stays in view.
 *
 * @param {number} ratio width / height
 * @param {number} [maxVh] height cap, in vh
 * @returns {string} an inline style
 */
export function cardBox(ratio, maxVh = 60) {
	const r = round(ratio);
	if (r >= 1) return `aspect-ratio: ${r}; width: 100%;`;
	return `aspect-ratio: ${r}; width: min(100%, calc(${maxVh}vh * ${r})); margin-inline: auto;`;
}

/**
 * The frame's size on the cinema page: the clip is as large as the dark stage
 * allows, upright or wide, centered and never cropped.
 *
 * @param {number} ratio width / height
 * @returns {string} an inline style
 */
export function cinemaBox(ratio) {
	const r = round(ratio);
	if (r >= 1) return 'height: 100%; width: 100%;';
	return `aspect-ratio: ${r}; height: 100%; width: auto; max-width: 100%; margin-inline: auto;`;
}
