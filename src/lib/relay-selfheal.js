import {
	extractPeerIdFromMultiaddr,
	selectValidBrowserBootstrapMultiaddrs
} from './bootstrap-multiaddrs.js';

/**
 * Keep a relay reachable at runtime, not only at build time.
 *
 * Every deployed build carries the relay addresses baked into it
 * (`VITE_RELAY_BOOTSTRAP_ADDR_PROD`). Those relays can be retired after the
 * build, and the automatic bootstrap has no way back: it dials the baked list
 * and nothing else. So a visitor on an old bundle, whose baked relay is gone,
 * never forms a circuit — even while other production relays are live and
 * listed on the Aleph channel.
 *
 * This closes that gap. When the baked relays have not connected within a
 * grace period, it discovers the current production relay set the same way the
 * "refresh relays" button does, and dials one. It is best-effort and additive:
 * it never throws into startup, and it does nothing while a relay is already
 * connected.
 */

/**
 * @typedef {{ healed: boolean, address?: string, reason: string }} HealOutcome
 */

/**
 * @param {{
 *   hasRelayConnection: () => boolean,
 *   discover: () => Promise<string[]>,
 *   dial: (address: string) => Promise<unknown>,
 *   wait: (ms: number) => Promise<void>,
 *   log?: (message: string) => void,
 *   graceMs?: number,
 *   pollMs?: number,
 *   maxDials?: number
 * }} deps
 * @returns {Promise<HealOutcome>}
 */
export async function healRelayConnection({
	hasRelayConnection,
	discover,
	dial,
	wait,
	log = () => {},
	graceMs = 20_000,
	pollMs = 2_000,
	maxDials = 4
}) {
	// Give the baked relays their chance first.
	for (let waited = 0; waited < graceMs; waited += pollMs) {
		if (hasRelayConnection()) return { healed: false, reason: 'connected' };
		await wait(pollMs);
	}
	if (hasRelayConnection()) return { healed: false, reason: 'connected' };

	/** @type {string[]} */
	let addresses;
	try {
		addresses = await discover();
	} catch (error) {
		log(`relay self-heal: discovery failed: ${error instanceof Error ? error.message : error}`);
		return { healed: false, reason: 'discover-failed' };
	}
	if (addresses.length === 0) return { healed: false, reason: 'none-discovered' };

	log(`relay self-heal: no baked relay connected; trying ${addresses.length} discovered relay(s).`);
	for (const address of addresses.slice(0, maxDials)) {
		// A baked relay may have come up late while we were discovering.
		if (hasRelayConnection()) return { healed: false, reason: 'connected' };
		try {
			await dial(address);
			log(`relay self-heal: connected to ${address}`);
			return { healed: true, address, reason: 'healed' };
		} catch (error) {
			log(`relay self-heal: ${address} failed: ${error instanceof Error ? error.message : error}`);
		}
	}
	return { healed: false, reason: 'all-dials-failed' };
}

/**
 * Valid, browser-dialable relays from a freshly discovered set, minus the ones
 * we already bake (those were tried first and are, by assumption, dead). A
 * relay already baked is dropped by its peer id, so a different transport form
 * of the same dead relay is not retried.
 *
 * @param {readonly string[]} bakedAddresses what the build baked in
 * @param {readonly string[]} discovered what discovery returned now
 * @returns {string[]}
 */
export function freshRelaysFrom(bakedAddresses, discovered) {
	const bakedPeerIds = new Set(
		[...bakedAddresses].map((address) => extractPeerIdFromMultiaddr(address)).filter(Boolean)
	);
	return selectValidBrowserBootstrapMultiaddrs([...discovered]).filter(
		(address) => !bakedPeerIds.has(extractPeerIdFromMultiaddr(address))
	);
}
