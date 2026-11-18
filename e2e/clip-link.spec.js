import { test, expect } from '@playwright/test';
import { isConsentOpen, passConsent, waitForConsent } from './consent.mjs';
import { addClip, createPlaylist } from './clips.mjs';

// A clip link that carries its clip — `url`, `title`, `teacher`, `sec`, as the
// yoga-break mod sends it — plays without the app starting. The cinema page
// is built from the link: no notice, no identity, no relay, no database, and
// no request to anyone but this app's own host until the start control is
// pressed. The press loads the player from the clip's service. "To the
// library" starts the app, with the notice, and keeps the playlist the link
// named. A plain clip link whose clip is not in the playlist says so.
//
// The services are stand-ins, as in cinema.spec.js.

const VIDEO = 'dQw4w9WgXcQ';
const ADDRESS = '/orbitdb/zdpuAzyoga000000000000000000000000000000000000000';
const SERVICES =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|ggpht\.com|google\.com|gstatic\.com|googleapis\.com|vimeo\.com|vimeocdn\.com|instagram\.com|cdninstagram\.com)\//;

/** @param {Record<string, string>} params */
const clipLink = (params) => `/?${new URLSearchParams(params)}`;

const MOD_LINK = clipLink({
	db: ADDRESS,
	clip: 'clip-0001',
	url: `https://youtu.be/${VIDEO}`,
	title: 'Shoulder opener',
	teacher: 'Example Teacher',
	sec: '300'
});

/**
 * Everything this page asks of anyone but its own host, and every socket it
 * opens. The services answer with a stand-in.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} origin
 */
async function watchTheWire(page, context, origin) {
	/** @type {string[]} */
	const elsewhere = [];
	/** @type {string[]} */
	const sockets = [];
	await context.route(SERVICES, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' })
	);
	context.on('request', (request) => {
		const url = request.url();
		if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return;
		elsewhere.push(url);
	});
	page.on('websocket', (socket) => sockets.push(socket.url()));
	return { elsewhere, sockets };
}

test('a clip link from the mod plays without the app: no notice, nobody asked before the press', async ({
	page,
	context,
	baseURL
}) => {
	const origin = new URL(String(baseURL)).origin;
	const wire = await watchTheWire(page, context, origin);

	await page.goto(MOD_LINK);
	const start = page.getByTestId('cinema-start');
	await expect(start).toBeVisible();
	await expect(start).toBeFocused();
	await expect(page.getByTestId('cinema-title')).toHaveText('Shoulder opener');
	await expect(page.getByTestId('cinema-line')).toHaveText('Example Teacher · 5:00 · YouTube');
	await expect(page.getByTestId('cinema-contacts')).toContainText('www.youtube-nocookie.com');
	// No identity in this browser: "Done" is the mod's.
	await expect(page.getByTestId('cinema-done-by-mod')).toBeVisible();
	await expect(page.getByTestId('cinema-done')).toHaveCount(0);

	// Time for anything that would start by itself to have started.
	await page.waitForTimeout(3000);
	expect(await isConsentOpen(page)).toBe(false);
	expect(wire.elsewhere).toEqual([]);
	expect(wire.sockets).toEqual([]);
	await expect(page.locator('iframe')).toHaveCount(0);
	// Nothing was set up: no keystore, no blocks, no database.
	expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).toEqual(
		[]
	);

	await start.click();
	const frame = page.getByTestId('player-iframe');
	await expect(frame).toBeVisible();
	expect(new URL(String(await frame.getAttribute('src'))).hostname).toBe(
		'www.youtube-nocookie.com'
	);
	await expect(page.getByTestId('cinema-contacts')).toHaveCount(0);
	await expect
		.poll(() => wire.elsewhere.map((url) => new URL(url).hostname))
		.toContain('www.youtube-nocookie.com');
	expect(
		wire.elsewhere.filter((url) => new URL(url).hostname !== 'www.youtube-nocookie.com')
	).toEqual([]);
	expect(wire.sockets).toEqual([]);

	// The way back leads into the app: the notice first, the playlist kept.
	// Out of fullscreen first, as a person would be; the stand-in never ends.
	await page.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null));
	await expect(page.getByTestId('cinema')).toHaveAttribute('data-fullscreen', 'false');
	await expect(page.getByTestId('cinema-back')).toHaveText('To the library');
	await page.getByTestId('cinema-back').click();
	await waitForConsent(page);
	await expect(page.getByTestId('cinema')).toHaveCount(0);
	const after = new URL(page.url());
	expect([...after.searchParams.keys()]).toEqual(['db']);
	expect(after.searchParams.get('db')).toBe(ADDRESS);
});

