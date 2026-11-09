<script>
	// One clip. Nothing from the clip's services loads before the card is on
	// screen (the thumbnail, lazily) and nothing plays before a click.
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration } from './clips/schema.js';
	import { thumbnailFor } from './clips/thumbnails.js';

	/** @type {import('./clips/schema.js').Clip} */
	export let clip;
	export let doneToday = false;
	export let doneCount = 0;
	export let canRemove = false;
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let onplay = () => {};
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let ondone = () => {};
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let onundo = () => {};
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let onremove = () => {};

	/** @type {string | null} */
	let thumbnail = null;
	let thumbnailFailed = false;

	onMount(() => {
		void thumbnailFor(clip).then((url) => (thumbnail = url));
	});

	/** @param {string} did */
	function shortDid(did) {
		return did.length > 20 ? `${did.slice(0, 10)}…${did.slice(-6)}` : did;
	}

	$: embeddable = clip.source === 'youtube' || clip.source === 'vimeo';
</script>

<article
	class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
	data-testid="clip-card"
	data-clip-id={clip.id}
	data-source={clip.source}
>
	<button
		type="button"
		on:click={() => onplay(clip)}
		class="group relative block aspect-video w-full bg-surface-2 text-left"
		data-testid="clip-play"
		aria-label={embeddable
			? $_('clip.play')
			: $_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}
	>
		{#if thumbnail && !thumbnailFailed}
			<img
				src={thumbnail}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
				class="h-full w-full object-cover"
				on:error={() => (thumbnailFailed = true)}
			/>
		{:else}
			<div class="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
				<span class="text-3xl" aria-hidden="true">
					{#if clip.source === 'instagram'}◎{:else if clip.source === 'vimeo'}▶{:else if clip.source === 'youtube'}▶{:else}↗{/if}
				</span>
				<span class="text-xs">{$_(`source.${clip.source}`)}</span>
			</div>
		{/if}
		<span
			class="absolute right-2 bottom-2 rounded bg-code/80 px-1.5 py-0.5 font-mono text-xs text-white"
			data-testid="clip-duration-badge">{formatDuration(clip.durationSec)}</span
		>
		<span
			class="absolute inset-0 flex items-center justify-center bg-code/0 text-white opacity-0 transition group-hover:bg-code/40 group-hover:opacity-100 group-focus-visible:opacity-100"
		>
			<span class="rounded-full bg-coral-700 px-4 py-2 text-sm font-medium"
				>{embeddable
					? $_('clip.play')
					: $_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}</span
			>
		</span>
	</button>

	<div class="flex flex-1 flex-col gap-1 p-3">
		<h3 class="font-semibold text-heading" data-testid="clip-card-title">{clip.title}</h3>
		{#if clip.teacher}
			<p class="text-sm text-text" data-testid="clip-card-teacher">{clip.teacher}</p>
		{/if}
		{#if clip.tags.length}
			<ul class="flex flex-wrap gap-1" data-testid="clip-card-tags">
				{#each clip.tags as tag (tag)}
					<li class="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text">{tag}</li>
				{/each}
			</ul>
		{/if}
		<p class="mt-auto pt-1 text-[11px] text-faint">
			{$_('clip.addedBy')}
			<code
				class="rounded bg-surface-2 px-1"
				title={clip.addedBy}
				data-testid="clip-card-author"
				data-did={clip.addedBy}>{shortDid(clip.addedBy)}</code
			>
			·
			<span data-testid="clip-done-count"
				>{$_('clip.doneCount', { values: { count: doneCount } })}</span
			>
		</p>
		<div class="mt-1 flex flex-wrap items-center gap-2">
			{#if doneToday}
				<span
					class="rounded-md bg-identity-500/15 px-2 py-1 text-xs font-medium text-identity-600"
					data-testid="clip-done-today"
				>
					✓ {$_('clip.doneToday')}
				</span>
				<button
					type="button"
					on:click={() => onundo(clip)}
					class="text-xs text-faint underline hover:text-heading"
					data-testid="clip-undo"
				>
					{$_('clip.undoDone')}
				</button>
			{:else}
				<button
					type="button"
					on:click={() => ondone(clip)}
					class="rounded-md border border-identity-500/60 px-2 py-1 text-xs font-medium text-identity-600 hover:bg-identity-500/10"
					data-testid="clip-done"
				>
					✓ {$_('clip.done')}
				</button>
			{/if}
			<a
				href={clip.url}
				target="_blank"
				rel="noopener noreferrer"
				class="text-xs text-cyan underline"
				data-testid="clip-open-link"
				>{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}</a
			>
			{#if canRemove}
				<button
					type="button"
					on:click={() => onremove(clip)}
					class="ml-auto text-xs text-danger hover:underline"
					data-testid="clip-remove"
				>
					{$_('clip.remove')}
				</button>
			{/if}
		</div>
	</div>
</article>
