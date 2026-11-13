/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import YogaBreakHint from './YogaBreakHint.svelte';
import { parseAppLink } from './clips/share.js';

describe('YogaBreakHint', () => {
	it('says where the mod is, how it is installed, and names this playlist to it', async () => {
		render(YogaBreakHint, { playlistAddress: '/orbitdb/zdpuExample123' });

		const link = page.getByTestId('yoga-break-link');
		await expect.element(link).toHaveAttribute('href', 'https://github.com/NiKrause/yoga-break');
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
		await expect
			.element(page.getByTestId('yoga-break-install'))
			.toHaveTextContent('claude plugin install yoga-break --marketplace NiKrause/yoga-break');

		// The command carries a link this app itself would open as that playlist.
		const command = page.getByTestId('yoga-break-playlist-command').element().textContent ?? '';
		expect(command.startsWith(`/yoga playlist ${window.location.origin}/?db=`)).toBe(true);
		const pasted = new URL(command.slice('/yoga playlist '.length));
		expect(parseAppLink(pasted.search)).toEqual({ db: '/orbitdb/zdpuExample123', clip: null });
	});

	it('has no playlist step while no playlist is open', async () => {
		render(YogaBreakHint, { playlistAddress: '' });
		await expect.element(page.getByTestId('yoga-break-install')).toBeVisible();
		expect(document.querySelector('[data-testid="yoga-break-playlist-command"]')).toBeNull();
	});
});
