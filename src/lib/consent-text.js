/**
 * Which privacy clauses the consent dialog renders, and in which view.
 *
 * The dialog has two halves now. The simple view (the default) carries a short,
 * plain summary that nobody needs a glossary for; the technical view carries the
 * full, word-for-word clauses. This module decides the technical half — a pure
 * function of the chosen identity, so the order of the clauses and the
 * identity-dependent sentence are a unit test rather than a reading of the
 * component. The simple half is a fixed list (`consent.plain.privacy`) and needs
 * no logic.
 *
 * Keys are relative to `consent.clause.*`; the component turns them into text.
 */

/**
 * The clauses shared by both identities, in the order they are shown.
 *
 * @type {readonly string[]}
 */
export const COMMON_CLAUSE_KEYS = Object.freeze([
	'noServer',
	'gateway',
	'relay',
	'playlist',
	'readingIsOpen',
	'oembed',
	'embeds',
	'storage'
]);

/**
 * The full technical clause keys for the identity in use. Two of them depend on
 * whether the person took a passkey: the identity sentence sits second to last,
 * before `cookies`.
 *
 * @param {string} identity - 'anonymous' for the throwaway identity, anything
 *   else for a passkey-backed one.
 * @returns {string[]}
 */
export function technicalClauseKeys(identity) {
	return [
		...COMMON_CLAUSE_KEYS,
		identity === 'anonymous' ? 'identityAnonymous' : 'identityPasskey',
		'cookies'
	];
}
