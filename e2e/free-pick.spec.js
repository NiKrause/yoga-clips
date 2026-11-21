import { test, expect } from '@playwright/test';
import { passConsent } from './consent.mjs';
import { addClip, createPlaylist, startAnonymous } from './clips.mjs';

// A playlist link with free time — `?db=…&free=<seconds>`, how the yoga-break
// mod hands a break over when no local clips.json is set. The app starts as
// for any playlist link; once the clips are here it picks the longest that
// fits and opens it in the cinema, and the address becomes `?db=…&clip=<id>`.
// Nothing fits: the playlist view says so and names the shortest clip.
//
// The clips are made up and the services are stand-ins: nothing is asked of a
// video service here, and the pick never presses start.

const SERVICES =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|vimeo\.com|vimeocdn\.com|instagram\.com|cdninstagram\.com)\//;

/** @param {import('@playwright/test').BrowserContext} context */
async function standInForServices(context) {
	await context.route(SERVICES, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' })
	);
}

/**
 * A playlist with a short and a long clip, and its address.
 * @param {import('@playwright/test').Page} page
 */
async function playlistOfTwo(page) {
	await startAnonymous(page);
	const address = await createPlaylist(page, 'Break');
	await addClip(page, {
		url: 'https://youtu.be/aaaaaaaaaaa',
		title: 'Breath break',
		duration: '2'
	});
	await addClip(page, { url: 'https://youtu.be/bbbbbbbbbbb', title: 'Long flow', duration: '5' });
	return address;
}

test('a free-time link picks the longest clip that fits and opens the cinema', async ({
	page,
	context
}) => {
	test.setTimeout(240_000);
	await standInForServices(context);
	const address = await playlistOfTwo(page);

	// 301s fits the 5:00 clip (300s), which is the longest that fits.
	await page.goto(`/?db=${encodeURIComponent(address)}&free=301`);
	await passConsent(page, { identity: 'anonymous' });

	await expect(page.getByTestId('cinema-start')).toBeVisible({ timeout: 90_000 });
	await expect(page.getByTestId('cinema-title')).toHaveText('Long flow');
	// Opened as `?clip=` does: the start control, nothing loaded yet.
	await expect(page.locator('iframe')).toHaveCount(0);

	// The address lost `free` and gained the clip, so a reload shows it again.
	await expect.poll(() => new URL(page.url()).searchParams.get('free')).toBeNull();
	await expect.poll(() => new URL(page.url()).searchParams.get('clip')).not.toBeNull();
});

test('a free-time link that nothing fits shows the playlist and names the shortest clip', async ({
	page,
	context
}) => {
	test.setTimeout(240_000);
	await standInForServices(context);
	const address = await playlistOfTwo(page);

	// 60s fits neither clip (the shortest is 2:00).
	await page.goto(`/?db=${encodeURIComponent(address)}&free=60`);
	await passConsent(page, { identity: 'anonymous' });

	const banner = page.getByTestId('free-no-fit');
	await expect(banner).toBeVisible({ timeout: 60_000 });
	await expect(banner).toContainText('2:00'); // the shortest clip's length
	// Not the cinema: the person is in the app, on the playlist.
	await expect(page.getByTestId('cinema')).toBeHidden();
});
