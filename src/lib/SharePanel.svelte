<script>
	// The open playlist: what it is, and how to hand it to a friend — as a
	// link or as a QR code. Its OrbitDB address is behind the connection point
	// (PlaylistAddress.svelte).
	import { _ } from '$lib/i18n/index.js';
	import { activePlaylistStore, playlistDisplayName } from './clips/store.js';
	import { buildAppLink } from './clips/share.js';

	let copied = '';
	/** @type {string} */
	let qrDataUrl = '';
	/** @type {string} */
	let qrFor = '';

	$: link = $activePlaylistStore.address
		? buildAppLink(typeof location === 'undefined' ? '' : location.origin, {
				db: $activePlaylistStore.address
			})
		: '';
	$: if (link && link !== qrFor) void renderQr(link);

	/** @param {string} text */
	async function renderQr(text) {
		qrFor = text;
		try {
			// Lazy: the QR encoder is only needed once a playlist is open, and the
			// consent screen renders before any of this.
			const { toDataURL } = await import('qrcode');
			const url = await toDataURL(text, { margin: 1, width: 192, errorCorrectionLevel: 'M' });
			if (qrFor === text) qrDataUrl = url;
		} catch (error) {
			console.warn('QR code unavailable:', error);
			qrDataUrl = '';
		}
	}

	/** @param {string} what @param {string} text */
	async function copy(what, text) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => (copied = ''), 2000);
		} catch (error) {
			console.warn('Clipboard unavailable:', error);
		}
	}
</script>

{#if $activePlaylistStore.address}
	<section class="card" data-testid="share-panel">
		<div class="px-4 py-3 text-sm">
			<span class="font-semibold text-heading" data-testid="active-playlist-kind"
				>{$activePlaylistStore.kind === 'owner'
					? $_('playlist.kindOwner')
					: $_('playlist.kindGuest')}</span
			>
			{#if $activePlaylistStore.name}
				<span class="text-text"> · {playlistDisplayName($activePlaylistStore.name)}</span>
			{/if}
		</div>
		<div class="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row">
			<div class="min-w-0 flex-1 space-y-3">
				<p class="text-xs text-faint">{$_('share.hint')}</p>
				<div>
					<p class="text-xs text-faint">{$_('share.link')}</p>
					<div class="mt-1 flex items-center gap-2">
						<code class="min-w-0 flex-1 font-mono text-xs break-all" data-testid="share-link"
							>{link}</code
						>
						<button
							type="button"
							on:click={() => copy('link', link)}
							data-testid="share-copy-link"
							class="btn btn-ghost btn-sm shrink-0"
						>
							{copied === 'link' ? $_('share.copied') : $_('share.copy')}
						</button>
					</div>
				</div>
			</div>
			{#if qrDataUrl}
				<img
					src={qrDataUrl}
					alt={$_('share.qrAlt')}
					width="192"
					height="192"
					class="h-48 w-48 shrink-0 self-center rounded-md bg-white p-1"
					data-testid="share-qr"
				/>
			{/if}
		</div>
	</section>
{/if}
