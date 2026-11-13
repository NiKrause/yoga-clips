/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { page, userEvent } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ClipCinema from './ClipCinema.svelte';

// The cinema page before its start control is pressed, which is all of it
// that contacts nobody. What the press does is in e2e/cinema.spec.js, where
// the player is a stand-in.

/** @param {Partial<import('./clips/schema.js').Clip>} [fields] */
const clip = (fields = {}) =>
	/** @type {import('./clips/schema.js').Clip} */ ({
		id: 'clip_example01',
		url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		source: 'youtube',
		title: 'Shoulder opener',
		teacher: 'Example Teacher',
		durationSec: 300,
		tags: [],
		addedBy: 'did:key:example',
		addedAt: '2026-11-13T00:00:00.000Z',
		...fields
	});

describe('ClipCinema', () => {
	it('waits for the clip, and says when it did not turn up', async () => {
		const view = render(ClipCinema, { clip: null });
		await expect.element(page.getByTestId('cinema-waiting')).toBeVisible();
		await expect.element(page.getByTestId('cinema-back')).toBeVisible();
		expect(document.querySelector('iframe')).toBeNull();

		await view.rerender({ clip: null, missing: true });
		await expect
			.element(page.getByTestId('cinema-missing'))
			.toHaveTextContent('The clip the link points to is not in this playlist.');

		await view.rerender({ clip: null, missing: false, failure: 'The app could not start.' });
		await expect
			.element(page.getByTestId('cinema-missing'))
			.toHaveTextContent('The app could not start.');
	});

	it('shows one start control with the focus on it, and frames nothing yet', async () => {
		render(ClipCinema, { clip: clip() });
		const start = page.getByTestId('cinema-start');
		await expect.element(start).toHaveFocus();
		await expect.element(start).toHaveAccessibleName('Start Shoulder opener in fullscreen');
		await expect.element(page.getByTestId('cinema-title')).toHaveTextContent('Shoulder opener');
		await expect
			.element(page.getByTestId('cinema-line'))
			.toHaveTextContent('Example Teacher · 5:00 · YouTube');
		await expect.element(page.getByTestId('cinema')).toHaveAttribute('data-started', 'false');
		expect(document.querySelector('iframe')).toBeNull();
	});

	it('marks done, shows a mark made today, and leaves on Escape or the way back', async () => {
		/** @type {string[]} */
		const happened = [];
		const view = render(ClipCinema, {
			clip: clip(),
			ondone: (/** @type {{ id: string }} */ done) => happened.push(`done ${done.id}`),
			onleave: () => happened.push('leave')
		});
		await page.getByTestId('cinema-done').click();
		expect(happened).toEqual(['done clip_example01']);

		await view.rerender({ clip: clip(), doneToday: true });
		await expect.element(page.getByTestId('cinema-done-today')).toBeVisible();
		expect(document.querySelector('[data-testid="cinema-done"]')).toBeNull();

		await userEvent.keyboard('{Escape}');
		await page.getByTestId('cinema-back').click();
		expect(happened).toEqual(['done clip_example01', 'leave', 'leave']);
	});

	it('offers the way out instead of a start for a link no player can frame', async () => {
		render(ClipCinema, {
			clip: clip({ url: 'https://example.com/video/1', source: 'other' })
		});
		await expect
			.element(page.getByTestId('cinema-open-external'))
			.toHaveAttribute('href', 'https://example.com/video/1');
		expect(document.querySelector('[data-testid="cinema-start"]')).toBeNull();
		expect(document.querySelector('iframe')).toBeNull();
	});

	it('keeps Instagram’s way out and its one line beside the start', async () => {
		render(ClipCinema, {
			clip: clip({ url: 'https://www.instagram.com/reel/C0dEexample/', source: 'instagram' })
		});
		await expect.element(page.getByTestId('cinema-start')).toBeVisible();
		await expect.element(page.getByTestId('cinema-instagram-hint')).toBeVisible();
		await expect
			.element(page.getByTestId('cinema-open-external'))
			.toHaveAttribute('href', 'https://www.instagram.com/reel/C0dEexample/');
		expect(document.querySelector('iframe')).toBeNull();
	});
});
