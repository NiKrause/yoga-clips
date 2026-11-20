import { describe, expect, it } from 'vitest';
import { canWrite, clipForTarget, findInPlaylist, moveOrCopy } from './move-copy.js';
import { CLIP_FIELDS } from './schema.js';

const ME = 'did:key:z6MkExampleMe';
const OTHER = 'did:key:z6MkExampleOther';
const NOW = new Date('2026-11-19T09:30:00.000Z');

/** @param {Partial<import('./schema.js').Clip>} [fields] */
const clip = (fields = {}) =>
	/** @type {import('./schema.js').Clip} */ ({
		id: '3b4a0f6e-1111-4c2d-9a8b-000000000001',
		url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		source: 'youtube',
		title: 'Shoulder opener',
		teacher: 'Example Teacher',
		durationSec: 300,
		tags: ['shoulders', 'seated'],
		addedAt: '2026-11-09T10:00:00.000Z',
		addedBy: OTHER,
		...fields
	});

/**
 * A playlist database as far as a move or copy uses it, with a record of
 * what was done to it and in which order.
 *
 * @param {string} name
 * @param {import('./schema.js').Clip[]} clips
 * @param {string[]} happened
 * @param {{ put?: Error, del?: Error, all?: Error }} [fails]
 */
function playlist(name, clips, happened, fails = {}) {
	const held = new Map(clips.map((entry) => [entry.id, entry]));
	return {
		held,
		all: async () => {
			if (fails.all) throw fails.all;
			return [...held.values()].map((value) => ({ value }));
		},
		put: async (/** @type {import('./schema.js').Clip} */ entry) => {
			if (fails.put) throw fails.put;
			happened.push(`put ${name}`);
			held.set(entry.id, entry);
		},
		del: async (/** @type {string} */ id) => {
			if (fails.del) throw fails.del;
			happened.push(`del ${name}`);
			held.delete(id);
		}
	};
}

describe('canWrite', () => {
	it('is yes for a writer, an admin, and where everyone may write', () => {
		expect(canWrite({ write: [ME] }, ME)).toBe(true);
		expect(canWrite({ write: new Set([OTHER, ME]), admin: new Set([OTHER]) }, ME)).toBe(true);
		expect(canWrite({ write: [], admin: new Set([ME]) }, ME)).toBe(true);
		expect(canWrite({ write: ['*'] }, ME)).toBe(true);
	});

	it('is no for everyone else, and where nothing is known', () => {
		expect(canWrite({ write: [OTHER], admin: [OTHER] }, ME)).toBe(false);
		expect(canWrite({ write: [], admin: [] }, ME)).toBe(false);
		expect(canWrite({}, ME)).toBe(false);
		expect(canWrite(null, ME)).toBe(false);
		expect(canWrite({ write: [ME] }, '')).toBe(false);
	});
});

describe('findInPlaylist', () => {
	it('finds the clip itself by its id', () => {
		expect(findInPlaylist([clip({ url: 'https://vimeo.com/123456789' })], clip())).toBe('same');
	});

	it('finds another entry with the same link, however the link is written', () => {
		const other = clip({ id: 'another-id-0001', url: 'https://youtu.be/dQw4w9WgXcQ?t=30' });
		expect(findInPlaylist([other], clip())).toBe('sameUrl');
	});

	it('finds nothing where the playlist has neither', () => {
		const other = clip({ id: 'another-id-0001', url: 'https://vimeo.com/123456789' });
		expect(findInPlaylist([other], clip())).toBeNull();
		expect(findInPlaylist([], clip())).toBeNull();
	});
});

describe('clipForTarget', () => {
	it('keeps the clip and its id, and sets who added it and when anew', () => {
		const source = clip();
		const written = clipForTarget(source, { addedBy: ME, now: NOW });
		expect(written).toEqual({ ...source, addedAt: NOW.toISOString(), addedBy: ME });
		expect(Object.keys(written)).toEqual([...CLIP_FIELDS]);
		expect(written.tags).not.toBe(source.tags);
	});

	it('refuses what is not a clip', () => {
		expect(() => clipForTarget(clip({ title: '' }), { addedBy: ME, now: NOW })).toThrow(/title/);
	});
});

