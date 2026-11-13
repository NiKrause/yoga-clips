<script>
	// The library (NiKrause/yoga-clips#1, step 4, direction B): "continue" with
	// the clip played last, your playlists as tiles, the ones shared with you
	// as rows, a new playlist, and opening one a friend shared. The registry
	// (list-registry.js) and the access lists are simple-todo's acl01, as
	// before; only the shape changed.
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration, parseClipUrl } from './clips/schema.js';
	import { summariesStore } from './clips/summaries.js';
	import { thumbnailFor } from './clips/thumbnails.js';
	import ClipFrame from './ClipFrame.svelte';
	import { listRegistryStore, listRegistryNameStore } from './list-registry.js';
	import {
		playlistDisplayName,
		playlistAddressStore,
		createPlaylist,
		openPlaylist
	} from './clips/store.js';
	import { parseAppLink } from './clips/share.js';

	/** @type {(message: string, type?: 'default' | 'success' | 'error' | 'warning') => void} */
	export let notify = () => {};
	/** Show the open playlist's page. */
	export let onopened = () => {};
	/**
	 * The clip played last, when it is in the open playlist: "continue".
	 * @type {import('./clips/schema.js').Clip | null}
	 */
	export let continueClip = null;
	export let continueDoneToday = false;
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let ondone = () => {};

	// "Continue" loads the player only on a press, as everywhere: before it,
	// nothing is asked of the video service but the thumbnail.
	let continuePlaying = false;
	/** @type {string | null} */
	let continueThumb = null;
	$: continueParsed = continueClip ? parseClipUrl(continueClip.url) : null;
	$: continueClipId = continueClip?.id ?? '';
	$: loadContinueThumb(continueClipId);

	/** @param {string} id */
	function loadContinueThumb(id) {
		continuePlaying = false;
		continueThumb = null;
		const clip = continueClip;
		if (!clip) return;
		void thumbnailFor(clip).then((url) => {
			if (continueClip?.id === id) continueThumb = url;
		});
	}

	$: owned = $listRegistryStore.filter((entry) => entry.role === 'owner');
	$: shared = $listRegistryStore.filter((entry) => entry.role !== 'owner');
	$: activeName =
		$listRegistryStore.find((entry) => entry.address === $playlistAddressStore)?.name ?? '';

	/**
	 * @param {string} address
	 * @param {Record<string, import('./clips/summaries.js').Summary>} all
	 */
	function summaryLine(address, all) {
		const summary = all[address];
		if (!summary) return '';
		return $_('library.summary', {
			values: { clips: summary.clips, minutes: Math.round(summary.seconds / 60) }
		});
	}

	const TILES = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4'];

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
			onopened();
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
			onopened();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			opening = false;
		}
	}

	/** @param {string} target */
	async function openKnown(target) {
		if (target === $playlistAddressStore) return onopened();
		busyAddress = target;
		errorMessage = null;
		try {
			await openPlaylist(target);
			onopened();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			busyAddress = null;
		}
	}
</script>

