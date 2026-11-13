<script>
	// One clip as a row of the playlist's list (direction B): a small picture,
	// title and teacher, its length; the per-clip actions quieter below.
	// Nothing from the clip's service loads before the row is on screen (the
	// thumbnail, lazily) and nothing plays before a press.
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration, parseClipUrl } from './clips/schema.js';
	import { thumbnailFor } from './clips/thumbnails.js';

	/** @type {import('./clips/schema.js').Clip} */
	export let clip;
	export let doneToday = false;
	export let doneCount = 0;
	export let canRemove = false;
	/** The clip playing in the player above. */
	export let current = false;
	/**
	 * Who added the clip, said only on a shared playlist (ClipGrid decides):
	 * 'you', 'other', or null for nothing.
	 * @type {'you' | 'other' | null}
	 */
	export let author = null;
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

	// Plays in the player (YouTube, Vimeo, an Instagram post or reel), or is
	// only a link to open.
	$: embeddable = Boolean(parseClipUrl(clip.url)?.embedUrl);
</script>

<li
	class="list-row !items-start {current ? 'rounded-xl !border-transparent bg-surface px-2' : ''}"
	data-testid="clip-card"
	data-clip-id={clip.id}
	data-source={clip.source}
	data-current={current}
	aria-current={current ? 'true' : undefined}
>
	<button
		type="button"
		on:click={() => onplay(clip)}
		class="group relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-tile-2"
		data-testid="clip-play"
		aria-label={embeddable
			? `${$_('clip.play')}: ${clip.title}`
			: `${$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}: ${clip.title}`}
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
			<span class="flex h-full w-full items-center justify-center text-faint" aria-hidden="true">
				{#if clip.source === 'instagram'}◎{:else if embeddable}▶{:else}↗{/if}
			</span>
		{/if}
		<span
			class="absolute inset-0 flex items-center justify-center bg-black/0 text-lg text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100 group-focus-visible:opacity-100"
			aria-hidden="true">{embeddable ? '▶' : '↗'}</span
		>
	</button>

	<div class="min-w-0 flex-1">
		<button
			type="button"
			on:click={() => onplay(clip)}
			class="block w-full text-left"
			tabindex="-1"
			aria-hidden="true"
		>
			<span class="block font-semibold text-heading" data-testid="clip-card-title"
				>{clip.title}</span
			>
			<span class="block text-xs text-faint">
				{#if current}<span class="font-medium text-accent-text">{$_('clip.playing')}</span
					>{:else if clip.teacher}<span data-testid="clip-card-teacher">{clip.teacher}</span>{/if}
			</span>
		</button>
		{#if clip.tags.length}
			<ul class="mt-1 flex flex-wrap gap-1" data-testid="clip-card-tags">
				{#each clip.tags as tag (tag)}
					<li class="chip !px-2 !py-0 !text-[11px]">{tag}</li>
				{/each}
			</ul>
		{/if}
		<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
			{#if author}
				<span data-testid="clip-card-author" data-did={clip.addedBy}
					>{author === 'you' ? $_('clip.addedByYou') : $_('clip.addedByOther')}</span
				>
			{/if}
			<span data-testid="clip-done-count"
				>{$_('clip.doneCount', { values: { count: doneCount } })}</span
			>
			{#if doneToday}
				<span class="font-medium text-identity" data-testid="clip-done-today"
					>✓ {$_('clip.doneToday')}</span
				>
				<button
					type="button"
					on:click={() => onundo(clip)}
					class="underline hover:text-heading"
					data-testid="clip-undo">{$_('clip.undoDone')}</button
				>
			{:else}
				<button
					type="button"
					on:click={() => ondone(clip)}
					class="font-medium text-identity hover:underline"
					data-testid="clip-done">✓ {$_('clip.done')}</button
				>
			{/if}
			<a
				href={clip.url}
				target="_blank"
				rel="noopener noreferrer"
				class="text-cyan underline"
				data-testid="clip-open-link"
				>{$_('clip.openOn', { values: { source: $_(`source.${clip.source}`) } })}</a
			>
			{#if canRemove}
				<button
					type="button"
					on:click={() => onremove(clip)}
					class="text-danger hover:underline"
					data-testid="clip-remove">{$_('clip.remove')}</button
				>
			{/if}
		</div>
	</div>

	<span class="shrink-0 pt-0.5 font-mono text-xs text-faint" data-testid="clip-duration-badge"
		>{formatDuration(clip.durationSec)}</span
	>
</li>
