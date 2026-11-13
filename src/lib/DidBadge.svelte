<script>
	// Shows the session's own DID (shortened) with a copy button. Rendered only
	// when the person chose a passkey identity in the onboarding.
	import { _ } from '$lib/i18n/index.js';
	export let did = '';

	let copied = false;

	function shortDid(/** @type {string} */ value) {
		if (value.length <= 24) return value;
		return `${value.slice(0, 14)}…${value.slice(-6)}`;
	}

	async function copyDid() {
		try {
			await navigator.clipboard.writeText(did);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch (error) {
			console.warn('Clipboard unavailable:', error);
		}
	}
</script>

{#if did}
	<div
		class="flex items-center gap-2 rounded-md border border-identity-500/50 bg-identity-500/10 px-2 py-1 text-xs"
		data-testid="own-did-badge"
		title={did}
	>
		<span class="font-semibold text-identity">{$_('identity.passkeyDid')}</span>
		<code class="font-mono" data-testid="own-did-value" data-did={did}>{shortDid(did)}</code>
		<button
			type="button"
			on:click={copyDid}
			class="rounded border border-identity-500/50 px-1.5 py-0.5 hover:bg-identity-500/20"
			data-testid="own-did-copy"
		>
			{copied ? $_('identity.copied') : $_('identity.copy')}
		</button>
	</div>
{/if}