<section data-testid="playlist-panel">
	{#if continueClip}
		<div class="mb-6 max-w-2xl" data-testid="library-continue">
			<h2 class="section-label">{$_('library.continue')}</h2>
			<div class="card overflow-hidden">
				{#if continuePlaying && continueParsed?.embedUrl}
					<div class="aspect-video w-full bg-black">
						<ClipFrame parsed={continueParsed} title={continueClip.title} />
					</div>
				{:else}
					<button
						type="button"
						class="group relative block aspect-video w-full bg-tile-2"
						on:click={() => (continueParsed?.embedUrl ? (continuePlaying = true) : onopened())}
						aria-label={$_('clip.play')}
						data-testid="library-continue-play"
					>
						{#if continueThumb}
							<img
								src={continueThumb}
								alt=""
								referrerpolicy="no-referrer"
								class="h-full w-full object-cover"
							/>
						{/if}
						<span class="absolute top-2 left-2 rounded bg-bg px-2 py-0.5 text-[11px] text-heading"
							>{$_(`source.${continueClip.source}`)}</span
						>
						<span
							class="absolute top-1/2 left-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent pl-1 text-2xl text-accent-ink transition group-hover:scale-105"
							aria-hidden="true">▶</span
						>
						<span
							class="absolute right-2 bottom-2 rounded bg-bg px-1.5 py-0.5 font-mono text-xs text-heading"
							>{formatDuration(continueClip.durationSec)}</span
						>
					</button>
				{/if}
				<div class="flex flex-wrap items-center gap-3 p-4">
					<div class="min-w-0 flex-1">
						<p class="font-semibold text-heading">{continueClip.title}</p>
						<p class="text-sm text-faint">
							{[
								continueClip.teacher,
								activeName
									? $_('library.from', { values: { name: playlistDisplayName(activeName) } })
									: ''
							]
								.filter(Boolean)
								.join(' · ')}
						</p>
					</div>
					{#if continuePlaying}
						{#if continueDoneToday}
							<span class="text-sm font-medium text-identity">✓ {$_('clip.doneToday')}</span>
						{:else}
							<button
								type="button"
								class="btn btn-primary btn-sm"
								on:click={() => continueClip && ondone(continueClip)}>✓ {$_('clip.done')}</button
							>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<h2 class="section-label">{$_('library.yours')}</h2>
	<div
		class="grid grid-cols-2 gap-3 sm:grid-cols-3"
		data-testid="playlist-switcher"
		data-registry-name={$listRegistryNameStore}
	>
		{#each owned as entry, index (entry.address)}
			{@const active = entry.address === $playlistAddressStore}
			{@const line = summaryLine(entry.address, $summariesStore)}
			<button
				type="button"
				on:click={() => openKnown(entry.address)}
				disabled={busyAddress !== null}
				data-testid="playlist-switcher-open"
				data-address={entry.address}
				data-active={active}
				class="flex min-h-28 flex-col justify-end rounded-2xl p-3 text-left text-heading transition disabled:opacity-50 {TILES[
					index % TILES.length
				]} {active ? 'ring-2 ring-heading ring-offset-2 ring-offset-bg' : ''}"
			>
				<span class="font-semibold"
					>{playlistDisplayName(entry.name) || $_('playlist.unnamed')}</span
				>
				{#if line}<span class="text-xs opacity-80">{line}</span>{/if}
			</button>
		{/each}
		<div
			class="col-span-2 flex flex-col justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border p-3 sm:col-span-1"
			data-testid="new-playlist"
		>
			<label class="text-sm font-medium text-heading" for="new-playlist-name"
				>{$_('playlist.createHeading')}</label
			>
			<input
				id="new-playlist-name"
				type="text"
				bind:value={name}
				placeholder={$_('playlist.namePlaceholder')}
				data-testid="new-playlist-name"
				class="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
	{#if !owned.length}
		<p class="mt-2 text-xs text-faint">{$_('playlist.createHint')}</p>
	{/if}

	<h2 class="section-label mt-6">{$_('library.shared')}</h2>
	{#if shared.length}
		<ul data-testid="playlist-switcher-items">
			{#each shared as entry (entry.address)}
				{@const active = entry.address === $playlistAddressStore}
				{@const line = summaryLine(entry.address, $summariesStore)}
				<li class="list-row">
					<button
						type="button"
						on:click={() => openKnown(entry.address)}
						disabled={busyAddress !== null}
						data-testid="playlist-switcher-open"
						data-address={entry.address}
						data-active={active}
						class="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"
					>
						<span class="h-11 w-11 shrink-0 rounded-[10px] bg-tile-4" aria-hidden="true"></span>
						<span class="min-w-0">
							<span class="block truncate font-medium text-heading"
								>{playlistDisplayName(entry.name) || $_('playlist.unnamed')}</span
							>
							<span class="block text-xs text-faint"
								>{[line, active ? $_('playlist.active') : ''].filter(Boolean).join(' · ')}</span
							>
						</span>
					</button>
					<span class="text-xs text-faint">{$_('playlist.roleGuest')}</span>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="mt-2" data-testid="open-playlist">
		<p class="text-xs text-faint">{$_('playlist.openByAddressHint')}</p>
		<div class="mt-2 flex gap-2">
			<input
				type="text"
				bind:value={address}
				placeholder={$_('playlist.addressPlaceholder')}
				aria-label={$_('playlist.openByAddressHeading')}
				data-testid="open-playlist-input"
				class="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
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

	{#if errorMessage}
		<p class="mt-2 text-xs text-danger" data-testid="playlist-error">{errorMessage}</p>
	{/if}
</section>
