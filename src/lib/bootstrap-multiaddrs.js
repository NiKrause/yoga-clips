import { multiaddr } from '@multiformats/multiaddr';

/**
 * @param {string} address
 * @returns {string | null}
 */
export function extractPeerIdFromMultiaddr(address) {
	const parts = address.split('/').filter(Boolean);
	const peerIndex = parts.findIndex((part) => part === 'p2p' || part === 'ipfs');
	return peerIndex >= 0 ? parts[peerIndex + 1] || null : null;
}

/**
 * @param {string} address
 * @returns {boolean}
 */
export function isBrowserDialableBootstrapMultiaddr(address) {
	const normalized = address.toLowerCase();
	return (
		normalized.includes('/tls/ws') ||
		normalized.includes('/ws') ||
		normalized.includes('/wss') ||
		normalized.includes('/webrtc-direct')
	);
}

/**
 * @param {string} address
 * @returns {number}
 */
function rankBrowserBootstrapMultiaddr(address) {
	const normalized = address.toLowerCase();
	if (normalized.includes('/tcp/443/') && normalized.includes('/tls/ws')) return 0;
	if (normalized.includes('/tls/ws')) return 1;
	if (normalized.includes('/wss')) return 2;
	if (normalized.includes('/ip4/127.0.0.1/') && normalized.includes('/ws')) return 3;
	if (normalized.includes('/ws')) return 4;
	if (normalized.includes('/webrtc-direct')) return 5;
	return 10;
}

/**
 * Return unique, browser-dialable, parseable peer multiaddresses in preferred order.
 *
 * @param {readonly string[]} addresses
 * @returns {string[]}
 */
export function selectValidBrowserBootstrapMultiaddrs(addresses) {
	return [...new Set(addresses.map((address) => address.trim()).filter(Boolean))]
		.filter(isBrowserDialableBootstrapMultiaddr)
		.filter((address) => {
			try {
				multiaddr(address);
				return extractPeerIdFromMultiaddr(address) != null;
			} catch {
				return false;
			}
		})
		.sort(
			(left, right) => rankBrowserBootstrapMultiaddr(left) - rankBrowserBootstrapMultiaddr(right)
		);
}

/**
 * @param {string | undefined | null} value
 * @returns {string[]}
 */
export function parseBootstrapMultiaddrs(value) {
	return typeof value === 'string'
		? value
				.split(',')
				.map((address) => address.trim())
				.filter(Boolean)
		: [];
}

/** @typedef {'override' | 'aleph' | 'fallback'} BootstrapSource */

/**
 * Every usable source, in precedence order (explicit override, Aleph
 * discovery, then the configured fallback), each with its valid,
 * browser-dialable addresses. Sources that contribute nothing are left out.
 *
 * The build probes these groups in turn, so when the discovered production
 * relay is resolvable but dead, the deploy falls through to the fallback
 * instead of aborting — rather than stopping at the first source that merely
 * *has* addresses.
 *
 * @param {{ override?: string | null, discovered?: readonly string[], fallback?: string | null }} options
 * @returns {Array<{ source: BootstrapSource, addresses: string[] }>}
 */
export function resolveBootstrapCandidates({ override, discovered = [], fallback } = {}) {
	/** @type {Array<[BootstrapSource, string[]]>} */
	const sources = [
		['override', parseBootstrapMultiaddrs(override)],
		['aleph', [...discovered]],
		['fallback', parseBootstrapMultiaddrs(fallback)]
	];

	/** @type {Array<{ source: BootstrapSource, addresses: string[] }>} */
	const candidates = [];
	for (const [source, addresses] of sources) {
		const selected = selectValidBrowserBootstrapMultiaddrs(addresses);
		if (selected.length > 0) candidates.push({ source, addresses: selected });
	}
	return candidates;
}

/**
 * Resolve build-time addresses using explicit override, discovery, then
 * fallback precedence. The first usable source wins; reachability is not
 * considered here (the build probes separately — see
 * {@link resolveBootstrapCandidates}).
 *
 * @param {{ override?: string | null, discovered?: readonly string[], fallback?: string | null }} options
 * @returns {{ addresses: string[], source: BootstrapSource | 'none' }}
 */
export function resolveBootstrapMultiaddrs(options = {}) {
	const [first] = resolveBootstrapCandidates(options);
	return first
		? { addresses: first.addresses, source: first.source }
		: { addresses: [], source: 'none' };
}

/**
 * @param {string} address
 * @returns {string}
 */
export function describeBootstrapMultiaddr(address) {
	const peerId = extractPeerIdFromMultiaddr(address);
	const host = address.match(/\/(?:dns4|dns6|ip4|ip6)\/([^/]+)/)?.[1] ?? 'relay';
	const transport = address.includes('/webrtc-direct') ? 'WebRTC Direct' : 'WebSocket';
	const shortPeerId = peerId ? `${peerId.slice(0, 8)}…${peerId.slice(-6)}` : 'unknown peer';
	return `${host} · ${transport} · ${shortPeerId}`;
}