describe('moveOrCopy', () => {
	it('copies: writes the target, leaves the source', async () => {
		/** @type {string[]} */
		const happened = [];
		const source = playlist('source', [clip()], happened);
		const target = playlist('target', [], happened);
		const result = await moveOrCopy({
			mode: 'copy',
			clip: clip(),
			source,
			target,
			identityId: ME,
			now: NOW
		});
		expect(result).toEqual({ ok: true, mode: 'copy', written: true });
		expect(happened).toEqual(['put target']);
		expect(source.held.get(clip().id)).toEqual(clip());
		expect(target.held.get(clip().id)).toEqual({
			...clip(),
			addedAt: NOW.toISOString(),
			addedBy: ME
		});
	});

	it('moves: writes the target first, then removes from the source', async () => {
		/** @type {string[]} */
		const happened = [];
		const source = playlist('source', [clip()], happened);
		const target = playlist('target', [], happened);
		const result = await moveOrCopy({
			mode: 'move',
			clip: clip(),
			source,
			target,
			identityId: ME,
			now: NOW
		});
		expect(result).toEqual({ ok: true, mode: 'move', written: true });
		expect(happened).toEqual(['put target', 'del source']);
		expect(source.held.size).toBe(0);
		expect(target.held.size).toBe(1);
	});

	it('a move whose write is refused removes nothing', async () => {
		/** @type {string[]} */
		const happened = [];
		const refused = new Error('not allowed to write');
		const source = playlist('source', [clip()], happened);
		const target = playlist('target', [], happened, { put: refused });
		const result = await moveOrCopy({ mode: 'move', clip: clip(), source, target, identityId: ME });
		expect(result).toEqual({ ok: false, kind: 'target', error: refused, written: false });
		expect(happened).toEqual([]);
		expect(source.held.size).toBe(1);
	});

	it('a move whose removal fails leaves the clip in both, and says so', async () => {
		/** @type {string[]} */
		const happened = [];
		const failed = new Error('not allowed to write');
		const source = playlist('source', [clip()], happened, { del: failed });
		const target = playlist('target', [], happened);
		const result = await moveOrCopy({ mode: 'move', clip: clip(), source, target, identityId: ME });
		expect(result).toEqual({ ok: false, kind: 'notRemoved', error: failed, written: true });
		expect(source.held.size).toBe(1);
		expect(target.held.size).toBe(1);

		// Done again, the move finishes without writing a second time.
		const again = await moveOrCopy({
			mode: 'move',
			clip: clip(),
			source: playlist('source', [clip()], happened),
			target,
			identityId: ME
		});
		expect(again).toEqual({ ok: true, mode: 'move', written: false });
		expect(happened).toEqual(['put target', 'del source']);
	});

	it('writes no second copy of a clip the target has', async () => {
		/** @type {string[]} */
		const happened = [];
		const source = playlist('source', [clip()], happened);
		const target = playlist('target', [clip({ addedBy: ME })], happened);
		const result = await moveOrCopy({ mode: 'copy', clip: clip(), source, target, identityId: ME });
		expect(result).toEqual({ ok: false, kind: 'duplicate', written: false });
		expect(happened).toEqual([]);
	});

	it('neither copies nor moves onto another entry with the same link', async () => {
		for (const mode of /** @type {const} */ (['copy', 'move'])) {
			/** @type {string[]} */
			const happened = [];
			const source = playlist('source', [clip()], happened);
			const target = playlist(
				'target',
				[clip({ id: 'another-id-0001', url: 'https://youtu.be/dQw4w9WgXcQ' })],
				happened
			);
			const result = await moveOrCopy({ mode, clip: clip(), source, target, identityId: ME });
			expect(result).toEqual({ ok: false, kind: 'duplicate', written: false });
			expect(happened).toEqual([]);
			expect(source.held.size).toBe(1);
		}
	});

	it('does nothing where the target cannot be read', async () => {
		/** @type {string[]} */
		const happened = [];
		const unread = new Error('closed');
		const source = playlist('source', [clip()], happened);
		const target = playlist('target', [], happened, { all: unread });
		const result = await moveOrCopy({ mode: 'move', clip: clip(), source, target, identityId: ME });
		expect(result).toEqual({ ok: false, kind: 'target', error: unread, written: false });
		expect(happened).toEqual([]);
	});

	it('skips what is not a clip in the target when looking for the clip', async () => {
		/** @type {string[]} */
		const happened = [];
		const target = playlist('target', [], happened);
		target.held.set('x', /** @type {any} */ ({ id: 'x', note: 'not a clip' }));
		const result = await moveOrCopy({
			mode: 'copy',
			clip: clip(),
			source: playlist('source', [clip()], happened),
			target,
			identityId: ME
		});
		expect(result.ok).toBe(true);
	});
});
