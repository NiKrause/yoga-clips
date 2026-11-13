<script>
	/**
	 * The Yoga Clips signet — the countdown: an arc for the waiting time that
	 * runs out, and a clip in its middle. Belege's construction and palette:
	 * one accent shape (amber by day, lime at night) and one ink shape (ink by
	 * day, snow at night), through --mark-accent and --mark-ink in app.css.
	 * The masters are in brand/. Without a label it is decoration, hidden from
	 * assistive technology (next to the app's name).
	 */
	let { size = 52, label = 'Yoga Clips' } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 100 100"
	xmlns="http://www.w3.org/2000/svg"
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
	class="shrink-0"
	data-testid="app-mark"
>
	<path
		d="M50 15A35 35 0 1 1 15 50"
		fill="none"
		stroke="var(--mark-accent)"
		stroke-width="14"
		stroke-linecap="round"
	/>
	<path
		d="M43 37V63L65 50Z"
		fill="var(--mark-ink)"
		stroke="var(--mark-ink)"
		stroke-width="8"
		stroke-linejoin="round"
	/>
</svg>
