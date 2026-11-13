<script>
	/**
	 * One point for everything technical: a dot and a word in the header
	 * ("connected"), and behind it a sheet with what the main view used to
	 * show — the identity, the playlist's address, the status row, network
	 * details, peers and the manual connection (passed in as the default
	 * slot). Nothing is removed, it moves here (NiKrause/yoga-clips#1, step 3).
	 *
	 * Connected means: a live connection to at least one peer (the relay, or
	 * another browser). Before the app has started there is no network yet.
	 */
	import { onDestroy } from 'svelte';
	import { _ } from '$lib/i18n/index.js';

	/** @type {{ isInitializing: boolean, isInitialized: boolean, error: string | null }} */
	export let initialization;
	/** @type {any} */
	export let libp2p = null;

	/** @type {HTMLDialogElement | null} */
	let dialog = null;
	let peers = 0;
	/** @type {any} */
	let observed = null;
	/** @type {(() => void) | null} */
	let stopObserving = null;

	$: if (libp2p !== observed) observe(libp2p);

	/** @param {any} node */
	function observe(node) {
		stopObserving?.();
		stopObserving = null;
		observed = node;
		peers = 0;
		if (!node) return;
		const update = () => {
			const connections = node.getConnections?.() ?? [];
			peers = new Set(
				connections
					.map((/** @type {any} */ connection) => connection.remotePeer?.toString())
					.filter(Boolean)
			).size;
		};
		node.addEventListener('connection:open', update);
		node.addEventListener('connection:close', update);
		stopObserving = () => {
			node.removeEventListener('connection:open', update);
			node.removeEventListener('connection:close', update);
		};
		update();
	}

	onDestroy(() => stopObserving?.());

	/** @type {'starting' | 'connecting' | 'connected' | 'failed'} */
	$: state = initialization?.error
		? 'failed'
		: !initialization?.isInitialized
			? 'starting'
			: peers > 0
				? 'connected'
				: 'connecting';

	const DOT = {
		starting: 'bg-faint',
		connecting: 'bg-accent animate-pulse',
		connected: 'bg-identity',
		failed: 'bg-danger'
	};

	function open() {
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	/** @param {MouseEvent} event */
	function onBackdrop(event) {
		if (event.target === dialog) close();
	}
</script>

<button
	type="button"
	class="btn btn-ghost btn-sm gap-2"
	on:click={open}
	aria-haspopup="dialog"
	data-testid="connection-point"
	data-state={state}
>
	<span class="h-2.5 w-2.5 shrink-0 rounded-full {DOT[state]}" aria-hidden="true"></span>
	<span>{$_(`connection.state.${state}`)}</span>
	{#if state === 'connected'}
		<span class="font-normal text-faint">· {peers}</span>
	{/if}
</button>

<dialog
	bind:this={dialog}
	on:click={onBackdrop}
	class="sheet backdrop:bg-black/70"
	aria-labelledby="connection-sheet-title"
	data-testid="connection-sheet"
>
	<div class="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
		<div class="min-w-0">
			<h2 id="connection-sheet-title" class="text-lg font-semibold text-heading">
				{$_('connection.title')}
			</h2>
			<p class="text-xs text-faint">{$_('connection.hint')}</p>
		</div>
		<button
			type="button"
			on:click={close}
			class="btn btn-ghost btn-sm shrink-0"
			aria-label={$_('connection.close')}
			data-testid="connection-sheet-close">✕</button
		>
	</div>
	<div class="space-y-4 px-4 py-4">
		<slot />
	</div>
</dialog>
