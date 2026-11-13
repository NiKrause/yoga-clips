/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BottomBar from './BottomBar.svelte';
// The shapes are the stylesheet's (the components layer of app.css).
import '../app.css';

const items = [
	{ id: 'library', label: 'Library', href: '#library', icon: '▦' },
	{ id: 'practise', label: 'Practise', href: '#practise', icon: '◷' },
	{ id: 'share', label: 'Share', href: '#share', icon: '↗' },
	{ id: 'me', label: 'Me', href: '#me', icon: '◯' }
];

describe('BottomBar', () => {
	it('names its sections and marks the current one for assistive technology', async () => {
		render(BottomBar, { items, current: 'practise', label: 'Sections' });
		const nav = page.getByRole('navigation', { name: 'Sections' });
		await expect.element(nav).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Practise' }))
			.toHaveAttribute('aria-current', 'page');
		await expect
			.element(page.getByRole('link', { name: 'Library' }))
			.not.toHaveAttribute('aria-current');
		await expect.element(page.getByTestId('bottom-bar-share')).toHaveAttribute('href', '#share');
	});

	it('gives every item a finger-sized target', async () => {
		render(BottomBar, { items, label: 'Sections' });
		const height = page.getByTestId('bottom-bar-me').element().getBoundingClientRect().height;
		expect(height).toBeGreaterThanOrEqual(44);
	});
});
