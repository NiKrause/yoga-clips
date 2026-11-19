<script>
	// A clip into another playlist (NiKrause/yoga-clips#12): which one, and
	// whether as a copy or a move. Offered are the playlists this identity can
	// write to — each is asked (`check`), none is assumed from "mine" — and
	// never the playlist the clip is in. What goes wrong is said here, in the
	// dialog: a toast would lie under it.
	import { _ } from '$lib/i18n/index.js';
	import { playlistDisplayName } from './clips/names.js';

	/** @typedef {import('./clips/schema.js').Clip} Clip */
	/** @typedef {{ address: string, name: string }} Entry */

	/**
	 * The clip to move or copy; null closes the dialog.
	 * @type {Clip | null}
	 */
	export let clip = null;
	/** The playlist the clip is in. */
	export let sourceAddress = '';
	/**
	 * Every playlist this identity knows, its own and other people's.
	 * @type {Entry[]}
	 */
	export let entries = [];
	/** Whether this identity may take the clip out of its playlist. */
	export let canMove = false;
	/**
	 * May this identity write to that playlist?
	 * @type {(address: string) => Promise<boolean>}
	 */
	export let check = async () => false;
	/**
	 * Do it. Resolves to nothing when it is done, or to what went wrong, in
	 * words to show.
	 * @type {(address: string, mode: 'copy' | 'move') => Promise<string | void>}
	 */
	export let onchoose = async () => {};
	export let onclose = () => {};

	/** @type {HTMLDialogElement | null} */
	let dialog = null;
	/** @type {Entry[]} */
	let targets = [];
	let checking = false;
	let chosen = '';
	let busy = false;
	let problem = '';
	/** Which opening the answers belong to: a late one is not this clip's. */
	let round = 0;

	$: if (dialog) {
		if (clip) void open();
		else if (dialog.open) dialog.close();
	}

	async function open() {
		const mine = ++round;
		targets = [];
		chosen = '';
		busy = false;
		problem = '';
		const candidates = entries.filter((entry) => entry.address && entry.address !== sourceAddress);
		/** @type {Entry[]} */
		const writable = [];
		checking = candidates.length > 0;
		if (dialog && !dialog.open) dialog.showModal();
		await Promise.all(
			candidates.map(async (entry) => {
				const yes = await check(entry.address).catch(() => false);
				if (mine !== round || !yes) return;
				writable.push(entry);
				// In the library's order, whichever answer came first.
				targets = candidates.filter((candidate) => writable.includes(candidate));
			})
		);
		if (mine !== round) return;
		checking = false;
		if (!chosen && targets.length === 1) chosen = targets[0].address;
	}

	/** @param {'copy' | 'move'} mode */
	async function choose(mode) {
		if (!chosen || busy) return;
		busy = true;
		problem = '';
		try {
			problem = (await onchoose(chosen, mode)) ?? '';
		} catch (error) {
			problem = error instanceof Error ? error.message : String(error);
		} finally {
			busy = false;
		}
	}

	function closed() {
		round++;
		onclose();
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet backdrop:bg-black/70 sm:!w-[min(96vw,28rem)]"
	aria-labelledby="move-copy-heading"
	data-testid="move-copy-dialog"
	on:close={closed}
	on:cancel={(event) => busy && event.preventDefault()}
	on:click={(event) => event.target === dialog && !busy && dialog?.close()}
>
	<div class="p-5">
		<h2 id="move-copy-heading" class="text-lg font-semibold text-heading">
			{$_('relocate.heading')}
		</h2>
		<p class="truncate text-sm text-faint" data-testid="move-copy-clip">{clip?.title ?? ''}</p>

		{#if targets.length}
			<fieldset class="mt-4" disabled={busy}>
				<legend class="section-label">{$_('relocate.target')}</legend>
				<ul>
					{#each targets as entry (entry.address)}
						<li class="list-row !py-0">
							<label class="flex min-h-11 w-full cursor-pointer items-center gap-3">
								<input
									type="radio"
									name="move-copy-target"
									value={entry.address}
									bind:group={chosen}
									class="h-4 w-4 shrink-0"
									data-testid="move-copy-target"
									data-address={entry.address}
								/>
								<span class="min-w-0 flex-1 truncate text-heading"
									>{playlistDisplayName(entry.name) || $_('playlist.unnamed')}</span
								>
							</label>
						</li>
					{/each}
				</ul>
			</fieldset>
		{/if}

		{#if checking}
			<p class="mt-3 text-sm text-faint" role="status" data-testid="move-copy-checking">
				{$_('relocate.checking')}
			</p>
		{:else if !targets.length}
			<p class="mt-4 text-sm text-text" data-testid="move-copy-none">{$_('relocate.none')}</p>
		{:else if !canMove}
			<p class="mt-3 text-sm text-faint" data-testid="move-copy-no-move">
				{$_('relocate.moveNotAllowed')}
			</p>
		{/if}

		{#if problem}
			<p class="mt-3 text-sm text-danger" role="alert" data-testid="move-copy-problem">
				{problem}
			</p>
		{:else if busy}
			<p class="mt-3 text-sm text-faint" role="status" data-testid="move-copy-working">
				{$_('relocate.working')}
			</p>
		{/if}

		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button
				type="button"
				class="btn btn-ghost"
				disabled={busy}
				on:click={() => dialog?.close()}
				data-testid="move-copy-cancel">{$_('relocate.cancel')}</button
			>
			{#if targets.length}
				{#if canMove}
					<button
						type="button"
						class="btn btn-ghost"
						disabled={!chosen || busy}
						on:click={() => choose('move')}
						data-testid="move-copy-move">{$_('relocate.move')}</button
					>
				{/if}
				<button
					type="button"
					class="btn btn-primary"
					disabled={!chosen || busy}
					on:click={() => choose('copy')}
					data-testid="move-copy-copy">{$_('relocate.copy')}</button
				>
			{/if}
		</div>
	</div>
</dialog>
