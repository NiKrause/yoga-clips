<script>
	import { onDestroy } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { relayHttpStatusStore } from './relay-status.js';
	import { relayHttpOriginForPeer } from './multiaddr-utils.js';
	import { getRelayBootstrapAddrs } from './relay-bootstrap-addrs.js';

	/** @typedef {'pending' | 'active' | 'complete' | 'error'} StepStatus */
	/** @typedef {{ key?: string, label: string, description: string, status: StepStatus }} StatusStep */

	/** @type {{ isInitializing: boolean, isInitialized: boolean, error: string | null, steps: StatusStep[] }} */
	export let initialization;
	/** @type {any} */
	export let libp2p = null;
	/** @type {string | null} */
	export let peerId = null;

	/** @type {any} */
	let observedLibp2p = null;
	let relayConnected = false;
	let webRTCConnected = false;
	let connectedPeerCount = 0;
	let relayHealthKey = '';
	let relayHealthOrigin = '';
	let relayVersion = '';
	/** @type {'idle' | 'loading' | 'verified' | 'unavailable'} */
	let relayHealthStatus = 'idle';
	/** @type {AbortController | null} */
	let relayHealthController = null;
	/** @type {StatusStep[]} */
	let connectivitySteps = [];
	/** @type {StatusStep[]} */
	let allSteps = [];
	/** @type {StatusStep | undefined} */
	let currentStep;
	/** @type {StatusStep | null} */
	let tooltipStep = null;
	/** @type {Array<{ event: string, handler: () => void }>} */
	let connectionListeners = [];
	const configuredRelayHttpOrigin = String(import.meta.env.VITE_RELAY_HTTP_ORIGIN || '').replace(
		/\/$/,
		''
	);

	$: initializationComplete = initialization?.isInitialized === true;
	$: connectivitySteps = [
		{
			key: 'network.step.relay',
			label: $_('network.step.relay.label'),
			description: getRelayDescription($_),
			status: relayConnected ? 'complete' : initializationComplete ? 'active' : 'pending'
		},
		{
			key: 'network.step.webrtc',
			label: $_('network.step.webrtc.label'),
			description: $_('network.step.webrtc.description'),
			status: webRTCConnected
				? 'complete'
				: initializationComplete && relayConnected
					? 'active'
					: 'pending'
		}
	];
	// The initialization steps carry an i18n key; their English label and
	// description stay in the store for anything else that reads it.
	$: initializationSteps = (initialization?.steps ?? []).map((step) =>
		step.key
			? {
					...step,
					label: $_(`${step.key}.label`),
					description: $_(`${step.key}.description`)
				}
			: step
	);
	$: allSteps = [...initializationSteps, ...connectivitySteps];
	$: allComplete = allSteps.length > 0 && allSteps.every((step) => step.status === 'complete');
	$: currentStep =
		allSteps.find((step) => step.status === 'active') ??
		allSteps.find((step) => step.status === 'pending') ??
		allSteps.find((step) => step.status === 'error');
	$: statusLabel = getStatusLabel(allComplete, currentStep, $_);

	$: if (libp2p !== observedLibp2p) {
		observeConnections(libp2p);
	}

	/** @param {any} node */
	function observeConnections(node) {
		removeConnectionListeners();
		resetRelayHealth();
		observedLibp2p = node;
		relayConnected = false;
		webRTCConnected = false;
		connectedPeerCount = 0;

		if (!node) return;

		const update = () => updateConnectionState(node);
		for (const event of ['connection:open', 'connection:close']) {
			node.addEventListener(event, update);
			connectionListeners.push({ event, handler: update });
		}
		update();
	}

	/** @param {any} node */
	function updateConnectionState(node) {
		const connections = node.getConnections?.() ?? [];
		const addresses = connections
			.map((/** @type {any} */ connection) => connection.remoteAddr?.toString().toLowerCase())
			.filter(Boolean);
		connectedPeerCount = new Set(
			connections
				.map((/** @type {any} */ connection) => connection.remotePeer?.toString())
				.filter(Boolean)
		).size;

		const relayConnection = connections.find((/** @type {any} */ connection) => {
			const address = connection.remoteAddr?.toString().toLowerCase() ?? '';
			return (
				(address.includes('/ws') || address.includes('/wss')) && !address.includes('/p2p-circuit')
			);
		});
		relayConnected = Boolean(relayConnection);
		updateRelayHealth(relayConnection);
		webRTCConnected = addresses.some((/** @type {string} */ address) =>
			address.includes('/webrtc')
		);
	}

	/** @param {any} connection */
	function updateRelayHealth(connection) {
		if (!connection) {
			resetRelayHealth();
			return;
		}

		const address = connection.remoteAddr?.toString() ?? '';
		if (configuredRelayHttpOrigin) {
			startRelayHealthCheck(configuredRelayHttpOrigin, connection);
			return;
		}
		const origin = relayHttpOriginForPeer(
			connection.remotePeer?.toString() ?? '',
			getRelayBootstrapAddrs(),
			address
		);
		if (!origin) {
			if (relayHealthKey !== address) {
				resetRelayHealth();
				relayHealthKey = address;
			}
			return;
		}

		startRelayHealthCheck(origin, connection);
	}

	/** @param {string} origin @param {any} connection */
	function startRelayHealthCheck(origin, connection) {
		const peerId = connection.remotePeer?.toString() ?? '';
		const key = `${origin}|${peerId}`;
		if (key === relayHealthKey) return;

		resetRelayHealth();
		relayHealthKey = key;
		relayHealthOrigin = origin;
		relayHttpStatusStore.set({ origin, peerId });
		relayHealthStatus = 'loading';
		relayHealthController = new AbortController();
		void fetchRelayHealth(origin, peerId, relayHealthController, key);
	}

	/** @param {string} origin @param {string} peerId @param {AbortController} controller @param {string} key */
	async function fetchRelayHealth(origin, peerId, controller, key) {
		let didTimeout = false;
		const timeout = setTimeout(() => {
			didTimeout = true;
			controller.abort();
		}, 5000);
		try {
			const response = await fetch(`${origin}/health`, { signal: controller.signal });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const health = await response.json();
			if (peerId && health.peerId !== peerId) throw new Error('Relay peer ID does not match');
			if (relayHealthKey !== key) return;
			relayVersion = getHealthVersion(health);
			relayHealthStatus = 'verified';
		} catch {
			if (relayHealthKey === key && (didTimeout || !controller.signal.aborted))
				relayHealthStatus = 'unavailable';
		} finally {
			clearTimeout(timeout);
		}
	}

	/** @param {any} health */
	function getHealthVersion(health) {
		return String(
			health?.orbitdbRelayVersion ??
				health?.relayVersion ??
				health?.version ??
				health?.packageVersion ??
				health?.package?.version ??
				''
		);
	}

	/** @param {(id: string, options?: any) => string} t */
	function getRelayDescription(t) {
		const base = t('network.step.relay.description');
		const origin = relayHealthOrigin;
		if (!relayConnected) return `${base} ${t('network.step.relay.notConnected')}`;
		if (!relayHealthOrigin) return `${base} ${t('network.step.relay.noHealthUrl')}`;
		if (relayHealthStatus === 'loading')
			return `${base} ${t('network.step.relay.loading', { values: { origin } })}`;
		if (relayHealthStatus === 'verified' && relayVersion)
			return `${base} ${t('network.step.relay.verifiedVersion', {
				values: { origin, version: relayVersion }
			})}`;
		if (relayHealthStatus === 'verified')
			return `${base} ${t('network.step.relay.verified', { values: { origin } })}`;
		return `${base} ${t('network.step.relay.unverified', { values: { origin } })}`;
	}

	function resetRelayHealth() {
		relayHealthController?.abort();
		relayHealthController = null;
		relayHealthKey = '';
		relayHealthOrigin = '';
		relayVersion = '';
		relayHealthStatus = 'idle';
		relayHttpStatusStore.set({ origin: '', peerId: '' });
	}

	function removeConnectionListeners() {
		if (observedLibp2p) {
			for (const { event, handler } of connectionListeners) {
				observedLibp2p.removeEventListener(event, handler);
			}
		}
		connectionListeners = [];
	}

	/**
	 * @param {boolean} complete
	 * @param {StatusStep | undefined} step
	 * @param {(id: string, options?: any) => string} t
	 */
	function getStatusLabel(complete, step, t) {
		if (complete) return t('network.status.ready');
		if (step?.key === 'network.step.relay') return t('network.status.connectingRelay');
		if (step?.key === 'network.step.webrtc') return t('network.status.waitingWebrtc');
		if (step?.status === 'error')
			return t('network.status.failed', { values: { step: step.label } });
		if (step) return t('network.status.initializing', { values: { step: step.label } });
		return t('network.status.preparing');
	}

	onDestroy(() => {
		removeConnectionListeners();
		resetRelayHealth();
	});
