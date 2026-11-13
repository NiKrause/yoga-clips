<script>
	// The player dialog: a clip from the list, with its done mark and its link.
	// What is framed, and how, is `ClipFrame`'s; it is rendered only while
	// this dialog is open, which is after the click on a card.
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration, parseClipUrl } from './clips/schema.js';
	import { buildAppLink } from './clips/share.js';
	import ClipFrame from './ClipFrame.svelte';

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
	class="sheet backdrop:bg-black/70"
	data-testid="player-dialog"
>
	{#if clip}
		<div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
			<div class="min-w-0">
				<h2 class="truncate text-lg font-semibold text-heading" data-testid="player-title">
					{clip.title}
				</h2>
				<p class="text-xs text-faint">
					{[clip.teacher, formatDuration(clip.durationSec), $_(`source.${clip.source}`)]
						.filter(Boolean)
						.join(' · ')}
				</p>
			</div>
			<button
				type="button"
				on:click={onclose}
				class="btn btn-ghost btn-sm shrink-0"
				data-testid="player-close"
				aria-label={$_('player.close')}>✕</button
			>
		</div>

		{#if parsed && embedUrl && clip.source === 'instagram'}
			<div class="flex justify-center bg-black" data-testid="player-instagram">
				<ClipFrame
					{parsed}
					title={clip.title}
					frameClass="h-[min(70vh,46rem)] w-full max-w-[26rem] bg-white"
				/>
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
					class="btn btn-primary shrink-0"
					data-testid="player-open-external"
				>
					{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}
				</a>
			</div>
		{:else if parsed && embedUrl}
			<div class="aspect-video w-full bg-black">
				<ClipFrame {parsed} title={clip.title} />
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
					class="btn btn-primary"
					data-testid="player-open-external"
				>
					{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}
				</a>
			</div>
		{/if}

		<div class="flex flex-wrap items-center gap-2 px-4 py-3">
			{#if doneToday}
				<span
					class="rounded-md bg-identity-500/15 px-3 py-1.5 text-sm font-medium text-identity"
					data-testid="player-done-today">✓ {$_('clip.doneToday')}</span
				>
			{:else}
				<button
					type="button"
					on:click={() => clip && ondone(clip)}
					class="btn btn-primary btn-sm"
					data-testid="player-done"
				>
					✓ {$_('clip.done')}
				</button>
			{/if}
			<button
				type="button"
				on:click={copyLink}
				class="btn btn-ghost btn-sm"
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
