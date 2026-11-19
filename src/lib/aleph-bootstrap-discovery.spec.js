import { describe, expect, it, vi } from 'vitest';
import {
	discoverScopedBootstrapMultiaddrs,
	matchesRegistrationId
} from './aleph-bootstrap-discovery.js';

const addrMain =
	'/dns4/main.example/tcp/443/tls/ws/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE';
const addrPool =
	'/dns4/pool.example/tcp/443/tls/ws/p2p/12D3KooWSc3Sqr3Q7RGJAFBz5i7WTTC5kzunnm2tvXVcSwTEtUTP';

vi.mock('@le-space/aleph-bootstrap', () => {
	const posts = [
		{
			content: {
				registrationId: 'relay:orbitdb-relay:relay-main-ekb:deadbeef',
				browserMultiaddrs: [
					'/dns4/main.example/tcp/443/tls/ws/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'
				]
			}
		},
		{
			content: {
				registrationId: 'relay:orbitdb-relay:orbitdb-relay:cafe',
				browserMultiaddrs: [
					'/dns4/pool.example/tcp/443/tls/ws/p2p/12D3KooWSc3Sqr3Q7RGJAFBz5i7WTTC5kzunnm2tvXVcSwTEtUTP'
				]
			}
		},
		{
			content: {
				registrationId: 'relay:orbitdb-relay:smoke-orbitdb-relay-9',
				browserMultiaddrs: [
					'/dns4/smoke.example/tcp/443/tls/ws/p2p/12D3KooWLaah6yFW7ohFEZgsDNpH86xtmpztvamgyoLvLMtNyfpR'
				]
			}
		}
	];
	return {
		fetchAlephBootstrapPosts: vi.fn(async () => posts),
		selectCurrentRelayBootstrapPosts: (list) => list,
		filterRelayBootstrapPostsByProfile: (list) => list
	};
});

describe('matchesRegistrationId', () => {
	const wanted = 'relay:orbitdb-relay:relay-main-ekb';

	it('accepts the id with and without the instance hash suffix', () => {
		expect(matchesRegistrationId(wanted, wanted)).toBe(true);
		expect(matchesRegistrationId(`${wanted}:32d4d7b21e5b245d2a0a2e996845c156`, wanted)).toBe(true);
	});

	it('refuses smoke relays and other prefixes that merely share letters', () => {
		expect(matchesRegistrationId('relay:orbitdb-relay:smoke-orbitdb-relay-1', wanted)).toBe(false);
		expect(matchesRegistrationId('relay:orbitdb-relay:relay-main-ekb-old', wanted)).toBe(false);
		expect(matchesRegistrationId(undefined, wanted)).toBe(false);
	});
});

describe('discoverScopedBootstrapMultiaddrs', () => {
	it('returns the whole production set by default: main relay and the pool, but not smoke', async () => {
		expect(await discoverScopedBootstrapMultiaddrs()).toEqual([addrMain, addrPool]);
	});

	it('still scopes to one relay when a single registrationId is asked for', async () => {
		expect(
			await discoverScopedBootstrapMultiaddrs({
				registrationId: 'relay:orbitdb-relay:relay-main-ekb'
			})
		).toEqual([addrMain]);
		expect(
			await discoverScopedBootstrapMultiaddrs({
				registrationId: 'relay:orbitdb-relay:orbitdb-relay'
			})
		).toEqual([addrPool]);
	});

	it('matches any of several ids when registrationIds is given', async () => {
		expect(
			await discoverScopedBootstrapMultiaddrs({
				registrationIds: ['relay:orbitdb-relay:orbitdb-relay']
			})
		).toEqual([addrPool]);
	});
});
