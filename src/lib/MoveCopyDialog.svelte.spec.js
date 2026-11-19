/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MoveCopyDialog from './MoveCopyDialog.svelte';

// The chooser of a move or copy: which playlists it offers, and what it
// hands on. The writing itself is in clips/move-copy.spec.js, and both
// together in e2e/move-copy.spec.js.

const clip = /** @type {import('./clips/schema.js').Clip} */ ({
	id: 'clip_example01',
	url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	source: 'youtube',
	title: 'Shoulder opener',
	teacher: 'Example Teacher',
	durationSec: 300,
	tags: [],
	addedBy: 'did:key:example',
	addedAt: '2026-11-13T00:00:00.000Z'
});

const MORNING = '/orbitdb/zdpuExampleMorning';
const EVENING = '/orbitdb/zdpuExampleEvening';
const STUDIO = '/orbitdb/zdpuExampleStudio';
const FRIEND = '/orbitdb/zdpuExampleFriend';
const entries = [
	{ address: MORNING, name: 'Morning', role: 'owner' },
	{ address: EVENING, name: 'Evening', role: 'owner' },
	{ address: STUDIO, name: 'Studio', role: 'guest' },
	{ address: FRIEND, name: 'Friend', role: 'guest' }
];

describe('MoveCopyDialog', () => {
	it('offers the playlists that answer "writable", whoever owns them, and never the clip’s own', async () => {
		/** @type {string[]} */
		const asked = [];
		render(MoveCopyDialog, {
			clip,
			sourceAddress: MORNING,
			entries,
			canMove: true,
			// A playlist of one's own, and one somebody else let this identity into.
			check: async (/** @type {string} */ address) => {
				asked.push(address);
				return address === EVENING || address === STUDIO;
			}
		});
		await expect.element(page.getByTestId('move-copy-clip')).toHaveTextContent('Shoulder opener');
		await expect.element(page.getByText('Studio')).toBeVisible();
		await expect.element(page.getByText('Evening')).toBeVisible();
		expect(asked.sort()).toEqual([EVENING, FRIEND, STUDIO].sort());
		const offered = [...document.querySelectorAll('[data-testid="move-copy-target"]')].map(
			(input) => input.getAttribute('data-address')
		);
		expect(offered).toEqual([EVENING, STUDIO]);
		// Two to choose from: nothing is chosen for the person.
		await expect.element(page.getByTestId('move-copy-copy')).toBeDisabled();
		await expect.element(page.getByTestId('move-copy-move')).toBeDisabled();
	});

	it('hands on the playlist and the choice, and says what went wrong', async () => {
		/** @type {string[]} */
		const chosen = [];
		render(MoveCopyDialog, {
			clip,
			sourceAddress: MORNING,
			entries: entries.slice(0, 2),
			canMove: true,
			check: async () => true,
			onchoose: async (/** @type {string} */ address, /** @type {string} */ mode) => {
				chosen.push(`${mode} ${address}`);
				return mode === 'copy' ? '“Evening” already has this clip.' : undefined;
			}
		});
		// The only playlist there is, is chosen.
		await expect.element(page.getByTestId('move-copy-target')).toBeChecked();
		await page.getByTestId('move-copy-copy').click();
		await expect
			.element(page.getByTestId('move-copy-problem'))
			.toHaveTextContent('“Evening” already has this clip.');
		await page.getByTestId('move-copy-move').click();
		await expect.element(page.getByTestId('move-copy-problem')).not.toBeInTheDocument();
		expect(chosen).toEqual([`copy ${EVENING}`, `move ${EVENING}`]);
	});

	it('offers only the copy where the clip may not leave its playlist', async () => {
		render(MoveCopyDialog, {
			clip,
			sourceAddress: STUDIO,
			entries,
			canMove: false,
			check: async (/** @type {string} */ address) => address === MORNING
		});
		await expect.element(page.getByTestId('move-copy-copy')).toBeEnabled();
		await expect.element(page.getByTestId('move-copy-move')).not.toBeInTheDocument();
		await expect
			.element(page.getByTestId('move-copy-no-move'))
			.toHaveTextContent(/^You can copy this clip\./);
	});

	it('says so where there is no playlist to write to', async () => {
		render(MoveCopyDialog, {
			clip,
			sourceAddress: MORNING,
			entries,
			canMove: true,
			check: async () => false
		});
		await expect
			.element(page.getByTestId('move-copy-none'))
			.toHaveTextContent(/^There is no other playlist you can add clips to\./);
		await expect.element(page.getByTestId('move-copy-copy')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('move-copy-cancel')).toBeVisible();
	});

	it('closes when the clip is taken away, and tells whoever opened it', async () => {
		let closed = 0;
		const view = render(MoveCopyDialog, {
			clip,
			sourceAddress: MORNING,
			entries,
			check: async () => true,
			onclose: () => closed++
		});
		await expect.element(page.getByTestId('move-copy-dialog')).toHaveAttribute('open');
		await view.rerender({ clip: null });
		await expect.element(page.getByTestId('move-copy-dialog')).not.toHaveAttribute('open');
		// The dialog's close event comes a moment after it closed.
		await expect.poll(() => closed).toBe(1);
	});
});
