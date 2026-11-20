import { describe, expect, it } from 'vitest';
import { sectionOf, viewOf } from './views.js';

describe('views', () => {
	it('reads the view from the hash, and falls back to the library', () => {
		expect(viewOf('#practise')).toBe('practise');
		expect(viewOf('playlist')).toBe('playlist');
		expect(viewOf('')).toBe('library');
		expect(viewOf('#nonsense')).toBe('library');
		expect(viewOf('#__proto__')).toBe('library');
	});

	it('counts a playlist’s page to the library section', () => {
		expect(sectionOf('playlist')).toBe('library');
		expect(sectionOf('me')).toBe('me');
	});
});
