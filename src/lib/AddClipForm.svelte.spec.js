/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AddClipForm from './AddClipForm.svelte';
import { activePlaylistStore } from './clips/store.js';

// The form with both lookups replaced: these tests contact neither YouTube
// nor Vimeo, and say what the form does with what a service answers.

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const OTHER_YOUTUBE = 'https://youtu.be/jNQXAC9IVRw';
const VIMEO = 'https://vimeo.com/123456789';

/** @param {Partial<import('./clips/oembed.js').OEmbedInfo>} [info] */
const oembed = (info = {}) => ({
	title: 'Shoulder opener',
	authorName: 'Example Channel',
	thumbnailUrl: null,
	durationSec: null,
	...info
});

const url = () => page.getByTestId('clip-url');
const duration = () => page.getByTestId('clip-duration');
const hint = () => page.getByTestId('clip-duration-hint');

beforeEach(() => {
	// The form is disabled until a playlist is open.
	activePlaylistStore.set({ kind: 'owner', name: 'Test', address: '/orbitdb/test' });
});

afterEach(() => {
	activePlaylistStore.set({ kind: 'none', name: '', address: '' });
});

describe('AddClipForm: the duration of a pasted link', () => {
	it('is filled from Vimeo’s oEmbed answer, and the player is not asked', async () => {
		let playerAsked = 0;
		render(AddClipForm, {
			lookupOEmbed: async () => oembed({ durationSec: 754 }),
			lookupYouTubeDuration: async () => {
				playerAsked += 1;
				return 60;
			}
		});
		await url().fill(VIMEO);
		await expect.element(duration()).toHaveValue('12:34');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'filled');
		await expect.element(page.getByTestId('clip-title')).toHaveValue('Shoulder opener');
		expect(playerAsked).toBe(0);
	});

	it('is filled from YouTube’s player, for the video of the link', async () => {
		/** @type {string[]} */
		const asked = [];
		render(AddClipForm, {
			lookupOEmbed: async () => oembed(),
			lookupYouTubeDuration: async (/** @type {string} */ videoId) => {
				asked.push(videoId);
				return 214;
			}
		});
		await url().fill(YOUTUBE);
		await expect.element(duration()).toHaveValue('3:34');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'filled');
		expect(asked).toEqual(['dQw4w9WgXcQ']);
	});

	it('does not make the title wait for the player', async () => {
		/** @type {(seconds: number | null) => void} */
		let answer = () => {};
		render(AddClipForm, {
			lookupOEmbed: async () => oembed(),
			lookupYouTubeDuration: () => new Promise((resolve) => (answer = resolve))
		});
		await url().fill(YOUTUBE);
		await expect.element(page.getByTestId('clip-title')).toHaveValue('Shoulder opener');
		await expect.element(duration()).toHaveValue('');
		answer(300);
		await expect.element(duration()).toHaveValue('5:00');
	});

	it('never replaces what was typed', async () => {
		render(AddClipForm, {
			lookupOEmbed: async () => oembed(),
			lookupYouTubeDuration: async () => 214
		});
		await duration().fill('5');
		await url().fill(YOUTUBE);
		await expect.element(page.getByTestId('clip-title')).toHaveValue('Shoulder opener');
		await expect.element(duration()).toHaveValue('5');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'idle');
	});

	it('stays empty and typeable when the player does not answer', async () => {
		render(AddClipForm, {
			lookupOEmbed: async () => oembed(),
			lookupYouTubeDuration: async () => null
		});
		await url().fill(YOUTUBE);
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'missing');
		await expect.element(duration()).toHaveValue('');
		await duration().fill('7:30');
		await expect.element(duration()).toHaveValue('7:30');
	});

	it('survives a lookup that throws', async () => {
		render(AddClipForm, {
			lookupOEmbed: async () => {
				throw new Error('offline');
			},
			lookupYouTubeDuration: () => {
				throw new Error('no frames here');
			}
		});
		await url().fill(YOUTUBE);
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'missing');
		await expect.element(duration()).toHaveValue('');
	});

	it('leaves the field empty for a length no clip here can have, and says the length', async () => {
		render(AddClipForm, {
			lookupOEmbed: async () => oembed(),
			lookupYouTubeDuration: async () => 90 * 60
		});
		await url().fill(YOUTUBE);
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'outOfRange');
		await expect.element(hint()).toHaveTextContent('90:00');
		await expect.element(duration()).toHaveValue('');
	});

	it('replaces a filled length with the next link’s, and drops it with the link', async () => {
		/** @type {Record<string, number>} */
		const lengths = { dQw4w9WgXcQ: 214, jNQXAC9IVRw: 45 };
		render(AddClipForm, {
			lookupOEmbed: async () => oembed(),
			lookupYouTubeDuration: async (/** @type {string} */ videoId) => lengths[videoId] ?? null
		});
		await url().fill(YOUTUBE);
		await expect.element(duration()).toHaveValue('3:34');
		await url().fill(OTHER_YOUTUBE);
		await expect.element(duration()).toHaveValue('0:45');
		await url().fill('');
		await expect.element(duration()).toHaveValue('');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'idle');
	});

	it('keeps a filled length that was then changed by hand', async () => {
		let playerAnswered = 0;
		render(AddClipForm, {
			lookupOEmbed: async (/** @type {string} */ link) =>
				oembed({ durationSec: link.includes('vimeo') ? 754 : null }),
			lookupYouTubeDuration: async () => {
				playerAnswered += 1;
				return 214;
			}
		});
		await url().fill(VIMEO);
		await expect.element(duration()).toHaveValue('12:34');
		await duration().fill('10');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'idle');
		await url().fill(YOUTUBE);
		await expect.poll(() => playerAnswered).toBe(1);
		await expect.element(page.getByTestId('clip-source')).toHaveTextContent('YouTube');
		await expect.element(duration()).toHaveValue('10');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'idle');
	});

	it('asks nobody for an Instagram or any other link', async () => {
		let asked = 0;
		render(AddClipForm, {
			lookupOEmbed: async () => {
				asked += 1;
				return oembed({ durationSec: 60 });
			},
			lookupYouTubeDuration: async () => {
				asked += 1;
				return 60;
			}
		});
		await url().fill('https://www.instagram.com/reel/Cabc123/');
		await expect.element(page.getByTestId('clip-source')).toBeInTheDocument();
		await url().fill('https://example.com/video');
		await expect.element(hint()).toHaveAttribute('data-duration-from', 'idle');
		await expect.element(duration()).toHaveValue('');
		expect(asked).toBe(0);
	});
});
