<script>
	import { _ } from '$lib/i18n/index.js';
	import ClipCard from './ClipCard.svelte';

	/** @typedef {import('./clips/schema.js').Clip} Clip */

	/** @type {Clip[]} */
	export let clips = [];
	export let total = 0;
	/** @type {import('./clips/done.js').DoneLog} */
	export let doneLog = {};
	/** The owner may remove any clip; everyone else only what they added. */
	export let isOwner = false;
	export let identityId = '';
	/** @type {(clip: Clip) => void} */
	export let onplay = () => {};
	/** @type {(clip: Clip) => void} */
	export let ondone = () => {};
	/** @type {(clip: Clip) => void} */
	export let onundo = () => {};
	/** @type {(clip: Clip) => void} */
	export let onremove = () => {};
	import { doneToday, doneCount } from './clips/done.js';
</script>

<section class="mt-4" data-testid="clip-grid">
	{#if clips.length}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each clips as clip (clip.id)}
				<ClipCard
					{clip}
					doneToday={doneToday(doneLog, clip.id)}
					doneCount={doneCount(doneLog, clip.id)}
					canRemove={isOwner || (Boolean(identityId) && clip.addedBy === identityId)}
					{onplay}
					{ondone}
					{onundo}
					{onremove}
				/>
			{/each}
		</div>
	{:else}
		<p
			class="rounded-lg border border-dashed border-border py-10 text-center text-sm text-faint"
			data-testid="clip-empty"
		>
			{total ? $_('filter.emptyFiltered') : $_('filter.empty')}
		</p>
	{/if}
</section>
