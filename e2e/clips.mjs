import { expect } from '@playwright/test';
import { passConsent } from './consent.mjs';

// What a spec about clips needs before it can say anything: the app started,
// a playlist open, a clip in it. Without a passkey — these specs are about
// the player, and a random identity may create and fill a playlist as well.

const timeout = 90_000;

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} [url]
 */
export async function startAnonymous(page, url = '/') {
	await page.goto(url);
	await passConsent(page, { identity: 'anonymous' });
	await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @returns {Promise<string>} the playlist's address
 */
export async function createPlaylist(page, name) {
	await page.getByTestId('new-playlist-name').fill(name);
	await page.getByTestId('new-playlist-create').click();
	await expect(page.getByTestId('active-playlist-name')).toContainText(name, { timeout });
	const address = page.getByTestId('active-playlist-address');
	await expect(address).toHaveText(/^\s*\/orbitdb\/\w+\s*$/, { timeout });
	return ((await address.textContent()) ?? '').trim();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
export function clipCard(page, title) {
	return page.locator('[data-testid="clip-card"]', {
		has: page.locator('[data-testid="clip-card-title"]', { hasText: title })
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ url: string, title: string, teacher?: string, duration: string, tags?: string }} clip
 * @returns {Promise<string>} the clip's id
 */
export async function addClip(page, clip) {
	await page.getByTestId('clip-url').fill(clip.url);
	// A lookup may fill these from the network; what the test types wins.
	await page.getByTestId('clip-title').fill(clip.title);
	await page.getByTestId('clip-teacher').fill(clip.teacher ?? '');
	await page.getByTestId('clip-duration').fill(clip.duration);
	await page.getByTestId('clip-tags').fill(clip.tags ?? '');
	await page.getByTestId('clip-add').click();
	const card = clipCard(page, clip.title);
	await expect(card).toBeVisible({ timeout });
	const id = await card.getAttribute('data-clip-id');
	if (!id) throw new Error('clip card has no data-clip-id');
	return id;
}
