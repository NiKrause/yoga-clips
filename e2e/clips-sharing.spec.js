import { test, expect } from '@playwright/test';
import { passConsent } from './consent.mjs';
import { CLIP_FIELDS, SOURCES } from '../src/lib/clips/schema.js';

// The whole story in one run: Alice registers a passkey, creates a playlist,
// adds a clip and shares the address. Bob, with his own passkey in his own
// browser context, opens it, sees Alice's clip, and is refused when he adds
// one. Alice grants his DID write access; his clip goes through and Alice sees
// it. Then Alice's export is checked against the schema the yoga-break mod
// reads, and the deep link opens Bob's clip in the cinema page.

const testUrl = '/';
const timeout = 90_000;

test.describe('A shared playlist', () => {
	test('Alice shares with Bob, Bob adds a clip, the export fits the schema', async ({
		browser
	}) => {
		test.setTimeout(timeout * 5);

		const aliceContext = await browser.newContext();
		// Fullscreen is the browser's, and whether a headless one grants it,
		// and when, differs between machines: granted late, it hid "Done" from
		// the click below and the test waited out its time. Alice's browser
		// refuses it, as some do; the granted case is e2e/cinema.spec.js's.
		await aliceContext.addInitScript(() => {
			Element.prototype.requestFullscreen = function () {
				return Promise.reject(new TypeError('Fullscreen is refused in this test.'));
			};
		});
		const bobContext = await browser.newContext();
		const alice = await aliceContext.newPage();
		const bob = await bobContext.newPage();

		const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const aliceClip = {
			url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
			title: `Alice shoulder opener ${runId}`,
			teacher: 'Example Teacher A',
			duration: '5:00',
			tags: 'schultern, sitzen'
		};
		const bobClip = {
			url: `https://vimeo.com/76979871`,
			title: `Bob hip release ${runId}`,
			teacher: 'Example Teacher B',
			duration: '8',
			tags: 'hüfte'
		};

		try {
			await Promise.all([addVirtualAuthenticator(alice), addVirtualAuthenticator(bob)]);

			// 1. Alice: passkey, playlist, first clip.
			await openReadyAppWithNewPasskey(alice, { label: 'Alice' });
			await createPlaylist(alice, 'Morning shoulders');
			await addClipOk(alice, aliceClip);
			const address = await getActivePlaylistAddress(alice);

			// 2. Bob: own passkey, opens Alice's playlist by address, sees her clip.
			await openReadyAppWithNewPasskey(bob, { label: 'Bob' });
			await openPlaylistByAddress(bob, address);
			const bobDid = await getOwnDid(bob);
			await expectClip(bob, aliceClip.title);

			// 3. Bob may read but not write.
			await addClipExpectDenied(bob, bobClip);
			await expectNoClip(bob, bobClip.title);
			await expectNoClip(alice, bobClip.title);

			// 4. Alice lets Bob in; his retry goes through, and reaches Alice.
			await grantWriteAccess(alice, bobDid);
			await addClipOk(bob, bobClip);
			await expectClip(alice, bobClip.title);
			await expectClip(bob, aliceClip.title);

			// 5. Alice's export is the file the mod reads.
			const exported = await readExport(alice);
			expect(Object.keys(exported)).toEqual(['clips']);
			expect(exported.clips).toHaveLength(2);
			for (const clip of exported.clips) {
				expect(Object.keys(clip)).toEqual([...CLIP_FIELDS]);
				expect(SOURCES).toContain(clip.source);
				expect(typeof clip.durationSec).toBe('number');
				expect(Array.isArray(clip.tags)).toBe(true);
				expect(new Date(clip.addedAt).toISOString()).toBe(clip.addedAt);
				expect(clip.addedBy).toMatch(/^did:/);
			}
			const bobsExported = exported.clips.find((clip) => clip.title === bobClip.title);
			expect(bobsExported).toMatchObject({
				source: 'vimeo',
				durationSec: 480,
				tags: ['hüfte'],
				addedBy: bobDid
			});
			const alicesExported = exported.clips.find((clip) => clip.title === aliceClip.title);
			expect(alicesExported).toMatchObject({
				source: 'youtube',
				url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				durationSec: 300,
				tags: ['schultern', 'sitzen']
			});

			// 6. The deep link the mod uses opens the clip in the cinema page,
			//    and the press on its start control loads the player.
			await alice.goto(`/?clip=${bobsExported.id}`);
			await passConsent(alice, { identity: 'existing' });
			await expect(alice.getByTestId('cinema-start')).toBeVisible({ timeout });
			await expect(alice.getByTestId('cinema-title')).toHaveText(bobClip.title);
			await alice.getByTestId('cinema-start').click();
			await expect(alice.getByTestId('player-iframe')).toHaveAttribute(
				'src',
				/^https:\/\/player\.vimeo\.com\/video\/76979871/
			);

			// The press also asked for fullscreen, which Alice's browser refuses
			// (see above): the clip stays on the page, next to "Done".
			await expect(alice.getByTestId('cinema')).toHaveAttribute('data-fullscreen', 'false');

			// 7. Done marks are local: Alice marks Bob's clip done and, back in
			//    the playlist, the minutes show up — for her only.
			await alice.getByTestId('cinema-done').click();
			await alice.getByTestId('cinema-back').click();
			await expect(alice.getByTestId('stats-today')).toContainText('8');
			await expect(bob.getByTestId('stats-today')).toContainText('0');
		} finally {
			await bobContext.close();
			await aliceContext.close();
		}
	});
});

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

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ label: string }} identity
 */
