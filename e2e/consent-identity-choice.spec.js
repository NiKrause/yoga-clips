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

test.describe('The way out of the consent dialog', () => {
	test('Escape is not a way past the statement', async ({ page }) => {
		// The app starts when the dialog reports a close, and a browser closes a
		// dialog on Escape. Only an accepted statement may start anything.
		const started = [];
		page.on('console', (message) => {
			if (message.text().includes('Starting P2P initialization')) started.push(message.text());
		});
		await page.goto('/');
		await waitForConsent(page);

		await page.keyboard.press('Escape');
		await page.waitForTimeout(1500);

		// Still asking, nothing started, nothing remembered.
		await waitForConsent(page);
		expect(started).toEqual([]);
		expect(await page.evaluate(() => localStorage.getItem('yogaClips.identityMode'))).toBeNull();
		await expect(page.getByTestId('consent-proceed')).toBeDisabled();

		// And it is still a working dialog: accept, proceed, and the app starts.
		await acceptNotice(page);
		await page.getByTestId('consent-proceed').click();
		await page.waitForFunction(
			() => document.querySelector('[data-testid="consent-modal"]')?.isOpen !== true
		);
		await expect.poll(() => started.length, { timeout }).toBe(1);
	});

	test('Escape does not skip what the chosen identity still needs', async ({ page }) => {
		await addVirtualAuthenticator(page);
		await page.goto('/');
		await waitForConsent(page);
		await page.getByTestId('identity-mode-create').check();
		await acceptNotice(page);

		// Accepted, but a new passkey has no name yet.
		await page.keyboard.press('Escape');

		await expect(page.getByTestId('consent-error')).toContainText(/passkey a name/i);
		await waitForConsent(page);
		expect(await page.evaluate(() => localStorage.getItem('yogaClips.identityMode'))).toBeNull();
	});
});

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
