// Between two passkey prompts, a word on what the next one is for.
//
// A new passkey is asked four times in a row before the app is ready: to be
// created, to keep a note of its identity, to hand out the secret the signing
// key is derived from, and to confirm that key. Without a word in between that
// looks like a loop, or like something failing and trying again. So before each
// prompt after the first the page says what it is for and waits for "Continue";
// the prompt then starts from that click, which browsers that want a user
// gesture for every WebAuthn call (Safari) need anyway.
//
// Two of the four prompts are asked by the identity provider, deep inside
// `createIdentity`, where this app has no line of its own to put a dialog. So
// the steps are counted where every prompt passes: at `navigator.credentials`,
// for the length of one flow (`beginPasskeyFlow` … `end`). What a prompt is for
// is read from the request itself, not from its position.
//
// The pattern is Belege's (`passkey-steps.svelte.js`, Le-Space/belege#429).
import { writable } from 'svelte/store';

/**
 * What a prompt is for.
 *
 * - `create`: register the passkey
 * - `store`: write the identity's metadata into the passkey (largeBlob)
 * - `find`: read that metadata back
 * - `key`: the PRF output the signing key is derived from
 * - `proof`: the assertion that binds the signing key to the passkey
 *
 * @typedef {'create' | 'store' | 'find' | 'key' | 'proof'} PasskeyPurpose
 */

/**
 * @typedef {{
 *   n: number
 *   of: number | null
 *   purpose: PasskeyPurpose
 *   canCancel: boolean
 *   resolve: () => void
 *   reject: (error: Error) => void
 * }} PasskeyStepOnScreen
 */

/** The step on screen, or null. */
export const passkeyStepStore = writable(/** @type {PasskeyStepOnScreen | null} */ (null));

/** A new passkey: create, store, key, proof. */
export const PROMPTS_TO_CREATE = 4;

/** Thrown when someone cancels between two prompts. */
export class PasskeyStepCancelled extends Error {
	constructor() {
		super('cancelled between two passkey prompts');
		this.name = 'PasskeyStepCancelled';
	}
}

/**
 * @param {'create' | 'get'} kind
 * @param {any} options what the caller hands to `navigator.credentials`
 * @returns {PasskeyPurpose}
 */
export function purposeOfRequest(kind, options) {
	if (kind === 'create') return 'create';
	const extensions = options?.publicKey?.extensions ?? {};
	if (extensions.largeBlob?.write) return 'store';
	if (extensions.largeBlob?.read) return 'find';
	if (extensions.prf) return 'key';
	return 'proof';
}

/**
 * Show the step and wait for "Continue".
 *
 * @param {{ n: number, of: number | null, purpose: PasskeyPurpose, canCancel: boolean }} step
 * @returns {Promise<void>} rejects with PasskeyStepCancelled on "Cancel"
 */
export function confirmPasskeyStep(step) {
	return new Promise((resolve, reject) => {
		passkeyStepStore.set({
			...step,
			resolve: () => {
				passkeyStepStore.set(null);
				resolve();
			},
			reject: (error) => {
				passkeyStepStore.set(null);
				reject(error);
			}
		});
	});
}

/**
 * Count the passkey prompts from here on, and announce each one after the
 * first. The first starts from the button that began the flow.
 *
 * `of` is the number of prompts when it is known (a new passkey), and null
 * when it depends on what this browser already holds (an existing one).
 *
 * @param {{ of?: number | null, container?: any }} [options]
 */
export function beginPasskeyFlow({
	of = null,
	container = globalThis.navigator?.credentials
} = {}) {
	const flow = {
		/** Prompts asked for so far. */
		n: 0,
		/** Prompts the authenticator answered. */
		completed: 0,
		of,
		cancelled: false,
		end() {}
	};
	if (!container) return flow;

	/** @type {Array<() => void>} */
	const restore = [];

	for (const kind of /** @type {const} */ (['create', 'get'])) {
		const original = container[kind];
		if (typeof original !== 'function') continue;
		const hadOwn = Object.prototype.hasOwnProperty.call(container, kind);

		/** @param {any} options */
		const ask = async (options) => {
			// One "Cancel" ends the flow. The provider carries on after some
			// refusals (a missing largeBlob is not an error to it), and would
			// otherwise arrive at the next prompt as if nothing had been said.
			if (flow.cancelled) throw new PasskeyStepCancelled();
			flow.n += 1;
			if (flow.n > 1) {
				const purpose = purposeOfRequest(kind, options);
				try {
					await confirmPasskeyStep({
						n: flow.n,
						of: flow.of,
						purpose,
						// Not before the key: the provider takes a refused PRF read
						// for "this authenticator has none" and settles for a key that
						// exists in this browser only. There is no clean way out at
						// that point, so the step does not offer one.
						canCancel: purpose !== 'key'
					});
				} catch (error) {
					flow.cancelled = true;
					throw error;
				}
			}
			const answer = await original.call(container, options);
			flow.completed += 1;
			return answer;
		};

		try {
			container[kind] = ask;
		} catch {
			// A browser that will not have it replaced gets no announcements,
			// and every prompt it would have had anyway.
			continue;
		}
		restore.push(() => {
			if (container[kind] !== ask) return;
			if (hadOwn) container[kind] = original;
			else delete container[kind];
		});
	}

	flow.end = () => {
		while (restore.length > 0) restore.pop()?.();
		passkeyStepStore.update((step) => {
			step?.reject(new PasskeyStepCancelled());
			return null;
		});
	};
	return flow;
}
