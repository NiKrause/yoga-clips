<script>
	/**
	 * The app's sections at the foot of a phone (NiKrause/yoga-clips#1, step 4,
	 * direction B: Library, Practise, Share, Me). It brings no texts of its own;
	 * the caller hands in each item's label from the catalogue. Every item has
	 * an icon of the same size and weight; the current one sits on the accent.
	 *
	 * @typedef {{ id: string, label: string, href: string, icon?: 'library' | 'practise' | 'share' | 'me' }} Item
	 */
	/** @type {{ items: Item[], current?: string, label: string }} */
	let { items, current = '', label } = $props();

	/** 24 × 24 outlines, stroked with the text colour. */
	const ICONS = {
		library: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z',
		practise: 'M12 4a8 8 0 1 0 8 8M12 8v4l3 2',
		share: 'M8 12h8M14 8l4 4-4 4M6 6v12',
		me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0'
	};
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
				<span class="bottom-bar-icon" aria-hidden="true">
					{#if item.icon && ICONS[item.icon]}
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							fill="none"
							stroke="currentColor"
							stroke-width="1.9"
							stroke-linecap="round"
							stroke-linejoin="round"><path d={ICONS[item.icon]} /></svg
						>
					{/if}
				</span>
				<span>{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
