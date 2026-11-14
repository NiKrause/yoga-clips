import { test, expect } from '@playwright/test';
import { addClip, createPlaylist, showView, startAnonymous } from './clips.mjs';

// Practise: "how much time do you have?" suggests the longest clip that fits
// from all of a person's playlists this browser has seen, done-today ones
// last, and plays it in its own playlist's page — opening that playlist when
// it is another. The video services are stand-ins.

const SERVICES =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|google\.com|gstatic\.com|googleapis\.com)\//;

test('a suggestion that fits, from another playlist, plays there', async ({ page, context }) => {
	test.setTimeout(240_000);
	await context.route(SERVICES, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' })
	);

	await startAnonymous(page);
	await createPlaylist(page, 'Morning');
	await addClip(page, {
		url: 'https://youtu.be/aaaaaaaaaaa',
		title: 'Four minutes',
		duration: '4:00'
	});
	await addClip(page, {
		url: 'https://youtu.be/bbbbbbbbbbb',
		title: 'Twelve minutes',
		duration: '12:00'
	});
	await showView(page, 'library');
	await createPlaylist(page, 'Evening');
	await addClip(page, {
		url: 'https://youtu.be/ccccccccccc',
		title: 'Two minutes',
		duration: '2:00'
	});

	await showView(page, 'practise');
	await page.getByTestId('practise-minutes-5').click();
	await expect(page.getByTestId('practise-suggestion-title')).toHaveText('Four minutes');
	await expect(page.getByTestId('practise-also')).toContainText('Two minutes');
	await expect(page.getByTestId('practise-also')).not.toContainText('Twelve minutes');

	await page.getByTestId('practise-minutes-20').click();
	await expect(page.getByTestId('practise-suggestion-title')).toHaveText('Twelve minutes');

	// Played from Practise: Morning opens, and the clip is in its player.
	await page.getByTestId('practise-play').click();
	await expect(page.getByTestId('view-playlist')).toBeVisible({ timeout: 60_000 });
	await expect(page.getByTestId('active-playlist-name')).toContainText('Morning');
	await expect(page.getByTestId('player-title')).toHaveText('Twelve minutes');

	// Done today: next time the other fitting clip comes first.
	await page.getByTestId('player-done').click();
	await showView(page, 'practise');
	await expect(page.getByTestId('practise-suggestion-title')).toHaveText('Four minutes');
	await expect(page.getByTestId('stats-today')).toContainText('12');
});
