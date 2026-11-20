import { describe, expect, it } from 'vitest';
import { COMMON_CLAUSE_KEYS, technicalClauseKeys } from './consent-text.js';

describe('technicalClauseKeys', () => {
	it('lists the common clauses, then the identity sentence, then cookies', () => {
		expect(technicalClauseKeys('anonymous')).toEqual([
			'noServer',
			'gateway',
			'relay',
			'playlist',
			'readingIsOpen',
			'oembed',
			'embeds',
			'clipLink',
			'storage',
			'identityAnonymous',
			'cookies'
		]);
	});

	it('swaps in the passkey sentence for a passkey identity, and only that', () => {
		const anon = technicalClauseKeys('anonymous');
		const passkey = technicalClauseKeys('create');

		expect(passkey).toContain('identityPasskey');
		expect(passkey).not.toContain('identityAnonymous');
		// Everything else is identical and in the same place.
		expect(passkey.filter((k) => !k.startsWith('identity'))).toEqual(
			anon.filter((k) => !k.startsWith('identity'))
		);
		expect(passkey).toHaveLength(anon.length);
	});

	it('treats every non-anonymous identity the same (existing is a passkey too)', () => {
		expect(technicalClauseKeys('existing')).toEqual(technicalClauseKeys('create'));
	});

	it('shows exactly one identity sentence, never both', () => {
		for (const identity of ['anonymous', 'create', 'existing']) {
			const identityKeys = technicalClauseKeys(identity).filter((k) => k.startsWith('identity'));
			expect(identityKeys).toHaveLength(1);
		}
	});

	it('keeps the common clauses as their own frozen list', () => {
		expect(COMMON_CLAUSE_KEYS).toContain('noServer');
		expect(() => {
			// @ts-expect-error - deliberately mutating a frozen array
			COMMON_CLAUSE_KEYS.push('oops');
		}).toThrow();
	});
});
