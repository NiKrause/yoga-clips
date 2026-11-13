<script>
	// A playlist's page (NiKrause/yoga-clips#1, step 4): its name, the way
	// back to the library and to sharing, its clips with the filter, and,
	// quieter at the foot, removing it from your list.
	import { _ } from '$lib/i18n/index.js';
	import { forgetList } from './list-registry.js';
	import { activePlaylistStore, orbitdbStore, playlistDisplayName } from './clips/store.js';

	/** Back to the library. */
	export let onback = () => {};
	/** To the share view. */
	export let onshare = () => {};
	/** @type {(message: string, type?: 'default' | 'success' | 'error' | 'warning') => void} */
	export let notify = () => {};

	async function forget() {
		const address = $activePlaylistStore.address;
		if (!address) return;
		try {
			await forgetList($orbitdbStore, address);
			onback();
		} catch (error) {
			notify(error instanceof Error ? error.message : String(error), 'error');
		}
	}
</script>

<section data-testid="playlist-view">
	<div class="mb-3 flex items-center justify-between gap-3">
		<button
			type="button"
			class="text-sm text-faint hover:text-heading"
			on:click={onback}
			data-testid="playlist-back">‹ {$_('nav.library')}</button
		>
		{#if $activePlaylistStore.address}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				on:click={onshare}
				data-testid="playlist-share">{$_('nav.share')}</button
			>
		{/if}
	</div>
	{#if $activePlaylistStore.address}
		<h2 class="text-2xl font-semibold text-heading" data-testid="active-playlist-name">
			{playlistDisplayName($activePlaylistStore.name) || $_('playlist.unnamed')}
		</h2>
		<p class="text-sm text-faint">
			{$activePlaylistStore.kind === 'owner' ? $_('playlist.kindOwner') : $_('playlist.kindGuest')}
		</p>
		<slot />
		<div class="mt-8 flex justify-center">
			<button
				type="button"
				on:click={forget}
				title={$_('playlist.forgetTitle')}
				data-testid="playlist-switcher-forget"
				data-address={$activePlaylistStore.address}
				class="text-xs text-faint underline hover:text-heading"
			>
				{$_('playlist.forget')}
			</button>
		</div>
	{:else}
		<p class="card p-6 text-center text-sm text-faint" data-testid="playlist-none">
			{$_('playlist.none')}
		</p>
	{/if}
</section>
