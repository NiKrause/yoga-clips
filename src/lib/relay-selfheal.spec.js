import { describe, expect, it, vi } from 'vitest';
import { freshRelaysFrom, healRelayConnection } from './relay-selfheal.js';

const peerA = '12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE';
const peerB = '12D3KooWSc3Sqr3Q7RGJAFBz5i7WTTC5kzunnm2tvXVcSwTEtUTP';
const peerC = '12D3KooWLaah6yFW7ohFEZgsDNpH86xtmpztvamgyoLvLMtNyfpR';
const baked = `/dns4/dead.example/tcp/443/tls/ws/p2p/${peerA}`;
const liveB = `/dns4/live-b.example/tcp/443/tls/ws/p2p/${peerB}`;
const liveC = `/dns4/live-c.example/tcp/443/tls/ws/p2p/${peerC}`;

const noWait = () => Promise.resolve();

describe('freshRelaysFrom', () => {
	it('keeps valid relays we do not already bake, dropping the baked one by peer id', () => {
		// A second transport form of the baked (dead) relay is dropped too.
		const bakedOtherForm = `/ip4/203.0.113.9/tcp/9/ws/p2p/${peerA}`;
		expect(freshRelaysFrom([baked], [bakedOtherForm, liveB, liveC, '/not/a/multiaddr'])).toEqual([
			liveB,
			liveC
		]);
	});

	it('returns nothing when discovery only offers relays we already bake', () => {
		expect(freshRelaysFrom([baked], [baked])).toEqual([]);
	});
});

describe('healRelayConnection', () => {
	it('does nothing while a baked relay is connected', async () => {
		const dial = vi.fn();
		const discover = vi.fn();
		const outcome = await healRelayConnection({
			hasRelayConnection: () => true,
			discover,
			dial,
			wait: noWait,
			graceMs: 10,
			pollMs: 2
		});
		expect(outcome).toEqual({ healed: false, reason: 'connected' });
		expect(discover).not.toHaveBeenCalled();
		expect(dial).not.toHaveBeenCalled();
	});

	it('returns as soon as a baked relay connects within the grace period', async () => {
		let connected = false;
		setTimeout(() => (connected = true), 0);
		let polls = 0;
		const outcome = await healRelayConnection({
			hasRelayConnection: () => connected,
			discover: vi.fn(),
			dial: vi.fn(),
			wait: () => {
				polls++;
				return new Promise((resolve) => setTimeout(resolve, 0));
			},
			graceMs: 100,
			pollMs: 10
		});
		expect(outcome.reason).toBe('connected');
		expect(polls).toBeGreaterThan(0);
	});

	it('discovers and dials a fresh relay when no baked relay connects', async () => {
		const dial = vi.fn().mockResolvedValue(undefined);
		const outcome = await healRelayConnection({
			hasRelayConnection: () => false,
			discover: async () => [liveB, liveC],
			dial,
			wait: noWait,
			graceMs: 4,
			pollMs: 2
		});
		expect(outcome).toEqual({ healed: true, address: liveB, reason: 'healed' });
		expect(dial).toHaveBeenCalledTimes(1);
		expect(dial).toHaveBeenCalledWith(liveB);
	});

	it('tries the next relay when a dial fails, up to the cap', async () => {
		const dial = vi
			.fn()
			.mockRejectedValueOnce(new Error('refused'))
			.mockResolvedValueOnce(undefined);
		const outcome = await healRelayConnection({
			hasRelayConnection: () => false,
			discover: async () => [liveB, liveC],
			dial,
			wait: noWait,
			graceMs: 4,
			pollMs: 2,
			maxDials: 4
		});
		expect(outcome).toEqual({ healed: true, address: liveC, reason: 'healed' });
		expect(dial).toHaveBeenCalledTimes(2);
	});

	it('reports when every dial fails, and when nothing was discovered', async () => {
		const allFail = await healRelayConnection({
			hasRelayConnection: () => false,
			discover: async () => [liveB],
			dial: async () => {
				throw new Error('refused');
			},
			wait: noWait,
			graceMs: 4,
			pollMs: 2
		});
		expect(allFail).toEqual({ healed: false, reason: 'all-dials-failed' });

		const none = await healRelayConnection({
			hasRelayConnection: () => false,
			discover: async () => [],
			dial: vi.fn(),
			wait: noWait,
			graceMs: 4,
			pollMs: 2
		});
		expect(none).toEqual({ healed: false, reason: 'none-discovered' });
	});

	it('does not dial if discovery itself fails', async () => {
		const dial = vi.fn();
		const outcome = await healRelayConnection({
			hasRelayConnection: () => false,
			discover: async () => {
				throw new Error('aleph down');
			},
			dial,
			wait: noWait,
			graceMs: 4,
			pollMs: 2
		});
		expect(outcome).toEqual({ healed: false, reason: 'discover-failed' });
		expect(dial).not.toHaveBeenCalled();
	});

	it('stops before dialing if a baked relay comes up late, after the grace period', async () => {
		let connected = false;
		const dial = vi.fn();
		const outcome = await healRelayConnection({
			hasRelayConnection: () => connected,
			// Discovery is where the late connection lands.
			discover: async () => {
				connected = true;
				return [liveB];
			},
			dial,
			wait: noWait,
			graceMs: 4,
			pollMs: 2
		});
		expect(outcome).toEqual({ healed: false, reason: 'connected' });
		expect(dial).not.toHaveBeenCalled();
	});
});
