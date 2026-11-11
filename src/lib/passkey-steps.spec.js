import { describe, it, expect, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
	beginPasskeyFlow,
	passkeyStepStore,
	PasskeyStepCancelled,
	PROMPTS_TO_CREATE,
	purposeOfRequest
} from './passkey-steps.js';

/** A stand-in for `navigator.credentials` that records what reaches it. */
function fakeContainer() {
	/** @type {string[]} */
	const asked = [];
	class Container {
		/** @param {any} options */
		async create(options) {
			asked.push(`create:${options?.tag ?? ''}`);
			return { kind: 'created' };
		}
		/** @param {any} options */
		async get(options) {
			asked.push(`get:${options?.tag ?? ''}`);
			return { kind: 'asserted' };
		}
	}
	return { container: new Container(), asked };
}

const largeBlobWrite = { publicKey: { extensions: { largeBlob: { write: new Uint8Array(1) } } } };
const largeBlobRead = { publicKey: { extensions: { largeBlob: { read: true } } } };
const prf = { publicKey: { extensions: { prf: { eval: { first: new Uint8Array(1) } } } } };
const plain = { publicKey: {} };

/** Wait until a step is on screen, and hand it back. */
async function stepOnScreen() {
	for (let i = 0; i < 50; i++) {
		const step = get(passkeyStepStore);
		if (step) return step;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error('no passkey step came on screen');
}

afterEach(() => passkeyStepStore.set(null));

describe('purposeOfRequest', () => {
	it('reads what a prompt is for from the request', () => {
		expect(purposeOfRequest('create', plain)).toBe('create');
		expect(purposeOfRequest('get', largeBlobWrite)).toBe('store');
		expect(purposeOfRequest('get', largeBlobRead)).toBe('find');
		expect(purposeOfRequest('get', prf)).toBe('key');
		expect(purposeOfRequest('get', plain)).toBe('proof');
		expect(purposeOfRequest('get', undefined)).toBe('proof');
	});
});

describe('beginPasskeyFlow', () => {
	it('lets the first prompt through and announces each one after it', async () => {
		const { container, asked } = fakeContainer();
		const flow = beginPasskeyFlow({ of: PROMPTS_TO_CREATE, container });

		await container.create(plain);
		expect(get(passkeyStepStore)).toBeNull();
		expect(asked).toEqual(['create:']);

		const second = container.get(largeBlobWrite);
		const step = await stepOnScreen();
		expect(step).toMatchObject({ n: 2, of: 4, purpose: 'store', canCancel: true });
		// Nothing reaches the authenticator before "Continue".
		expect(asked).toEqual(['create:']);
		step.resolve();
		await expect(second).resolves.toEqual({ kind: 'asserted' });
		expect(asked).toEqual(['create:', 'get:']);
		expect(get(passkeyStepStore)).toBeNull();

		const third = container.get(prf);
		const keyStep = await stepOnScreen();
		expect(keyStep).toMatchObject({ n: 3, of: 4, purpose: 'key', canCancel: false });
		keyStep.resolve();
		await third;

		const fourth = container.get(plain);
		const proofStep = await stepOnScreen();
		expect(proofStep).toMatchObject({ n: 4, of: 4, purpose: 'proof', canCancel: true });
		proofStep.resolve();
		await fourth;

		expect(flow).toMatchObject({ n: 4, completed: 4, cancelled: false });
		flow.end();
	});

	it('counts without a total when the total is not known', async () => {
		const { container } = fakeContainer();
		const flow = beginPasskeyFlow({ container });
		await container.get(largeBlobRead);
		const next = container.get(prf);
		const step = await stepOnScreen();
		expect(step).toMatchObject({ n: 2, of: null, purpose: 'key' });
		step.resolve();
		await next;
		flow.end();
	});

	it('ends the whole flow on "Cancel", also for a caller that carries on', async () => {
		const { container, asked } = fakeContainer();
		const flow = beginPasskeyFlow({ of: PROMPTS_TO_CREATE, container });
		await container.create(plain);

		const second = container.get(largeBlobWrite);
		const step = await stepOnScreen();
		step.reject(new PasskeyStepCancelled());
		await expect(second).rejects.toBeInstanceOf(PasskeyStepCancelled);
		expect(flow).toMatchObject({ cancelled: true, completed: 1 });

		// The provider treats some refusals as "not supported" and asks on.
		await expect(container.get(prf)).rejects.toBeInstanceOf(PasskeyStepCancelled);
		expect(get(passkeyStepStore)).toBeNull();
		expect(asked).toEqual(['create:']);
		flow.end();
	});

	it('hands the container back as it was', async () => {
		const { container, asked } = fakeContainer();
		const flow = beginPasskeyFlow({ container });
		expect(Object.prototype.hasOwnProperty.call(container, 'get')).toBe(true);
		flow.end();
		expect(Object.prototype.hasOwnProperty.call(container, 'get')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(container, 'create')).toBe(false);

		// After the flow, a second prompt is nobody's business any more.
		await container.get(plain);
		await container.get(plain);
		expect(get(passkeyStepStore)).toBeNull();
		expect(asked).toEqual(['get:', 'get:']);
	});

	it('closes a step still on screen when the flow ends', async () => {
		const { container } = fakeContainer();
		const flow = beginPasskeyFlow({ container });
		await container.get(largeBlobRead);
		const pending = container.get(plain);
		await stepOnScreen();
		flow.end();
		await expect(pending).rejects.toBeInstanceOf(PasskeyStepCancelled);
		expect(get(passkeyStepStore)).toBeNull();
	});

	it('does nothing where there is no WebAuthn', () => {
		const flow = beginPasskeyFlow({ container: null });
		expect(flow).toMatchObject({ n: 0, cancelled: false });
		flow.end();
	});
});
