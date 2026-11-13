import { test, expect } from '@playwright/test';
import { addClip, clipCard, createPlaylist, startAnonymous } from './clips.mjs';

// An Instagram post or reel plays in the player through Instagram's own
// /embed/ page, in a frame. Nothing is asked of Instagram before the click
// that opens the player, and the way out to instagram.com stays readable.
//
// Instagram itself is replaced by a stand-in here: the test is about what
// this app requests and when, not about what Instagram answers.

const REEL = 'https://www.instagram.com/reel/C0dEexample/';
const INSTAGRAM = /^https:\/\/([^/]+\.)?(instagram\.com|instagr\.am|cdninstagram\.com)\//;

test('an Instagram clip asks nothing of Instagram before the click, and its embed page after', async ({
	page,
	context
}) => {
	test.setTimeout(240_000);

	/** @type {string[]} */
	const asked = [];
	await context.route(INSTAGRAM, (route) => {
		asked.push(route.request().url());
		return route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><title>stand-in</title><p>Instagram stand-in</p>'
		});
	});

	await startAnonymous(page);
	await createPlaylist(page, 'Instagram');
	await addClip(page, { url: `${REEL}?igsh=abc`, title: 'Wrist warm-up', duration: '2' });

	const card = clipCard(page, 'Wrist warm-up');
	await expect(card).toHaveAttribute('data-source', 'instagram');
	// Pasted, added, on screen as a card — and Instagram has heard nothing.
	expect(asked).toEqual([]);

	await card.getByTestId('clip-play').click();

	const frame = page.getByTestId('player-iframe');
	await expect(frame).toHaveAttribute('src', `${REEL}embed/`);
	await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin');
	await expect(
		page.frameLocator('[data-testid="player-iframe"]').getByText('Instagram stand-in')
	).toBeVisible();
	expect(asked).toEqual([`${REEL}embed/`]);

	// The way out, and one line on why it is there.
	await expect(page.getByTestId('player-instagram-hint')).toBeVisible();
	const open = page.getByTestId('player-open-external');
	await expect(open).toHaveAttribute('href', REEL);
	await expect(open).toHaveAttribute('target', '_blank');

	// Its label is white on the filled button in both themes — it used to
	// come out in the link colour.
	for (const dark of [false, true]) {
		await page.evaluate((on) => document.documentElement.classList.toggle('dark', on), dark);
		expect(
			await open.evaluate((element) => getComputedStyle(element).color),
			dark ? 'dark' : 'light'
		).toBe('rgb(255, 255, 255)');
	}

	await page.getByTestId('player-close').click();
	await expect(frame).toHaveCount(0);
	expect(asked).toEqual([`${REEL}embed/`]);
});
