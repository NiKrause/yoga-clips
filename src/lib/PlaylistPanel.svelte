<script>
	// Playlists: create one, switch between the ones this identity knows, open
	// one a friend shared. Three panels of simple-todo's acl01 chapter folded
	// into one, on the same registry (list-registry.js) and the same
	// OrbitDBAccessController lists — only the words changed.
	import { _ } from '$lib/i18n/index.js';
	import {
		listRegistryStore,
		listRegistryReadyStore,
		listRegistryNameStore,
		forgetList
	} from './list-registry.js';
	import {
		orbitdbStore,
		playlistAddressStore,
		createPlaylist,
		openPlaylist
	} from './clips/store.js';
	import { parseAppLink } from './clips/share.js';

	/** @type {(message: string, type?: 'default' | 'success' | 'error' | 'warning') => void} */
	export let notify = () => {};

	let name = '';
	let creating = false;
	let address = '';
	let opening = false;
	/** @type {string | null} */
	let busyAddress = null;
	/** @type {string | null} */
	let errorMessage = null;

	async function create() {
		creating = true;
		errorMessage = null;
		try {
			const created = await createPlaylist(name);
			name = '';
			notify($_('playlist.created', { values: { name: created.name } }), 'success');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			creating = false;
		}
	}

	/**
	 * A pasted link to this app is as good as the bare address: people copy
	 * what the share panel shows, and that is a link.
	 * @param {string} text
	 */
	function addressFrom(text) {
		const trimmed = text.trim();
		if (trimmed.startsWith('/orbitdb/')) return trimmed;
		try {
			const url = new URL(trimmed);
			return parseAppLink(url.search).db ?? trimmed;
		} catch {
			return trimmed;
		}
	}

	async function openTyped() {
		opening = true;
		errorMessage = null;
		try {
			await openPlaylist(addressFrom(address));
			address = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			opening = false;
		}
	}

	/** @param {string} target */
	async function openKnown(target) {
		if (target === $playlistAddressStore) return;
		busyAddress = target;
		errorMessage = null;
		try {
			await openPlaylist(target);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			busyAddress = null;
		}
	}

	/** @param {string} target */
	async function forget(target) {
		try {
			await forgetList($orbitdbStore, target);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}
</script>

<section class="card mt-4 p-4" data-testid="playlist-panel">
	<h2 class="text-lg font-semibold text-heading">{$_('playlist.heading')}</h2>

	{#if $listRegistryReadyStore && $listRegistryStore.length}
		<div class="mt-3" data-testid="playlist-switcher" data-registry-name={$listRegistryNameStore}>
			<h3 class="text-sm font-medium text-heading">{$_('playlist.yoursHeading')}</h3>
			<p class="mt-1 text-xs text-faint">{$_('playlist.yoursHint')}</p>
			<ul class="mt-2" data-testid="playlist-switcher-items">
				{#each $listRegistryStore as entry (entry.address)}
					{@const active = entry.address === $playlistAddressStore}
					<li class="list-row !gap-2 !py-1.5">
						<button
							type="button"
							on:click={() => openKnown(entry.address)}
							disabled={busyAddress !== null}
							data-testid="playlist-switcher-open"
							data-address={entry.address}
							data-active={active}
							class="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-left text-xs disabled:opacity-50 {active
								? 'border-identity-500 bg-identity-500/10'
								: 'border-border hover:bg-surface-2'}"
						>
							<span class="font-medium text-heading">{entry.name || $_('playlist.unnamed')}</span>
							<span class="ml-1 text-faint"
								>· {entry.role === 'owner'
									? $_('playlist.roleOwner')
									: $_('playlist.roleGuest')}</span
							>
							{#if active}<span class="ml-1 text-identity">· {$_('playlist.active')}</span>{/if}
							<code class="mt-0.5 block truncate font-mono text-[10px] text-faint"
								>{entry.address}</code
							>
						</button>
						<button
							type="button"
							on:click={() => forget(entry.address)}
							title={$_('playlist.forgetTitle')}
							data-testid="playlist-switcher-forget"
							data-address={entry.address}
							class="btn btn-ghost btn-sm shrink-0"
						>
							{$_('playlist.forget')}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		<div data-testid="new-playlist">
			<h3 class="text-sm font-medium text-heading">{$_('playlist.createHeading')}</h3>
			<p class="mt-1 text-xs text-faint">{$_('playlist.createHint')}</p>
			<div class="mt-2 flex gap-2">
				<input
					type="text"
					bind:value={name}
					placeholder={$_('playlist.namePlaceholder')}
					data-testid="new-playlist-name"
					class="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 text-xs"
					on:keydown={(event) => event.key === 'Enter' && !creating && create()}
				/>
				<button
					type="button"
					on:click={create}
					disabled={creating}
					data-testid="new-playlist-create"
					class="btn btn-primary btn-sm"
				>
					{creating ? $_('playlist.creating') : $_('playlist.create')}
				</button>
			</div>
		</div>

		<div data-testid="open-playlist">
			<h3 class="text-sm font-medium text-heading">{$_('playlist.openByAddressHeading')}</h3>
			<p class="mt-1 text-xs text-faint">{$_('playlist.openByAddressHint')}</p>
			<div class="mt-2 flex gap-2">
				<input
					type="text"
					bind:value={address}
					placeholder={$_('playlist.addressPlaceholder')}
					data-testid="open-playlist-input"
					class="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 font-mono text-xs"
					on:keydown={(event) => event.key === 'Enter' && address.trim() && openTyped()}
				/>
				<button
					type="button"
					on:click={openTyped}
					disabled={opening || !address.trim()}
					data-testid="open-playlist-button"
					class="btn btn-ghost btn-sm"
				>
					{opening ? $_('playlist.opening') : $_('playlist.openButton')}
				</button>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<p class="mt-2 text-xs text-danger" data-testid="playlist-error">{errorMessage}</p>
	{/if}
</section>
