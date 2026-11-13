<script>
	// The filter as one quiet row above the list (direction B): any length, up
	// to 5, up to 10 minutes. Teacher and tag sit behind "Filter", so the list
	// starts right below the player on a phone.
	import { _ } from '$lib/i18n/index.js';

	/** @type {string[]} */
	export let teachers = [];
	/** @type {string[]} */
	export let tags = [];
	export let teacher = '';
	export let tag = '';
	/** Minutes available; 0 means any length. */
	export let minutes = 0;
	export let count = 0;
	export let total = 0;

	const LENGTHS = [0, 5, 10];
	let more = false;

	function reset() {
		teacher = '';
		tag = '';
		minutes = 0;
	}

	$: narrowed = Boolean(teacher || tag);
	$: active = narrowed || minutes > 0;
</script>

<section class="mt-2 mb-3" data-testid="clip-filters" aria-label={$_('filter.heading')}>
	<div class="flex flex-wrap items-center gap-2">
		{#each LENGTHS as length (length)}
			<button
				type="button"
				class="chip !px-3 !py-1.5 !text-[13px] {minutes === length ? 'chip-on' : ''}"
				aria-pressed={minutes === length}
				on:click={() => (minutes = length)}
				data-testid="filter-minutes-{length}"
			>
				{length ? $_('filter.upTo', { values: { minutes: length } }) : $_('filter.all')}
			</button>
		{/each}
		<button
			type="button"
			class="chip !px-3 !py-1.5 !text-[13px] {narrowed ? 'chip-on' : ''}"
			aria-expanded={more}
			on:click={() => (more = !more)}
			data-testid="filter-more">{$_('filter.more')}{narrowed ? ' ·' : ''}</button
		>
		<span class="ml-auto text-xs text-faint" data-testid="filter-count"
			>{$_('filter.showing', { values: { count, total } })}</span
		>
	</div>
	{#if more}
		<div class="mt-2 flex flex-wrap items-end gap-3">
			<label class="block text-xs text-faint">
				{$_('filter.teacher')}
				<select
					bind:value={teacher}
					data-testid="filter-teacher"
					class="mt-1 block rounded-lg border border-border px-2 py-1.5 text-sm"
				>
					<option value="">{$_('filter.teacherAll')}</option>
					{#each teachers as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</label>
			<label class="block text-xs text-faint">
				{$_('filter.tag')}
				<select
					bind:value={tag}
					data-testid="filter-tag"
					class="mt-1 block rounded-lg border border-border px-2 py-1.5 text-sm"
				>
					<option value="">{$_('filter.tagAll')}</option>
					{#each tags as name (name)}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</label>
			{#if active}
				<button
					type="button"
					on:click={reset}
					class="pb-2 text-xs text-faint underline hover:text-heading"
					data-testid="filter-reset">{$_('filter.reset')}</button
				>
			{/if}
		</div>
	{/if}
</section>
