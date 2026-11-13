<script>
	import { _ } from '$lib/i18n/index.js';

	/** @type {string} */
	export let transport = '';
	/** @type {string} */
	export let peerId = '';

	$: badgeConfig = getBadgeConfig(transport, $_);

	/**
	 * @param {string} transport
	 * @param {(id: string) => string} t
	 */
	function getBadgeConfig(transport, t) {
		switch (transport) {
			case 'webrtc':
				return {
					label: t('network.transport.webrtc'),
					classes: 'bg-identity-200 text-identity-800'
				};
			case 'circuit-relay':
				return {
					label: t('network.transport.relay'),
					classes: 'bg-cyan-200 text-cyan-800'
				};
			case 'websocket':
				return {
					label: t('network.transport.websocket'),
					classes: 'bg-infra-200 text-infra-800'
				};
			case 'webtransport':
				return {
					label: t('network.transport.webtransport'),
					classes: 'bg-infra-200 text-infra-800'
				};
			case 'tcp':
				return {
					label: t('network.transport.tcp'),
					classes: 'bg-data-200 text-data-800'
				};
			default:
				return {
					label: transport,
					classes: 'bg-surface-2 text-heading'
				};
		}
	}
</script>

<span
	class="badge {badgeConfig.classes} rounded-full px-2 py-1 text-xs font-medium"
	data-testid="transport-badge"
	data-peer-id={peerId}
	data-transport={transport}
>
	{badgeConfig.label}
</span>

<style>
	.badge {
		display: inline-block;
		white-space: nowrap;
	}
</style>
