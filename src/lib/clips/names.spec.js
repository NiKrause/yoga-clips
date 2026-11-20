import { describe, expect, it } from 'vitest';
import { playlistDisplayName } from './names.js';

describe('playlistDisplayName', () => {
	it('shows a playlist by the name it was given, without the stored suffix', () => {
		expect(playlistDisplayName('Desk mornings-mweysya6-bjj1ll')).toBe('Desk mornings');
		expect(playlistDisplayName('Morgens am Schreibtisch-mwevb017-fb5rbu')).toBe(
			'Morgens am Schreibtisch'
		);
		expect(playlistDisplayName('yoga-clips-mx01abcd-a1b2c3')).toBe('yoga-clips');
	});

	it('leaves a name without that suffix as it is', () => {
		expect(playlistDisplayName('Desk mornings')).toBe('Desk mornings');
		expect(playlistDisplayName('Hips-and-back')).toBe('Hips-and-back');
		expect(playlistDisplayName('Morning-stretch-backup')).toBe('Morning-stretch-backup');
		expect(playlistDisplayName('Hamstring-stretch')).toBe('Hamstring-stretch');
		expect(playlistDisplayName('')).toBe('');
	});
});
