import { describe, expect, it } from 'vitest';
import { buildAppLink, parseAppLink } from './share.js';

describe('app links', () => {
	const address = '/orbitdb/zdpuAzyoga000000000000000000000000000000000000000';

	it('round-trips a playlist address and a clip id', () => {
		const link = buildAppLink('https://yoga-clips.example.com/', {
			db: address,
			clip: 'clip-0001'
		});
		expect(link).toBe(
			`https://yoga-clips.example.com/?db=${encodeURIComponent(address)}&clip=clip-0001`
		);
		expect(parseAppLink(new URL(link).search)).toEqual({ db: address, clip: 'clip-0001' });
	});

	it('ignores values that are not an address or an id', () => {
		expect(parseAppLink('?db=javascript:alert(1)&clip=<img>')).toEqual({ db: null, clip: null });
		expect(parseAppLink('')).toEqual({ db: null, clip: null });
	});
});
