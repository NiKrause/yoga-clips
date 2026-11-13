import { test, expect } from '@playwright/test';
import { passConsent } from './consent.mjs';
import { addClip, createPlaylist, startAnonymous } from './clips.mjs';

// A `?clip=<id>` link opens the cinema page: the clip alone on a dark page.
// Nothing is asked of the clip's service before the start control is
// pressed; the press loads the player. The player saying the clip is over,
// and Escape, come back to the page and then to the playlist.
//
// The services are stand-ins here. The one for YouTube's player behaves as
// the player does towards its embedder: it reports once greeted, plays, and
// ends. Fullscreen and sound are the browser's and are not judged here —
// under automation they behave differently from a person's press.

const VIDEO = 'dQw4w9WgXcQ';
const SERVICES =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|ggpht\.com|google\.com|gstatic\.com|googleapis\.com|vimeo\.com|vimeocdn\.com|instagram\.com|cdninstagram\.com)\//;

const PLAYER_STAND_IN = `<!doctype html><title>player stand-in</title><p>player stand-in</p><script>
	let greeted = false;
	addEventListener('message', (event) => {
		let message;
		try { message = JSON.parse(event.data); } catch { return; }
		if (message.event !== 'listening' || greeted) return;
		greeted = true;
		const report = (info) => parent.postMessage(JSON.stringify({ event: 'infoDelivery', info }), '*');
		report({ playerState: 1 });
		if (new URLSearchParams(location.search).get('autoplay') === '1') {
			setTimeout(() => report({ playerState: 0 }), 1500);
		}
	});
</script>`;

/**
 * Every request to a video service is answered by a stand-in and written
 * down.
 *
 * @param {import('@playwright/test').BrowserContext} context
 */
async function standInForServices(context) {
	/** @type {string[]} */
	const asked = [];
	await context.route(SERVICES, (route) => {
		const url = route.request().url();
		asked.push(url);
		const player = new URL(url).hostname === 'www.youtube-nocookie.com';
		return route.fulfill({
			contentType: 'text/html',
			body: player ? PLAYER_STAND_IN : '<!doctype html><title>stand-in</title>'
		});
	});
	return asked;
}

test('a clip link opens the cinema: nothing asked before the press, the player after', async ({
	page,
	context
}) => {
	test.setTimeout(300_000);
	const asked = await standInForServices(context);

	await startAnonymous(page);
	await createPlaylist(page, 'Cinema');
	const id = await addClip(page, {
		url: `https://youtu.be/${VIDEO}`,
		title: 'Shoulder opener',
		teacher: 'Example Teacher',
		duration: '5:00'
	});

	// The link the yoga-break mod opens.
	asked.length = 0;
	await page.goto(`/?clip=${id}`);
	await passConsent(page, { identity: 'anonymous' });

	const cinema = page.getByTestId('cinema');
	const start = page.getByTestId('cinema-start');
	await expect(start).toBeVisible({ timeout: 90_000 });
	await expect(start).toBeFocused();
	await expect(page.getByTestId('cinema-title')).toHaveText('Shoulder opener');
	await expect(page.getByTestId('cinema-line')).toHaveText('Example Teacher · 5:00 · YouTube');

	// Only the clip: the list is not there, and neither is its player dialog.
	await expect(page.getByRole('main')).toBeHidden();
	await expect(page.getByTestId('clip-card')).toHaveCount(0);
	await expect(page.getByTestId('player-dialog')).toBeHidden();
	// Dark, and its title white on it, whatever the theme.
	for (const dark of [false, true]) {
		await page.evaluate((on) => document.documentElement.classList.toggle('dark', on), dark);
		expect(await cinema.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
			'rgb(0, 0, 0)'
		);
		expect(
			await page.getByTestId('cinema-title').evaluate((element) => getComputedStyle(element).color)
		).toBe('rgb(255, 255, 255)');
	}

	// The cinema is up and no video service has heard of it.
	expect(asked).toEqual([]);
	await expect(page.locator('iframe')).toHaveCount(0);

	await start.click();

	const frame = page.getByTestId('player-iframe');
	await expect(frame).toHaveAttribute(
		'src',
		new RegExp(
			`^https://www\\.youtube-nocookie\\.com/embed/${VIDEO}\\?autoplay=1&rel=0&enablejsapi=1&origin=`
		)
	);
	await expect(cinema).toHaveAttribute('data-started', 'true');
	await expect(
		page.frameLocator('[data-testid="player-iframe"]').getByText('player stand-in')
	).toBeVisible();
	expect(asked.length).toBe(1);
	expect(asked[0]).toContain(`https://www.youtube-nocookie.com/embed/${VIDEO}?`);

	// The player says the clip is over: still the cinema, out of fullscreen,
	// and "Done" has the focus.
	const done = page.getByTestId('cinema-done');
	await expect(done).toBeFocused({ timeout: 15_000 });
	await expect(cinema).toHaveAttribute('data-fullscreen', 'false');
	await expect(cinema).toBeVisible();
	await done.click();
	await expect(page.getByTestId('cinema-done-today')).toBeVisible();

	// Escape leaves, to the playlist and to an address that does not come back.
	// (Not within the moment after leaving fullscreen, in which the cinema
	// takes an Escape for the one that left it.)
	await page.waitForTimeout(300);
	await page.getByTestId('cinema-back').focus();
	await page.keyboard.press('Escape');
	await expect(cinema).toHaveCount(0);
	await expect(page.getByRole('main')).toBeVisible();
	await expect(page.getByTestId('clip-card')).toHaveCount(1);
	await expect(page.getByTestId('stats-today')).toContainText('5');
	expect(new URL(page.url()).searchParams.has('clip')).toBe(false);
});

test('a clip link to a clip that is not there says so in the cinema', async ({ page, context }) => {
	test.setTimeout(240_000);
	const asked = await standInForServices(context);

	await page.goto('/?clip=clipThatIsNotHere');
	await expect(page.getByTestId('cinema')).toBeVisible();
	await passConsent(page, { identity: 'anonymous' });

	await expect(page.getByTestId('cinema-waiting')).toBeVisible({ timeout: 90_000 });
	await expect(page.getByTestId('cinema-missing')).toBeVisible({ timeout: 60_000 });
	await expect(page.getByTestId('cinema-start')).toHaveCount(0);
	expect(asked).toEqual([]);

	await page.getByTestId('cinema-back').click();
	await expect(page.getByTestId('cinema')).toHaveCount(0);
	await expect(page.getByRole('main')).toBeVisible();
});
