// Scene: make a playlist and add a clip by its link; title, teacher and
// length fill themselves in. Narrated in English or, with DEMO_LANG=de, in
// German. The clip and its service are stand-ins (stand-ins.js).
import { test, expect } from '@playwright/test';
import { startAnonymous } from '../e2e/clips.mjs';
import { LANG, startScene } from './brand.js';
import { CLIPS, clipUrl, standIns } from './stand-ins.js';

const LINES = {
	en: {
		make: 'Your own playlist: give it a name and create it.',
		link: 'A clip comes in by its link.',
		filled: 'Title, teacher and length come from the video itself.',
		tags: 'A few tags, add it, and it is in the playlist.'
	},
	de: {
		make: 'Deine eigene Playlist: Namen geben und anlegen.',
		link: 'Ein Clip kommt über seinen Link dazu.',
		filled: 'Titel, Lehrerin und Länge kommen vom Video selbst.',
		tags: 'Ein paar Tags, hinzufügen, und er ist in der Playlist.'
	}
}[LANG];

test('playlist and a clip', async ({ page, context }, testInfo) => {
	await standIns(context);
	const scene = await startScene(page, context, LINES);
	await startAnonymous(page);
	scene.markStart();

	await scene.say(LINES.make, { after: 150 });
	await scene.type(
		page.getByTestId('new-playlist-name'),
		LANG === 'de' ? 'Morgens am Schreibtisch' : 'Desk mornings'
	);
	await scene.click(page.getByTestId('new-playlist-create'));
	await expect(page.getByTestId('active-playlist-name')).toBeVisible({ timeout: 60_000 });

	await page.getByTestId('add-clip').scrollIntoViewIfNeeded();
	await scene.say(LINES.link, { after: 150 });
	await scene.type(page.getByTestId('clip-url'), clipUrl('shoulders'), { delay: 18 });
	await expect(page.getByTestId('clip-duration')).toHaveValue('5:00', { timeout: 20_000 });
	await scene.say(LINES.filled);
	await scene.type(page.getByTestId('clip-tags'), CLIPS.shoulders.tags[LANG]);
	await scene.say(LINES.tags, { after: 100 });
	await scene.click(page.getByTestId('clip-add'));
	const card = page.getByTestId('clip-card');
	await expect(card).toHaveCount(1, { timeout: 30_000 });
	await card.scrollIntoViewIfNeeded();
	await scene.beat(2500);
	await scene.finish(testInfo);
});