test('a clip link from the mod counts "Done" where this browser has an identity, still without starting', async ({
	page,
	context,
	baseURL
}) => {
	test.setTimeout(180_000);
	// The app once, with the notice remembered: an identity exists here.
	await page.goto('/');
	await passConsent(page, { identity: 'anonymous', remember: true });
	await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout: 90_000 });
	const identity = await page.evaluate(() => localStorage.getItem('yogaClips.lastIdentity'));
	expect(identity).toBeTruthy();

	const origin = new URL(String(baseURL)).origin;
	const fresh = await context.newPage();
	// The first page is closed before the wire is watched: the watch covers the
	// whole context, and that page's own relay health check could otherwise
	// land in it while the page is still open.
	await page.close();
	const wire = await watchTheWire(fresh, context, origin);

	await fresh.goto(MOD_LINK);
	await expect(fresh.getByTestId('cinema-start')).toBeVisible();
	await fresh.getByTestId('cinema-done').click();
	await expect(fresh.getByTestId('cinema-done-today')).toBeVisible();
	const log = await fresh.evaluate(
		(id) => JSON.parse(localStorage.getItem(`yogaClips.done.${id}`) ?? '{}'),
		identity
	);
	expect(Object.keys(log)).toEqual(['clip-0001']);

	await fresh.waitForTimeout(2000);
	expect(await isConsentOpen(fresh)).toBe(false);
	expect(wire.elsewhere).toEqual([]);
	expect(wire.sockets).toEqual([]);
});

test('without a valid url a clip link is an ordinary one: the notice comes first', async ({
	page
}) => {
	for (const url of ['javascript:alert(1)', `http://youtu.be/${VIDEO}`]) {
		await page.goto(clipLink({ clip: 'clip-0001', url, title: 'Not this way' }));
		await waitForConsent(page);
		await expect(page.getByTestId('cinema-start')).toHaveCount(0);
	}
});

test('a plain clip link naming a clip that is not in the playlist says so, and leads to the playlist', async ({
	page,
	context
}) => {
	test.setTimeout(240_000);
	await context.route(SERVICES, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' })
	);
	await page.goto('/');
	await passConsent(page, { identity: 'anonymous', remember: true });
	await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout: 90_000 });
	const address = await createPlaylist(page, 'Morning');
	await addClip(page, {
		url: `https://youtu.be/${VIDEO}`,
		title: 'Shoulder opener',
		teacher: 'Example Teacher',
		duration: '5:00'
	});

	// A clip the yoga-break mod knows from its own file, never added here.
	await page.goto(clipLink({ db: address, clip: 'clip-not-here-0001' }));
	await expect(page.getByTestId('cinema-waiting')).toBeVisible();
	const missing = page.getByTestId('cinema-missing');
	await expect(missing).toBeVisible({ timeout: 60_000 });
	await expect(missing).toContainText('This clip is not in the playlist');
	await expect(page.getByTestId('cinema-start')).toHaveCount(0);

	await page.getByTestId('cinema-back').click();
	await expect(page.getByTestId('cinema')).toHaveCount(0);
	await expect(page.getByTestId('active-playlist-name')).toContainText('Morning');
	expect(new URL(page.url()).searchParams.get('clip')).toBeNull();
});
