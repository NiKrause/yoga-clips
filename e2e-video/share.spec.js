// Scene: share a playlist by link or QR code, and a second browser opens it
// and plays a clip. Two clips: share.<lang> (the first browser) and
// share-friend.<lang> (the second, recorded into a folder of its own).
import { test, expect } from '@playwright/test';
import { passConsent } from '../e2e/consent.mjs';
import { addClip, clipCard, createPlaylist, startAnonymous } from '../e2e/clips.mjs';
import { LANG, startScene } from './brand.js';
import { clip, standIns } from './stand-ins.js';

const LINES = {
	en: {
		share: 'Sharing is a link, or its QR code.',
		reads: 'Whoever has the link sees the playlist. No account, no server in between.',
		friend: 'A second browser opens the link. The clips come straight from the other device.',
		plays: 'And plays one.'
	},
	de: {
		share: 'Teilen geht per Link oder über den QR-Code.',
		reads: 'Wer den Link hat, sieht die Playlist. Kein Konto, kein Server dazwischen.',
		friend: 'Ein zweiter Browser öffnet den Link. Die Clips kommen direkt vom anderen Gerät.',
		plays: 'Und spielt einen ab.'
	}
}[LANG];

test('share a playlist', async ({ page, context, browser }, testInfo) => {
	test.setTimeout(600_000);
	await standIns(context);
	const scene = await startScene(page, context, [LINES.share, LINES.reads]);
	await startAnonymous(page);
	await createPlaylist(page, LANG === 'de' ? 'Morgens am Schreibtisch' : 'Desk mornings');
	for (const key of /** @type {const} */ (['shoulders', 'wrists', 'side']))
		await addClip(page, clip(key));
	await page.evaluate(() => window.scrollTo(0, 0));
	scene.markStart();

	await scene.say(LINES.share, { after: 100 });
	const panel = page.getByTestId('share-panel');
	await scene.click(panel.locator('summary'));
	await expect(page.getByTestId('share-qr')).toBeVisible();
	await page.getByTestId('share-qr').scrollIntoViewIfNeeded();
	const link = ((await page.getByTestId('share-link').textContent()) ?? '').trim();
	await scene.say(LINES.reads);
	await scene.beat(1200);
	await scene.finish(testInfo, { name: `share.${LANG}` });

	// The friend: another browser, its own recording.
	const dir = `${testInfo.outputDir}-friend`;
	const friendContext = await browser.newContext({
		...testInfo.project.use,
		viewport: page.viewportSize(),
		locale: LANG === 'de' ? 'de-DE' : 'en-GB',
		recordVideo: { dir, size: page.viewportSize() ?? undefined }
	});
	try {
		await standIns(friendContext);
		const friend = await friendContext.newPage();
		const friendScene = await startScene(friend, friendContext, [LINES.friend, LINES.plays]);
		await friend.goto(link);
		await passConsent(friend, { identity: 'anonymous' });
		// The clips come from the first browser, through the local relay; making
		// that connection may take a while.
		await expect(clipCard(friend, clip('wrists').title)).toBeVisible({ timeout: 240_000 });
		await friend.evaluate(() => window.scrollTo(0, 0));
		friendScene.markStart();
		await friendScene.say(LINES.friend);
		const card = clipCard(friend, clip('wrists').title);
		await card.scrollIntoViewIfNeeded();
		await friendScene.say(LINES.plays, { after: 100 });
		await friendScene.click(card.getByTestId('clip-play'));
		await expect(friend.getByTestId('player-iframe')).toBeVisible();
		await friendScene.beat(4500);
		await friendScene.finish(testInfo, { name: `share-friend.${LANG}`, dir });
	} finally {
		await friendContext.close();
	}
});
