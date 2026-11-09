import { describe, expect, it } from 'vitest';
import { matchesRegistrationId } from './aleph-bootstrap-discovery.js';

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
