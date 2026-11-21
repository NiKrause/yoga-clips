import { test, expect } from '@playwright/test';
import { passConsent } from './consent.mjs';
import { addClip, clipCard, createPlaylist, startAnonymous } from './clips.mjs';

// A clip is shown in its own format, never cropped into 16:9: an Instagram
// reel is upright, a YouTube clip wide. The frame also stays on screen — an
// upright clip must not push the title and "Done" below the fold — so its
// height is capped to the viewport.
//
// The services are stand-ins: this is about the frame the app draws, not
// about what a service answers.

const REEL = 'https://www.instagram.com/reel/C0dEexample/';
const VIDEO = 'dQw4w9WgXcQ';
const SERVICES =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|vimeo\.com|vimeocdn\.com|instagram\.com|cdninstagram\.com)\//;

/** @param {import('@playwright/test').BrowserContext} context */
async function standInForServices(context) {
	await context.route(SERVICES, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' })
	);
}

/** @param {import('@playwright/test').Locator} box */
async function ratioOf(box) {
	const size = await box.boundingBox();
	if (!size) throw new Error('frame has no box');
	return { ...size, ratio: size.width / size.height };
}

test('the playlist player frames a reel upright and a YouTube clip wide, both on screen', async ({
	page,
	context
}) => {
	test.setTimeout(240_000);
	await standInForServices(context);

	await startAnonymous(page);
	await createPlaylist(page, 'Formats');
	await addClip(page, { url: `${REEL}?igsh=abc`, title: 'Wrist warm-up', duration: '2' });
	await addClip(page, {
		url: `https://youtu.be/${VIDEO}`,
		title: 'Shoulder opener',
		duration: '5'
	});

	const viewport = page.viewportSize();
	if (!viewport) throw new Error('no viewport');

	// The reel: an upright 9:16 frame, and no taller than the viewport.
	await clipCard(page, 'Wrist warm-up').getByTestId('clip-play').click();
	const reelFrame = page.getByTestId('player-frame');
	await expect(reelFrame).toHaveAttribute('data-shape', 'reel');
	const reel = await ratioOf(reelFrame);
	expect(reel.ratio).toBeGreaterThan(0.5);
	expect(reel.ratio).toBeLessThan(0.75); // portrait, not landscape
	expect(reel.height).toBeLessThanOrEqual(viewport.height);
	// The point of the cap: "Done" is not pushed below the fold — on a laptop
	// and on a phone.
	await expect(page.getByTestId('player-done')).toBeInViewport();
	await page.setViewportSize({ width: 390, height: 844 });
	const reelPhone = await ratioOf(reelFrame);
	expect(reelPhone.width).toBeLessThanOrEqual(390);
	await expect(page.getByTestId('player-done')).toBeInViewport();
	await page.setViewportSize(viewport);

	// The YouTube clip: a wide 16:9 frame.
	await clipCard(page, 'Shoulder opener').getByTestId('clip-play').click();
	const wideFrame = page.getByTestId('player-frame');
	await expect(wideFrame).toHaveAttribute('data-shape', 'wide');
	const wide = await ratioOf(wideFrame);
	expect(wide.ratio).toBeGreaterThan(1.6);
	expect(wide.ratio).toBeLessThan(1.9);
});

test('the cinema page frames a reel upright and on the stage', async ({ page, context }) => {
	test.setTimeout(240_000);
	await standInForServices(context);

	await startAnonymous(page);
	await createPlaylist(page, 'Cinema formats');
	const id = await addClip(page, {
		url: `${REEL}?igsh=abc`,
		title: 'Wrist warm-up',
		duration: '2'
	});

	await page.goto(`/?clip=${id}`);
	await passConsent(page, { identity: 'anonymous' });

	const start = page.getByTestId('cinema-start');
	await expect(start).toBeVisible({ timeout: 90_000 });
	await start.click();

	const frame = page.getByTestId('cinema-frame');
	await expect(frame).toHaveAttribute('data-shape', 'reel');
	const reel = await ratioOf(frame);
	expect(reel.ratio).toBeGreaterThan(0.5);
	expect(reel.ratio).toBeLessThan(0.75);
	// On the stage, inside the dark page.
	const viewport = page.viewportSize();
	if (!viewport) throw new Error('no viewport');
	expect(reel.height).toBeLessThanOrEqual(viewport.height);
	expect(reel.width).toBeLessThanOrEqual(viewport.width);
});
