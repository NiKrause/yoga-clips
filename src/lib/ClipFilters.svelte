<script>
	// "I have N minutes": the filter the mod answers for you, here by hand.
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

	const MAX_MINUTES = 30;

	function reset() {
		teacher = '';
		tag = '';
		minutes = 0;
	}

	$: active = teacher || tag || minutes > 0;
</script>

<section class="card mt-4 p-4" data-testid="clip-filters">
	<div class="flex flex-wrap items-end gap-3">
		<h2 class="mr-auto text-lg font-semibold text-heading">{$_('filter.heading')}</h2>
		<label class="block text-xs text-faint">
			{$_('filter.teacher')}
			<select
				bind:value={teacher}
				data-testid="filter-teacher"
				class="mt-1 block rounded-md border border-border px-2 py-1.5 text-sm"
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
				class="mt-1 block rounded-md border border-border px-2 py-1.5 text-sm"
			>
				<option value="">{$_('filter.tagAll')}</option>
				{#each tags as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</label>
		<label class="block min-w-48 text-xs text-faint">
			<span data-testid="filter-minutes-label"
				>{minutes > 0
					? $_('filter.minutes', { values: { minutes } })
					: $_('filter.minutesAny')}</span
			>
			<input
				type="range"
				min="0"
				max={MAX_MINUTES}
				step="1"
				bind:value={minutes}
				data-testid="filter-minutes"
				class="mt-2 block w-full accent-[var(--accent)]"
			/>
		</label>
	</div>
	<div class="mt-2 flex items-center gap-3 text-xs text-faint">
		<span data-testid="filter-count">{$_('filter.showing', { values: { count, total } })}</span>
		{#if active}
			<button
				type="button"
				on:click={reset}
				class="underline hover:text-heading"
				data-testid="filter-reset">{$_('filter.reset')}</button
			>
		{/if}
	</div>
</section>