</script>

<nav
	class="card mb-6 px-4 py-3"
	aria-label={$_('network.status.navLabel')}
	data-testid="p2p-status-nav"
>
	<div class="mb-2 flex items-center gap-2 text-sm font-medium text-text" aria-live="polite">
		{#if !allComplete}
			<span
				class="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-blue-600"
				aria-hidden="true"
				data-testid="p2p-status-spinner"
			></span>
		{/if}
		<span>{statusLabel}</span>
	</div>

	<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
		{#each allSteps as step (step.label)}
			<div
				class="flex cursor-help items-center gap-2 text-xs whitespace-nowrap text-faint outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
				aria-label={`${step.label}: ${step.description}`}
				data-testid="p2p-status-step"
				data-status={step.status}
				role="button"
				tabindex="0"
				on:mouseenter={() => (tooltipStep = step)}
				on:mouseleave={() => (tooltipStep = null)}
				on:focus={() => (tooltipStep = step)}
				on:blur={() => (tooltipStep = null)}
			>
				<span
					class:animate-pulse={step.status === 'active'}
					class:bg-cyan-500={step.status === 'active'}
					class:bg-identity-500={step.status === 'complete'}
					class:bg-danger-500={step.status === 'error'}
					class:bg-surface-2={step.status === 'pending'}
					class="h-2 w-2 rounded-full shadow-sm"
					aria-hidden="true"
				></span>
				<span class:text-text={step.status === 'active'}>{step.label}</span>
			</div>
		{/each}
	</div>

	{#if tooltipStep}
		<div
			class="mt-3 rounded-md border border-border bg-code px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
			role="tooltip"
			data-testid="p2p-status-tooltip"
		>
			<span class="font-semibold">{tooltipStep.label}:</span>
			{tooltipStep.description}
		</div>
	{/if}

	{#if $$slots.default}
		<details class="group mt-3 border-t border-border pt-2" data-testid="network-details">
			<summary
				class="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-1 text-xs font-medium text-text outline-none hover:text-heading focus-visible:ring-2 focus-visible:ring-cyan-500 [&::-webkit-details-marker]:hidden"
			>
				<svg
					class="h-3.5 w-3.5 transition-transform group-open:rotate-90"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M7.2 4.7a1 1 0 011.4 0l4.6 4.6a1 1 0 010 1.4l-4.6 4.6a1 1 0 11-1.4-1.4l3.9-3.9-3.9-3.9a1 1 0 010-1.4z"
						clip-rule="evenodd"
					/>
				</svg>
				<span>{$_('network.status.details')}</span>
				<span class="font-normal text-faint"
					>· {$_('network.status.peerCount', { values: { count: connectedPeerCount } })}</span
				>
				{#if peerId}
					<code class="hidden font-mono font-normal text-faint sm:inline"
						>· {peerId.slice(0, 8)}…{peerId.slice(-6)}</code
					>
				{/if}
			</summary>
			<div class="mt-3 grid min-w-0 gap-3 border-t border-border pt-3 lg:grid-cols-3 [&>*]:min-w-0">
				<slot />
			</div>
		</details>
	{/if}

	<slot name="shared-list" />
</nav>
