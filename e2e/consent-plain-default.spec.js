import { test, expect } from '@playwright/test';
import { waitForConsent } from './consent.mjs';

// The start notice opens plain for an ordinary yoga user, and the technical
// version is one button away — reachable before anyone accepts anything, since
// the plain view is a summary of the technical one, not a different promise.
//
// The privacy list and the network check live in the element's shadow tree, so
// the structural facts are read from there; "IPFS" is the language-agnostic
// marker of the technical clauses (it is not in the plain list, in either
// language).

/**
 * The shape of the consent dialog as it stands: which half is showing, and
 * what the element is rendering. Read from the shadow tree, like `isConsentOpen`.
 *
 * @param {import('@playwright/test').Page} page
 */
const consentShape = (page) =>
	page.evaluate(() => {
		const host = document.querySelector('[data-testid="consent-modal"]');
		const sr = /** @type {any} */ (host)?.shadowRoot;
		const check = sr?.querySelector('.check');
		const tech = sr?.querySelector('.tech');
		const accept = sr?.querySelector('input[part=accept]');
		const privacy = sr?.querySelector('.privacy')?.textContent ?? '';
		return {
			networkCheckHidden: check ? check.hidden === true : null,
			worthKnowingHidden: tech ? tech.hidden === true : null,
			privacyMentionsIpfs: privacy.includes('IPFS'),
			acceptPresent: !!accept,
			acceptChecked: accept ? accept.checked === true : null,
			connectHintsPresent: !!document.querySelector('[data-testid="consent-connect-hints"]')
		};
	});

test.describe('The start notice is plain by default, technical on demand', () => {
	test('opens plain, and the technical version is reachable before accepting', async ({ page }) => {
		await page.goto('/');
		await waitForConsent(page);

		// The default view: the plain summary, no network check, no stack names,
		// no "Worth knowing" — but the acceptance tick is already here.
		const plain = await consentShape(page);
		expect(plain.connectHintsPresent).toBe(true);
		expect(plain.networkCheckHidden).toBe(true);
		expect(plain.worthKnowingHidden).toBe(true);
		expect(plain.privacyMentionsIpfs).toBe(false);
		expect(plain.acceptPresent).toBe(true);
		expect(plain.acceptChecked).toBe(false);

		// The technical version is one button away — and reached without first
		// accepting anything, so nobody has to agree to read the detail.
		await page.getByTestId('consent-technical').click();

		const technical = await consentShape(page);
		expect(technical.privacyMentionsIpfs).toBe(true); // the full clauses are here
		expect(technical.networkCheckHidden).toBe(false); // the network check is back
		expect(technical.worthKnowingHidden).toBe(false); // and "Worth knowing"
		expect(technical.connectHintsPresent).toBe(false); // the plain hints step aside
		expect(technical.acceptPresent).toBe(true);
		expect(technical.acceptChecked).toBe(false); // still nothing accepted
		await expect(page.getByTestId('consent-version')).toBeVisible();

		// Back to simple: the toggle is a toggle, and the plain view returns whole.
		await page.getByTestId('consent-technical').click();
		const backToPlain = await consentShape(page);
		expect(backToPlain.networkCheckHidden).toBe(true);
		expect(backToPlain.privacyMentionsIpfs).toBe(false);
		expect(backToPlain.connectHintsPresent).toBe(true);
	});

	test('the identity hints carry no stack names in the plain view', async ({ page }) => {
		await page.goto('/');
		await waitForConsent(page);

		// The identity chooser is the app's own markup, in the element's slot. In
		// the plain view it names no WebAuthn, DID, OrbitDB or authenticator.
		const plainHints = await page.getByTestId('passkey-onboarding').innerText();
		expect(plainHints).not.toMatch(/WebAuthn|OrbitDB|DID|authenticator/i);

		await page.getByTestId('consent-technical').click();
		const technicalHints = await page.getByTestId('passkey-onboarding').innerText();
		expect(technicalHints).toMatch(/WebAuthn|OrbitDB|DID|authenticator/i);
	});
});
