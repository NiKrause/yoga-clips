<script>
	// Write-permission management for the open playlist (simple-todo acl01,
	// unchanged in mechanism). Backed by OrbitDBAccessController: grants and
	// revokes mutate the controller's own replicated keyvalue store, so the
	// playlist's address never changes and peers pick up changes live.
	import { onDestroy } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { playlistDBStore } from './clips/store.js';
	import { ownDidStore } from './p2p-stores.js';

	/** @type {string[]} */
	let writeDids = [];
	let newDid = '';
	let busy = false;
	/** @type {string | null} */
	let errorMessage = null;
	/** @type {any} */
	let currentDb = null;
	/** @type {(() => void) | null} */
	let detachUpdateListener = null;

	const unsubscribe = playlistDBStore.subscribe((db) => {
		if (db === currentDb) return;
		detachUpdateListener?.();
		currentDb = db;
		writeDids = [];
		errorMessage = null;
		if (!db) return;

		void refresh();
		// The controller's backing store replicates like any OrbitDB database —
		// refresh the list whenever it changes (e.g. the owner granted us).
		const accessEvents = db.access?.events;
		if (accessEvents?.on) {
			const onUpdate = () => void refresh();
			accessEvents.on('update', onUpdate);
			detachUpdateListener = () => accessEvents.off?.('update', onUpdate);
		}
	});

	onDestroy(() => {
		unsubscribe();
		detachUpdateListener?.();
	});

	async function refresh() {
		const db = currentDb;
		if (!db?.access?.capabilities) {
			writeDids = [];
			return;
		}
		try {
			const capabilities = await db.access.capabilities();
			writeDids = Array.from(capabilities.write ?? []).sort();
		} catch (error) {
			console.warn('Could not read access capabilities:', error);
		}
	}

	async function grant() {
		const did = newDid.trim();
		if (!did) return;
		busy = true;
		errorMessage = null;
		try {
			await currentDb.access.grant('write', did);
			newDid = '';
			await refresh();
		} catch (error) {
			errorMessage = $_('permissions.grantFailed', {
				values: { reason: error instanceof Error ? error.message : String(error) }
			});
		} finally {
			busy = false;
		}
	}

	/** @param {string} did */
	async function revoke(did) {
		busy = true;
		errorMessage = null;
		try {
			await currentDb.access.revoke('write', did);
			await refresh();
		} catch (error) {
			errorMessage = $_('permissions.revokeFailed', {
				values: { reason: error instanceof Error ? error.message : String(error) }
			});
		} finally {
			busy = false;
		}
	}

	/** @param {string} did */
	function shortDid(did) {
		return did.length > 30 ? `${did.slice(0, 18)}…${did.slice(-8)}` : did;
	}
</script>

{#if currentDb?.access?.grant}
	<details class="card mt-4" data-testid="permissions-panel">
		<summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-heading">
			{$_('permissions.heading')}
			<span class="ml-1 text-xs font-normal text-faint">({writeDids.length})</span>
		</summary>
		<div class="border-t border-border px-4 py-3">
			<p class="text-xs text-faint">{$_('permissions.hint')}</p>

			<ul class="mt-3">
				{#each writeDids as did (did)}
					<li
						class="list-row justify-between !gap-2 !py-1.5 text-xs"
						data-testid="permission-entry"
						data-did={did}
					>
						<code class="truncate rounded bg-surface-2 px-1" title={did}>
							{shortDid(did)}
							{#if did === $ownDidStore}<span class="text-identity">
									{$_('permissions.you')}</span
								>{/if}
						</code>
						<button
							type="button"
							on:click={() => revoke(did)}
							disabled={busy}
							class="rounded border border-danger/40 px-1.5 py-0.5 text-danger hover:bg-danger/10 disabled:opacity-50"
							data-testid="permission-revoke"
						>
							{$_('permissions.remove')}
						</button>
					</li>
				{/each}
			</ul>

			<div class="mt-3 flex gap-2">
				<input
					type="text"
					bind:value={newDid}
					placeholder={$_('permissions.didPlaceholder')}
					data-testid="permission-did-input"
					class="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 font-mono text-xs"
					on:keydown={(event) => event.key === 'Enter' && !busy && grant()}
				/>
				<button
					type="button"
					on:click={grant}
					disabled={busy || !newDid.trim()}
					data-testid="permission-add"
					class="btn btn-primary btn-sm"
				>
					{$_('permissions.add')}
				</button>
			</div>

			{#if errorMessage}
				<p class="mt-2 text-xs text-danger" data-testid="permission-error">{errorMessage}</p>
			{/if}
		</div>
	</details>
{/if}
