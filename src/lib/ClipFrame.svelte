<script>
	// The one place a service's player is framed — the player dialog and the
	// cinema page both show a clip through this, so what a frame may do is
	// decided once.
	//
	// YouTube comes from youtube-nocookie.com, Vimeo from player.vimeo.com
	// with do-not-track, an Instagram post or reel from its own /embed/ page.
	// No third party's script runs in this page: each service's code stays
	// inside its frame.
	//
	// The Instagram frame is sandboxed to what it needs to play: its scripts
	// and its own origin. Without the origin WebKit does not load the video
	// (measured 2026-11-13); popups and navigating this page stay off, so the
	// links inside that frame do nothing and the "open" button beside it is
	// the way out.
	//
	// Rendering this is what contacts the service. Whoever renders it does so
	// on a click.
	import { endReportingUrl, watchEnd } from './clips/player-end.js';

	/** @type {import('./clips/schema.js').ParsedClipUrl} */
	export let parsed;
	export let title = '';
	export let frameClass = 'h-full w-full';
	/**
	 * Called when the player says its video is over (YouTube, Vimeo). Decided
	 * when the frame is created: asking YouTube to report changes its address.
	 *
	 * @type {(() => void) | null}
	 */
	export let onended = null;

	const reports = onended !== null;

	$: instagram = parsed.source === 'instagram';
	$: src =
		parsed.embedUrl && reports
			? endReportingUrl(parsed.embedUrl, parsed.source, window.location.origin)
			: parsed.embedUrl;

	/** @param {HTMLIFrameElement} node */
	function reportEnd(node) {
		if (!reports) return {};
		return { destroy: watchEnd(node, parsed.source, () => onended?.()) };
	}
</script>

{#if src}
	<iframe
		use:reportEnd
		{src}
		{title}
		class={frameClass}
		sandbox={instagram ? 'allow-scripts allow-same-origin' : undefined}
		allow={instagram
			? 'autoplay; fullscreen; picture-in-picture; encrypted-media'
			: 'autoplay; fullscreen; picture-in-picture'}
		allowfullscreen
		referrerpolicy="strict-origin-when-cross-origin"
		data-testid="player-iframe"
		data-source={parsed.source}
	></iframe>
{/if}
