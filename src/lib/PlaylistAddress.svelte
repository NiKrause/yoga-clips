<script>
	// The open playlist's OrbitDB address, with a copy button. It used to sit in
	// the share panel; it is a technical detail and lives behind the connection
	// point now. Sharing is the link and the QR code.
	import { _ } from '$lib/i18n/index.js';
	import { activePlaylistStore } from './clips/store.js';

	let copied = false;

	async function copy() {
		try {
			await navigator.clipboard.writeText($activePlaylistStore.address);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			console.warn('Clipboard unavailable:', error);
		}
	}
</script>

{#if $activePlaylistStore.address}
	<section>
		<h3 class="text-sm font-semibold text-heading">{$_('connection.addressHeading')}</h3>
		<p class="mt-0.5 text-xs text-faint">{$_('connection.addressHint')}</p>
		<div class="mt-2 flex items-center gap-2">
			<code
				class="min-w-0 flex-1 font-mono text-[11px] break-all"
				data-testid="active-playlist-address">{$activePlaylistStore.address}</code
			>
			<button
				type="button"
				on:click={copy}
				data-testid="share-copy-address"
				class="btn btn-ghost btn-sm shrink-0"
			>
				{copied ? $_('share.copied') : $_('share.copy')}
			</button>
		</div>
	</section>
{/if}
