<script>
	/**
	 * The app's sections at the foot of a phone: the base component for the
	 * relaunch's navigation (NiKrause/yoga-clips#1, direction B: Library,
	 * Practise, Share, Me). It brings no texts of its own; the caller hands in
	 * each item's label from the catalogue. Not placed yet: step 4 of the plan
	 * does that.
	 *
	 * @typedef {{ id: string, label: string, href: string, icon?: string }} Item
	 */
	/** @type {{ items: Item[], current?: string, label: string }} */
	let { items, current = '', label } = $props();
</script>

<nav class="bottom-bar" aria-label={label} data-testid="bottom-bar">
	<div class="mx-auto flex w-full max-w-lg">
		{#each items as item (item.id)}
			<a
				class="bottom-bar-item"
				href={item.href}
				aria-current={item.id === current ? 'page' : undefined}
				data-testid="bottom-bar-{item.id}"
			>
				<span class="bottom-bar-icon" aria-hidden="true">{item.icon ?? ''}</span>
				<span>{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
