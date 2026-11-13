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
	/** The clip playing in the player above the list. */
	export let currentId = '';
	/** @type {(clip: Clip) => void} */
	export let onplay = () => {};
	/** @type {(clip: Clip) => void} */
	export let ondone = () => {};
	/** @type {(clip: Clip) => void} */
	export let onundo = () => {};
	/** @type {(clip: Clip) => void} */
	export let onremove = () => {};
	import { doneToday, doneCount } from './clips/done.js';

	// Who added a clip is worth a word only where more than one person adds
	// to the playlist: someone else's playlist, or one with someone else's
	// clips in it. Never as a raw identity.
	$: shared = !isOwner || clips.some((clip) => clip.addedBy !== identityId);
</script>

<section class="mt-4" data-testid="clip-grid">
	{#if clips.length}
		<h3 class="section-label">
			{$_('clip.listHeading', { values: { count: clips.length } })}
		</h3>
		<ul>
			{#each clips as clip (clip.id)}
				<ClipCard
					{clip}
					current={clip.id === currentId}
					doneToday={doneToday(doneLog, clip.id)}
					doneCount={doneCount(doneLog, clip.id)}
					canRemove={isOwner || (Boolean(identityId) && clip.addedBy === identityId)}
					author={shared
						? Boolean(identityId) && clip.addedBy === identityId
							? 'you'
							: 'other'
						: null}
					{onplay}
					{ondone}
					{onundo}
					{onremove}
				/>
			{/each}
		</ul>
	{:else}
		<p
			class="rounded-lg border border-dashed border-border py-10 text-center text-sm text-faint"
			data-testid="clip-empty"
		>
			{total ? $_('filter.emptyFiltered') : $_('filter.empty')}
		</p>
	{/if}
</section>
