// Scene: connect the playlist to Claude — export clips.json, and give the
// yoga-break mod the playlist's link. The panel shows both steps.
import { test, expect } from '@playwright/test';
import { addClip, createPlaylist, startAnonymous } from '../e2e/clips.mjs';
import { LANG, startScene } from './brand.js';
import { clip, standIns } from './stand-ins.js';

const LINES = {
	en: {
		connect: 'Two steps connect the playlist to Claude.',
		export: 'Export clips.json, and put the file into the folder dot yoga in your home.',
		link: 'Then give the mod the playlist’s link: slash yoga playlist, and the link.',
		then: 'From then on, a long wait in Claude brings a clip from your own playlist.'
	},
	de: {
		connect: 'Mit Claude verbindest du die Playlist in zwei Schritten.',
		export: 'Exportiere clips.json und leg die Datei in den Ordner Punkt yoga in deinem Home.',
		link: 'Dann gib dem Mod den Link der Playlist: Schrägstrich yoga playlist, und der Link.',
		then: 'Ab dann bringt eine lange Wartezeit in Claude einen Clip aus deiner Playlist.'
	}
}[LANG];

test('connect the playlist to Claude', async ({ page, context }, testInfo) => {
	await standIns(context);
	const scene = await startScene(page, context, LINES);
	await startAnonymous(page);
	await createPlaylist(page, LANG === 'de' ? 'Morgens am Schreibtisch' : 'Desk mornings');
	for (const key of /** @type {const} */ (['shoulders', 'wrists'])) await addClip(page, clip(key));
	const panel = page.getByTestId('transfer-panel');
	await panel.scrollIntoViewIfNeeded();
	await page.evaluate(() =>
		document.querySelector('[data-testid="transfer-panel"]')?.scrollIntoView({ block: 'center' })
	);
	scene.markStart();

	await scene.say(LINES.connect);
	await scene.say(LINES.export, { after: 100 });
	const download = page.waitForEvent('download');
	await scene.click(page.getByTestId('export-clips'));
	expect((await download).suggestedFilename()).toBe('clips.json');
	await scene.beat(600);
	await page.getByTestId('yoga-break-playlist-command').scrollIntoViewIfNeeded();
	await scene.say(LINES.link, { after: 100 });
	await scene.click(page.getByTestId('yoga-break-copy-playlist'));
	await scene.say(LINES.then);
	await scene.beat(1500);
	await scene.finish(testInfo);
});
