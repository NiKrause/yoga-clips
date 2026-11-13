// Scene: the link the yoga-break mod opens, a clip in the cinema page: one
// press starts it, it ends, "Done" counts the minutes.
import { test, expect } from '@playwright/test';
import { passConsent } from '../e2e/consent.mjs';
import { addClip, createPlaylist, startAnonymous } from '../e2e/clips.mjs';
import { LANG, startScene } from './brand.js';
import { clip, standIns } from './stand-ins.js';

const LINES = {
	en: {
		open: 'The mod opens the clip in Yoga Clips: only the video, on a dark page.',
		start: 'One press on Start, and it plays, as large as the screen allows.',
		end: 'When it ends, you are back here. Done counts your minutes.'
	},
	de: {
		open: 'Der Mod öffnet den Clip in Yoga Clips: nur das Video, auf dunklem Grund.',
		start: 'Ein Druck auf Starten, und er läuft, so groß wie der Bildschirm.',
		end: 'Ist er zu Ende, bist du wieder hier. Absolviert zählt deine Minuten.'
	}
}[LANG];

test('a clip link in the cinema', async ({ page, context }, testInfo) => {
	await standIns(context);
	// Fullscreen in a headless browser shrinks what the recorder sees to a
	// corner of the frame. Refused, the cinema fills the page instead — in a
	// 16:9 film the same picture.
	await context.addInitScript(() => {
		Element.prototype.requestFullscreen = () =>
			Promise.reject(new TypeError('No fullscreen in the recording.'));
	});
	const scene = await startScene(page, context, LINES);
	await startAnonymous(page);
	await createPlaylist(page, LANG === 'de' ? 'Morgens am Schreibtisch' : 'Desk mornings');
	const id = await addClip(page, clip('shoulders'));

	await page.goto(`/?clip=${id}`);
	await passConsent(page, { identity: 'anonymous' });
	// The caption bar sits over the page's foot; the cinema leaves it room.
	await page.addStyleTag({
		content: `[data-testid="cinema"] { bottom: ${Math.round(96 * scene.scale)}px !important; }`
	});
	const start = page.getByTestId('cinema-start');
	await expect(start).toBeVisible({ timeout: 90_000 });
	scene.markStart();

	await scene.say(LINES.open);
	await scene.say(LINES.start, { after: 100 });
	await scene.click(start);
	await expect(page.getByTestId('cinema')).toHaveAttribute('data-started', 'true');
	// The stand-in plays for a few seconds and says it is over.
	const done = page.getByTestId('cinema-done');
	await expect(done).toBeFocused({ timeout: 30_000 });
	await scene.beat(600);
	await scene.say(LINES.end, { after: 100 });
	await scene.click(done);
	await expect(page.getByTestId('cinema-done-today')).toBeVisible();
	await scene.beat(2200);
	await scene.finish(testInfo);
});
