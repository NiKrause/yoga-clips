import { test, expect } from '@playwright/test';
import { acceptNotice, isConsentOpen, waitForConsent, walkPasskeySteps } from './consent.mjs';

// The consent dialog asks again when the identity choice cannot be carried
// out. Asking again must leave a dialog that still works: a first press with
// something missing once left "Proceed" dead, with the old complaint standing
// under a field that had been filled in since.

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

test.describe('The identity choice in the consent dialog', () => {
	test('a new passkey without a name is asked for one, and the name then works', async ({
		page
	}) => {
		test.setTimeout(timeout * 2);
		await addVirtualAuthenticator(page);
		await page.goto('/');
		await waitForConsent(page);

		await page.getByTestId('identity-mode-create').check();
		await acceptNotice(page);
		await page.getByTestId('consent-proceed').click();

		// The complaint is shown, and the dialog has not gone anywhere.
		await expect(page.getByTestId('consent-error')).toContainText(/passkey a name/i);
		expect(await isConsentOpen(page)).toBe(true);

		// Naming the passkey answers the complaint, so it goes.
		await page.getByTestId('passkey-label').fill('Alice');
		await expect(page.getByTestId('consent-error')).toHaveCount(0);

		// And the same button, pressed again, now starts the app.
		await page.getByTestId('consent-proceed').click();
		await page.waitForFunction(
			() => document.querySelector('[data-testid="consent-modal"]')?.isOpen !== true
		);
		await walkPasskeySteps(page);
		await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout });
		await expect(page.getByTestId('own-did-value')).toHaveAttribute('data-did', /^did:key:/);
	});

	test('a refused choice reopens a dialog that still works', async ({ page }) => {
		test.setTimeout(timeout * 2);
		// An authenticator with nothing on it: "use an existing passkey" fails at once.
		await addVirtualAuthenticator(page);
		await page.goto('/');
		await waitForConsent(page);

		await page.getByTestId('identity-mode-existing').check();
		await acceptNotice(page);
		await page.getByTestId('consent-proceed').click();

		await expect(page.getByTestId('consent-error')).toBeVisible();
		await waitForConsent(page);

		// One press, one attempt: the complaint is not followed by a second one.
		const errorsLogged = [];
		page.on('console', (message) => {
			if (message.type() === 'error' && message.text().includes('P2P initialization failed')) {
				errorsLogged.push(message.text());
			}
		});

		await page.getByTestId('identity-mode-anonymous').check();
		await acceptNotice(page);
		await page.getByTestId('consent-proceed').click();
		await page.waitForFunction(
			() => document.querySelector('[data-testid="consent-modal"]')?.isOpen !== true
		);
		await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout });
		expect(errorsLogged).toEqual([]);
	});
});
