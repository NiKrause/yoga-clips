import { test, expect } from '@playwright/test';
import { acceptNotice, waitForConsent, walkPasskeySteps } from './consent.mjs';

// A new passkey is asked four times before the app is ready. The app says so
// before the first prompt, and before each further one says what it is for and
// waits. "Cancel" in between ends the start and keeps the passkey.

const timeout = 90_000;

/** @param {import('@playwright/test').Page} page */
async function addVirtualAuthenticator(page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			ctap2Version: 'ctap2_1',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			hasLargeBlob: true,
			automaticPresenceSimulation: true
		}
	});
}

/** @param {import('@playwright/test').Page} page @param {string} label */
async function proceedWithNewPasskey(page, label) {
	await waitForConsent(page);
	await page.getByTestId('identity-mode-create').check();
	await page.getByTestId('passkey-label').fill(label);
	await acceptNotice(page);
	await page.getByTestId('consent-proceed').click();
}

test.describe('The prompts of a passkey', () => {
	test('a new passkey: told four prompts, then walked through three steps', async ({ page }) => {
		test.setTimeout(timeout * 2);
		await addVirtualAuthenticator(page);
		await page.goto('/');
		await waitForConsent(page);

		// Before anything is asked: how often, and that each will be explained.
		await page.getByTestId('identity-mode-create').check();
		await expect(page.getByTestId('passkey-prompts-hint')).toContainText(/four times/i);

		await proceedWithNewPasskey(page, 'Alice');

		// The step before the key cannot be cancelled; the others can.
		const dialog = page.getByTestId('passkey-step-dialog');
		await expect(dialog).toBeVisible({ timeout });
		await expect(page.getByTestId('passkey-step-count')).toHaveText(/2 of 4/);
		await expect(page.getByTestId('passkey-step-title')).toHaveAttribute('data-purpose', 'store');
		await expect(page.getByTestId('passkey-step-cancel')).toBeVisible();
		await page.getByTestId('passkey-step-continue').click();

		await expect(page.getByTestId('passkey-step-count')).toHaveText(/3 of 4/, { timeout });
		await expect(page.getByTestId('passkey-step-title')).toHaveAttribute('data-purpose', 'key');
		await expect(page.getByTestId('passkey-step-cancel')).toHaveCount(0);
		await page.getByTestId('passkey-step-continue').click();

		await expect(page.getByTestId('passkey-step-count')).toHaveText(/4 of 4/, { timeout });
		await expect(page.getByTestId('passkey-step-title')).toHaveAttribute('data-purpose', 'proof');
		await page.getByTestId('passkey-step-continue').click();

		await expect(dialog).toBeHidden();
		await expect(page.getByTestId('own-did-value')).toHaveAttribute('data-did', /^did:key:/, {
			timeout
		});
		await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout });
	});

	test('"Cancel" between two prompts keeps the passkey and carries on with it', async ({
		page
	}) => {
		test.setTimeout(timeout * 2);
		await addVirtualAuthenticator(page);
		await page.goto('/');
		await proceedWithNewPasskey(page, 'Bob');

		await expect(page.getByTestId('passkey-step-count')).toHaveText(/2 of 4/, { timeout });
		await page.getByTestId('passkey-step-cancel').click();

		// Back in the consent dialog: said what happened, and the choice has
		// moved to the passkey that now exists.
		await waitForConsent(page);
		await expect(page.getByTestId('consent-error')).toContainText(/already exists/i);
		await expect(page.getByTestId('identity-mode-existing')).toBeChecked();
		await expect(page.getByTestId('passkey-step-dialog')).toBeHidden();

		// Proceeding uses that passkey. How many prompts it takes now depends
		// on what the browser holds, so the count has no total.
		await acceptNotice(page);
		await page.getByTestId('consent-proceed').click();
		const steps = await walkPasskeySteps(page);
		expect(steps.map((step) => step.purpose)).toEqual(['key', 'proof']);
		for (const step of steps) expect(step.count).not.toMatch(/ of /);
		await expect(page.getByTestId('own-did-value')).toHaveAttribute('data-did', /^did:key:/);
	});
});