async function openReadyAppWithNewPasskey(page, { label }) {
	await page.goto(testUrl);
	await passConsent(page, { identity: 'create', label });
	await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function createPlaylist(page, name) {
	await page.getByTestId('new-playlist-name').fill(name);
	await page.getByTestId('new-playlist-create').click();
	// The permissions panel only renders for access-controlled playlists —
	// which is all of them here.
	await expect(page.getByTestId('permissions-panel')).toBeVisible({ timeout });
	await expect(page.getByTestId('active-playlist-name')).toContainText(name);
}

/** @param {import('@playwright/test').Page} page */
async function getOwnDid(page) {
	// The identity sits behind the connection point (NiKrause/yoga-clips#1, step 3).
	await page.getByTestId('connection-point').click();
	const badge = page.getByTestId('own-did-value');
	await expect(badge).toBeVisible({ timeout });
	const did = await badge.getAttribute('data-did');
	await page.getByTestId('connection-sheet-close').click();
	if (!did) throw new Error('own DID badge has no data-did');
	return did;
}

/** @param {import('@playwright/test').Page} page */
async function getActivePlaylistAddress(page) {
	// Inside a collapsed <details>, so read the text rather than require visibility.
	const el = page.getByTestId('active-playlist-address');
	await expect
		.poll(async () => ((await el.textContent()) ?? '').trim(), { timeout })
		.toMatch(/^\/orbitdb\//);
	return ((await el.textContent()) ?? '').trim();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} address
 */
async function openPlaylistByAddress(page, address) {
	await page.getByTestId('open-playlist-input').fill(address);
	await page.getByTestId('open-playlist-button').click();
	const el = page.getByTestId('active-playlist-address');
	await expect.poll(async () => ((await el.textContent()) ?? '').trim(), { timeout }).toBe(address);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} did
 */
async function grantWriteAccess(page, did) {
	await page.getByTestId('permissions-panel').locator('summary').click();
	await page.getByTestId('permission-did-input').fill(did);
	await page.getByTestId('permission-add').click();
	await expect(page.locator(`[data-testid="permission-entry"][data-did="${did}"]`)).toBeVisible({
		timeout
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ url: string, title: string, teacher: string, duration: string, tags: string }} clip
 */
async function fillClip(page, clip) {
	await page.getByTestId('clip-url').fill(clip.url);
	// oEmbed may fill the title from the network; what the test types wins.
	await page.getByTestId('clip-title').fill(clip.title);
	await page.getByTestId('clip-teacher').fill(clip.teacher);
	await page.getByTestId('clip-duration').fill(clip.duration);
	await page.getByTestId('clip-tags').fill(clip.tags);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ url: string, title: string, teacher: string, duration: string, tags: string }} clip
 */
async function addClipOk(page, clip) {
	await fillClip(page, clip);
	await page.getByTestId('clip-add').click();
	await expectClip(page, clip.title);
}

/**
 * A denied write must raise a visible error and NOT render the clip.
 * @param {import('@playwright/test').Page} page
 * @param {{ url: string, title: string, teacher: string, duration: string, tags: string }} clip
 */
async function addClipExpectDenied(page, clip) {
	await fillClip(page, clip);
	await page.getByTestId('clip-add').click();
	// The refusal in the words people use (NiKrause/yoga-clips#1, step 3).
	await expect(page.getByTestId('clip-error')).toContainText(
		/may not add clips|darfst .* keine Clips/,
		{
			timeout
		}
	);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
async function expectClip(page, title) {
	await expect(page.getByTestId('clip-card-title').filter({ hasText: title })).toBeVisible({
		timeout
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
async function expectNoClip(page, title) {
	// Give replication a moment, then assert absence.
	await page.waitForTimeout(3000);
	await expect(page.getByTestId('clip-card-title').filter({ hasText: title })).toHaveCount(0);
}

/**
 * Click the export button and parse the file it hands the browser.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ clips: Record<string, any>[] }>}
 */
async function readExport(page) {
	const downloadPromise = page.waitForEvent('download');
	await page.getByTestId('export-clips').click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('clips.json');
	const stream = await download.createReadStream();
	const chunks = [];
	for await (const chunk of stream) chunks.push(chunk);
	return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
