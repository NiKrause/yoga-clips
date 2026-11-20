<script>
	// Practise (NiKrause/yoga-clips#1, step 4, A's screen in direction B):
	// "How much time do you have?", then one suggestion and what else fits, by
	// the yoga-break mod's rule (clips/practice.js). From all of a person's
	// playlists as this browser last saw them (clips/summaries.js) and the open
	// one as it is now; a playlist never opened here is not among them. The
	// minutes today and this week sit here too.
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration } from './clips/schema.js';
	import { fittingClips } from './clips/practice.js';
	import { knownClipsStore } from './clips/summaries.js';
	import { thumbnailFor } from './clips/thumbnails.js';
	import { listRegistryStore } from './list-registry.js';
	import { activePlaylistStore, clipsStore, playlistDisplayName } from './clips/store.js';
	import PracticeStats from './PracticeStats.svelte';
	import { doneToday as doneOn } from './clips/done.js';

	/** @type {{ today: number, week: number }} */
	export let stats = { today: 0, week: 0 };
	/** The done marks of this identity (clips/done.js). @type {import('./clips/done.js').DoneLog} */
	export let doneLog = {};
	/**
	 * Play a suggestion: in its playlist's page, opening that playlist first
	 * when it is another.
	 * @type {(pick: { address: string, clip: any }) => void}
	 */
	export let onplay = () => {};

	const CHOICES = [2, 5, 10, 20];
	const KEY = 'yogaClips.practiseMinutes';
	let minutes = 5;

	onMount(() => {
		try {
			const kept = Number(localStorage.getItem(KEY));
			if (CHOICES.includes(kept)) minutes = kept;
		} catch {
			// the default it is
		}
	});

	/** @param {number} value */
	function choose(value) {
		minutes = value;
		try {
			localStorage.setItem(KEY, String(value));
		} catch {
			// remembered for this visit only
		}
	}

	/** Every clip a suggestion may come from, each with its playlist. */
	$: pool = poolOf($knownClipsStore, $clipsStore, $activePlaylistStore.address, $listRegistryStore);
	$: fitting = fittingClips(pool, minutes, (id) => doneOn(doneLog, id));
	$: suggestion = fitting[0] ?? null;
	$: alsoFits = fitting.slice(1, 5);

	/**
	 * @param {Record<string, any[]>} known
	 * @param {any[]} open
	 * @param {string} openAddress
	 * @param {{ address: string, name: string }[]} registry
	 */
	function poolOf(known, open, openAddress, registry) {
		const names = new Map(registry.map((entry) => [entry.address, entry.name]));
		/** @type {any[]} */
		const all = [];
		/** @type {Record<string, true>} */
		const seen = {};
		const add = (/** @type {string} */ address, /** @type {any[]} */ clips) => {
			for (const clip of clips) {
				const key = `${address} ${clip.id}`;
				if (seen[key]) continue;
				seen[key] = true;
				all.push({ ...clip, address, playlist: playlistDisplayName(names.get(address) ?? '') });
			}
		};
		if (openAddress) add(openAddress, open);
		for (const [address, clips] of Object.entries(known)) {
			// A playlist removed from this person's list is not suggested from.
			if (address !== openAddress && names.has(address)) add(address, clips);
		}
		return all;
	}

	/** @type {string | null} */
	let thumb = null;
	$: suggestionKey = suggestion ? `${suggestion.address} ${suggestion.id}` : '';
	$: loadThumb(suggestionKey);

	/** @param {string} key */
	function loadThumb(key) {
		thumb = null;
		const clip = suggestion;
		if (!clip) return;
		void thumbnailFor(clip).then((url) => {
			if (suggestionKey === key) thumb = url;
		});
	}
</script>

<section data-testid="practise">
	<h2 class="mb-3 text-2xl font-semibold text-heading">{$_('practise.question')}</h2>
	<div class="flex flex-wrap gap-2" role="group" aria-label={$_('practise.question')}>
		{#each CHOICES as value (value)}
			<button
				type="button"
				class="chip !px-4 !py-2 !text-sm {minutes === value ? 'chip-on' : ''}"
				aria-pressed={minutes === value}
				on:click={() => choose(value)}
				data-testid="practise-minutes-{value}"
				>{$_('practise.minutes', { values: { minutes: value } })}</button
			>
		{/each}
	</div>

	{#if suggestion}
		<div class="card mt-5 max-w-2xl overflow-hidden" data-testid="practise-suggestion">
			<button
				type="button"
				class="group relative block aspect-video w-full bg-tile-2"
				on:click={() => onplay({ address: suggestion.address, clip: suggestion })}
				aria-label={`${$_('clip.play')}: ${suggestion.title}`}
				data-testid="practise-play"
			>
				{#if thumb}
					<img
						src={thumb}
						alt=""
						loading="lazy"
						referrerpolicy="no-referrer"
						class="h-full w-full object-cover"
					/>
				{/if}
				<span
					class="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent pl-1 text-2xl text-accent-ink transition group-hover:scale-105"
					aria-hidden="true">▶</span
				>
				<span
					class="absolute right-2 bottom-2 rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-heading"
					>{formatDuration(suggestion.durationSec)}</span
				>
			</button>
			<div class="p-4">
				<p class="font-semibold text-heading" data-testid="practise-suggestion-title">
					{suggestion.title}
				</p>
				<p class="text-sm text-faint">
					{[
						suggestion.teacher,
						suggestion.playlist
							? $_('library.from', { values: { name: suggestion.playlist } })
							: '',
						doneOn(doneLog, suggestion.id) ? `✓ ${$_('clip.doneToday')}` : ''
					]
						.filter(Boolean)
						.join(' · ')}
				</p>
			</div>
		</div>

		{#if alsoFits.length}
			<h3 class="section-label mt-6">{$_('practise.alsoFits')}</h3>
			<ul class="max-w-2xl" data-testid="practise-also">
				{#each alsoFits as clip (`${clip.address} ${clip.id}`)}
					<li class="list-row">
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center gap-3 text-left"
							on:click={() => onplay({ address: clip.address, clip })}
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium text-heading">{clip.title}</span>
								<span class="block truncate text-xs text-faint"
									>{[clip.teacher, clip.playlist].filter(Boolean).join(' · ')}</span
								>
							</span>
							<span class="shrink-0 font-mono text-xs text-faint"
								>{formatDuration(clip.durationSec)}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<p class="card mt-5 max-w-2xl p-6 text-center text-sm text-faint" data-testid="practise-none">
			{pool.length ? $_('practise.nothingFits') : $_('practise.noClips')}
		</p>
	{/if}

	<div class="mt-6">
		<PracticeStats {stats} />
	</div>
</section>
