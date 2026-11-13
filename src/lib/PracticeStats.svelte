<script>
	// Minutes today and this week, from the local done marks and the durations
	// of the clips in the open playlist.
	import { _ } from '$lib/i18n/index.js';

	/** @type {{ today: number, week: number }} */
	export let stats = { today: 0, week: 0 };
</script>

<div class="card flex items-center gap-4 px-4 py-2 text-sm" data-testid="practice-stats">
	<span class="font-semibold text-heading">{$_('stats.heading')}</span>
	<span>
		<span class="font-mono text-heading" data-testid="stats-today"
			>{$_('stats.minutes', { values: { minutes: stats.today } })}</span
		>
		<span class="text-faint"> {$_('stats.today')}</span>
	</span>
	<span>
		<span class="font-mono text-heading" data-testid="stats-week"
			>{$_('stats.minutes', { values: { minutes: stats.week } })}</span
		>
		<span class="text-faint"> {$_('stats.week')}</span>
	</span>
</div>
