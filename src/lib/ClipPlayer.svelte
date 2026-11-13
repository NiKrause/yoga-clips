<script>
	// The player at the top of a playlist's page (NiKrause/yoga-clips#1, step 4,
	// direction B): the clip plays in the page, not in a dialog above it, and
	// the playlist's list stays below. It is rendered only after a press on a
	// clip, so nothing is asked of the video service before. "Done" sits by
	// the video; "Fullscreen" leads to the cinema page. An Instagram post or
	// reel gets an upright frame and keeps "Open on Instagram" as the way out.
	import { tick } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration, parseClipUrl } from './clips/schema.js';
	import { buildAppLink } from './clips/share.js';
	import ClipFrame from './ClipFrame.svelte';

	/** @type {import('./clips/schema.js').Clip | null} */
	export let clip = null;
	export let playlistAddress = '';
	export let playlistName = '';
	export let doneToday = false;
	/** @type {() => void} */
	export let onclose = () => {};
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let ondone = () => {};
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let onfullscreen = () => {};

	/** @type {HTMLElement | null} */
	let section = null;
	let copied = false;

	$: parsed = clip ? parseClipUrl(clip.url) : null;
	$: embedUrl = parsed?.embedUrl ?? null;
	$: upright = clip?.source === 'instagram';
	$: clipLink =
		clip && typeof location !== 'undefined'
			? buildAppLink(location.origin, { db: playlistAddress, clip: clip.id })
			: '';
	// A new clip starts where the eye is: the top of the page.
	$: clipId = clip?.id ?? '';
	$: if (clipId) void showAtTop();

	async function showAtTop() {
		await tick();
		section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
		section?.focus({ preventScroll: true });
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(clipLink);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.warn('Clipboard unavailable:', error);
		}
	}
</script>

{#if clip}
	<section
		bind:this={section}
		tabindex="-1"
		class="-mx-4 mb-4 scroll-mt-4 outline-none sm:mx-0 sm:max-w-3xl"
		aria-label={clip.title}
		data-testid="player"
		data-clip-id={clip.id}
	>
		{#if parsed && embedUrl && upright}
			<div class="flex justify-center bg-black sm:rounded-2xl" data-testid="player-instagram">
				<ClipFrame
					{parsed}
					title={clip.title}
					frameClass="h-[min(58vh,40rem)] w-full max-w-[24rem] bg-white"
				/>
			</div>
		{:else if parsed && embedUrl}
			<div class="aspect-video w-full overflow-hidden bg-black sm:rounded-2xl">
				<ClipFrame {parsed} title={clip.title} />
			</div>
		{:else}
			<div
				class="card flex flex-col items-center gap-3 px-4 py-10 text-center"
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

		<div class="px-4 pt-3 sm:px-0">
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="text-lg font-semibold text-heading" data-testid="player-title">
						{clip.title}
					</h3>
					<p class="text-sm text-faint">
						{[clip.teacher, formatDuration(clip.durationSec), playlistName]
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

			<div class="mt-3 grid grid-cols-2 gap-2">
				{#if doneToday}
					<span
						class="flex min-h-11 items-center justify-center rounded-xl bg-identity/15 text-sm font-semibold text-identity"
						data-testid="player-done-today">✓ {$_('clip.doneToday')}</span
					>
				{:else}
					<button
						type="button"
						on:click={() => clip && ondone(clip)}
						class="btn btn-primary"
						data-testid="player-done"
					>
						✓ {$_('clip.done')}
					</button>
				{/if}
				{#if upright && embedUrl}
					<a
						href={clip.url}
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-ghost"
						data-testid="player-open-external"
					>
						{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}
					</a>
				{:else if embedUrl}
					<button
						type="button"
						on:click={() => clip && onfullscreen(clip)}
						class="btn btn-ghost"
						data-testid="player-fullscreen"
					>
						{$_('cinema.fullscreen')}
					</button>
				{/if}
			</div>
			{#if upright && embedUrl}
				<p class="mt-2 text-xs text-faint" data-testid="player-instagram-hint">
					{$_('player.instagramHint')}
				</p>
			{/if}
			<div class="mt-2 flex items-center gap-3 text-xs">
				<button
					type="button"
					on:click={copyLink}
					class="text-faint underline hover:text-heading"
					data-testid="player-copy-link"
				>
					{copied ? $_('player.copiedLink') : $_('player.copyLink')}
				</button>
				<a href={clip.url} target="_blank" rel="noopener noreferrer" class="text-cyan underline">
					{$_('player.openLink')}
				</a>
			</div>
		</div>
	</section>
{/if}
