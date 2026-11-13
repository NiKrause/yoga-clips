<script>
	// The player. YouTube goes through youtube-nocookie.com, Vimeo through
	// player.vimeo.com with do-not-track, an Instagram post or reel through its
	// own /embed/ page; each only once this dialog is open. Everything else
	// gets a card with the link. No third party's script runs in this page:
	// each service's code stays inside its own frame.
	//
	// The Instagram frame is sandboxed to what it needs to play: its scripts
	// and its own origin. Without the origin WebKit does not load the video
	// (measured 2026-11-13); popups and navigating this page stay off, so the
	// links inside the frame do nothing and the button below is the way out.
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration, parseClipUrl } from './clips/schema.js';
	import { buildAppLink } from './clips/share.js';

	/** @type {import('./clips/schema.js').Clip | null} */
	export let clip = null;
	export let playlistAddress = '';
	export let doneToday = false;
	/** @type {() => void} */
	export let onclose = () => {};
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let ondone = () => {};

	/** @type {HTMLDialogElement | null} */
	let dialog = null;
	let copied = false;

	$: parsed = clip ? parseClipUrl(clip.url) : null;
	$: embedUrl = parsed?.embedUrl ?? null;
	$: if (dialog && clip && !dialog.open) dialog.showModal();
	$: if (dialog && !clip && dialog.open) dialog.close();
	$: clipLink =
		clip && typeof location !== 'undefined'
			? buildAppLink(location.origin, { db: playlistAddress, clip: clip.id })
			: '';

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(clipLink);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.warn('Clipboard unavailable:', error);
		}
	}

	/** @param {MouseEvent} event */
	function onBackdrop(event) {
		if (event.target === dialog) onclose();
	}
</script>

<dialog
	bind:this={dialog}
	on:close={onclose}
	on:click={onBackdrop}
	class="m-auto w-[min(96vw,56rem)] rounded-lg border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/70"
	data-testid="player-dialog"
>
	{#if clip}
		<div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
			<div class="min-w-0">
				<h2 class="truncate text-lg font-semibold text-heading" data-testid="player-title">
					{clip.title}
				</h2>
				<p class="text-xs text-faint">
					{#if clip.teacher}{clip.teacher} ·
					{/if}{formatDuration(clip.durationSec)} · {$_(`source.${clip.source}`)}
				</p>
			</div>
			<button
				type="button"
				on:click={onclose}
				class="shrink-0 rounded-md border border-border px-2 py-1 text-sm hover:bg-surface-2"
				data-testid="player-close"
				aria-label={$_('player.close')}>✕</button
			>
		</div>

		{#if embedUrl && clip.source === 'instagram'}
			<div class="flex justify-center bg-black" data-testid="player-instagram">
				<iframe
					src={embedUrl}
					title={clip.title}
					class="h-[min(70vh,46rem)] w-full max-w-[26rem] bg-white"
					sandbox="allow-scripts allow-same-origin"
					allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
					data-testid="player-iframe"
				></iframe>
			</div>
			<div
				class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"
			>
				<p class="min-w-0 flex-1 basis-64 text-xs text-faint" data-testid="player-instagram-hint">
					{$_('player.instagramHint')}
				</p>
				<a
					href={clip.url}
					target="_blank"
					rel="noopener noreferrer"
					class="shrink-0 rounded-md bg-coral-700 px-5 py-2 font-medium text-white hover:bg-coral-800"
					data-testid="player-open-external"
				>
					{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}
				</a>
			</div>
		{:else if embedUrl}
			<div class="aspect-video w-full bg-black">
				<iframe
					src={embedUrl}
					title={clip.title}
					class="h-full w-full"
					allow="autoplay; fullscreen; picture-in-picture"
					allowfullscreen
					referrerpolicy="strict-origin-when-cross-origin"
					data-testid="player-iframe"
				></iframe>
			</div>
		{:else}
			<div
				class="flex flex-col items-center gap-3 px-4 py-10 text-center"
				data-testid="player-external"
			>
				<p class="text-sm text-faint">{$_('player.otherHint')}</p>
				<a
					href={clip.url}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-md bg-coral-700 px-5 py-2 font-medium text-white hover:bg-coral-800"
					data-testid="player-open-external"
				>
					{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}
				</a>
			</div>
		{/if}

		<div class="flex flex-wrap items-center gap-2 px-4 py-3">
			{#if doneToday}
				<span
					class="rounded-md bg-identity-500/15 px-3 py-1.5 text-sm font-medium text-identity-600"
					data-testid="player-done-today">✓ {$_('clip.doneToday')}</span
				>
			{:else}
				<button
					type="button"
					on:click={() => clip && ondone(clip)}
					class="rounded-md bg-identity-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-identity-800"
					data-testid="player-done"
				>
					✓ {$_('clip.done')}
				</button>
			{/if}
			<button
				type="button"
				on:click={copyLink}
				class="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
				data-testid="player-copy-link"
			>
				{copied ? $_('player.copiedLink') : $_('player.copyLink')}
			</button>
			<a
				href={clip.url}
				target="_blank"
				rel="noopener noreferrer"
				class="ml-auto text-xs text-cyan underline"
			>
				{$_('player.openLink')}
			</a>
		</div>
	{/if}
</dialog>
