import { test, expect } from '@playwright/test';
import { passConsent } from './consent.mjs';
import { addClip, clipCard, createPlaylist, showView } from './clips.mjs';

// A clip goes from one of a person's playlists into another, as a copy or
// as a move (NiKrause/yoga-clips#12). Offered is every other playlist the
// person can write to, never the one the clip is in. A copy leaves the
// source as it is; a move takes the clip out of it once it is in the
// target; a clip the target has is not written twice. Both lists are as
// they should be after a reload too. The video services are stand-ins.

const SERVICES =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|google\.com|gstatic\.com|googleapis\.com)\//;
const timeout = 90_000;

/**
 * A playlist's page, reached from the library by the playlist's name.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function openPlaylistNamed(page, name) {
	await showView(page, 'library');
	await page.locator('[data-testid="playlist-switcher-open"]', { hasText: name }).click();
	await expect(page.getByTestId('view-playlist')).toBeVisible({ timeout });
	await expect(page.getByTestId('active-playlist-name')).toContainText(name, { timeout });
}

/**
 * The titles of the open playlist's clips, as listed.
 * @param {import('@playwright/test').Page} page
 */
const titles = (page) => page.getByTestId('view-playlist').getByTestId('clip-card-title');

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
const tile = (page, name) =>
	page.locator('[data-testid="playlist-switcher-open"]', { hasText: name });

test('a clip is copied and another moved between two own playlists', async ({ page, context }) => {
	test.setTimeout(360_000);
	await context.route(SERVICES, (route) =>
		route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in</title>' })
	);

	await page.goto('/');
	await passConsent(page, { identity: 'anonymous', remember: true });
	await expect(page.getByTestId('new-playlist-create')).toBeVisible({ timeout });

	const evening = await createPlaylist(page, 'Evening');
	await addClip(page, {
		url: 'https://youtu.be/ccccccccccc',
		title: 'Evening stretch',
		teacher: 'Example Teacher',
		duration: '4:00'
	});
	// One playlist only: there is nowhere for a clip to go, and no such action.
	await expect(clipCard(page, 'Evening stretch').getByTestId('clip-move-copy')).toHaveCount(0);

	await showView(page, 'library');
	const morning = await createPlaylist(page, 'Morning');
	const shoulderId = await addClip(page, {
		url: 'https://youtu.be/aaaaaaaaaaa',
		title: 'Shoulder opener',
		teacher: 'Example Teacher',
		duration: '5:00',
		tags: 'shoulders'
	});
	const neckId = await addClip(page, {
		url: 'https://youtu.be/bbbbbbbbbbb',
		title: 'Neck release',
		teacher: 'Another Teacher',
		duration: '5:00'
	});
	await expect(titles(page)).toHaveText(['Neck release', 'Shoulder opener']);

	// Copy: the other playlist is offered, this one is not.
	const dialog = page.getByTestId('move-copy-dialog');
	await clipCard(page, 'Shoulder opener').getByTestId('clip-move-copy').click();
	await expect(dialog.getByTestId('move-copy-clip')).toHaveText('Shoulder opener');
	const target = dialog.getByTestId('move-copy-target');
	await expect(target).toHaveCount(1, { timeout: 30_000 });
	await expect(target).toHaveAttribute('data-address', evening);
	await expect(dialog.getByTestId('move-copy-checking')).toHaveCount(0);
	await expect(target).toBeChecked();
	await dialog.getByTestId('move-copy-copy').click();
	await expect(page.getByText('Copied to “Evening”')).toBeVisible({ timeout: 30_000 });
	await expect(dialog).not.toHaveAttribute('open');
	// The source is as it was.
	await expect(titles(page)).toHaveText(['Neck release', 'Shoulder opener']);

	// Once more: the target has it, and nothing is written.
	await clipCard(page, 'Shoulder opener').getByTestId('clip-move-copy').click();
	await expect(target).toBeChecked({ timeout: 30_000 });
	await dialog.getByTestId('move-copy-copy').click();
	await expect(dialog.getByTestId('move-copy-problem')).toHaveText(
		'“Evening” already has this clip. Nothing was written.'
	);
	await dialog.getByTestId('move-copy-cancel').click();
	await expect(dialog).not.toHaveAttribute('open');

	// Move: into the target, and out of here.
	await clipCard(page, 'Neck release').getByTestId('clip-move-copy').click();
	await expect(target).toBeChecked({ timeout: 30_000 });
	await dialog.getByTestId('move-copy-move').click();
	await expect(page.getByText('Moved to “Evening”')).toBeVisible({ timeout: 30_000 });
	await expect(titles(page)).toHaveText(['Shoulder opener']);

	// The library says so without Evening having been opened since.
	await showView(page, 'library');
	await expect(tile(page, 'Evening')).toContainText('3 clips · 14 min');
	await expect(tile(page, 'Morning')).toContainText('1 clip · 5 min');

	// Evening: its own clip, and the two that came, newest first. They are
	// the same clips: the ids are the ones they had in Morning.
	await openPlaylistNamed(page, 'Evening');
	await expect(titles(page)).toHaveText(['Neck release', 'Shoulder opener', 'Evening stretch']);
	await expect(clipCard(page, 'Shoulder opener')).toHaveAttribute('data-clip-id', shoulderId);
	await expect(clipCard(page, 'Neck release')).toHaveAttribute('data-clip-id', neckId);
	await expect(clipCard(page, 'Neck release').getByTestId('clip-card-teacher')).toHaveText(
		'Another Teacher'
	);
	// From here the only place to go is Morning.
	await clipCard(page, 'Evening stretch').getByTestId('clip-move-copy').click();
	await expect(target).toHaveAttribute('data-address', morning, { timeout: 30_000 });
	await dialog.getByTestId('move-copy-cancel').click();

	// After a reload both playlists are as they were left.
	await page.reload();
	await expect(tile(page, 'Evening')).toBeAttached({ timeout });
	await openPlaylistNamed(page, 'Evening');
	await expect(titles(page)).toHaveText(['Neck release', 'Shoulder opener', 'Evening stretch'], {
		timeout
	});
	await openPlaylistNamed(page, 'Morning');
	await expect(titles(page)).toHaveText(['Shoulder opener'], { timeout });
});
