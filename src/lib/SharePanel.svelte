<script>
	// The open playlist: what it is, and how to hand it to a friend — as a
	// link, as a QR code, or as the bare OrbitDB address.
	import { _ } from '$lib/i18n/index.js';
	import { activePlaylistStore } from './clips/store.js';
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
	<details
		class="mt-4 rounded-lg border border-border bg-surface shadow-sm"
		data-testid="share-panel"
	>
		<summary class="cursor-pointer px-4 py-3 text-sm">
			<span class="font-semibold text-heading" data-testid="active-playlist-kind"
				>{$activePlaylistStore.kind === 'owner'
					? $_('playlist.kindOwner')
					: $_('playlist.kindGuest')}</span
			>
			{#if $activePlaylistStore.name}
				<span class="text-text" data-testid="active-playlist-name">
					· {$activePlaylistStore.name}</span
				>
			{/if}
			<span class="ml-2 text-xs text-faint">— {$_('share.heading')}</span>
		</summary>
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
							class="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
						>
							{copied === 'link' ? $_('share.copied') : $_('share.copy')}
						</button>
					</div>
				</div>
				<div>
					<p class="text-xs text-faint">{$_('share.address')}</p>
					<div class="mt-1 flex items-center gap-2">
						<code
							class="min-w-0 flex-1 font-mono text-[11px] break-all"
							data-testid="active-playlist-address">{$activePlaylistStore.address}</code
						>
						<button
							type="button"
							on:click={() => copy('address', $activePlaylistStore.address)}
							data-testid="share-copy-address"
							class="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
						>
							{copied === 'address' ? $_('share.copied') : $_('share.copy')}
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
	</details>
{/if}
