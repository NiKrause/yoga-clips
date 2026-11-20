/**
 * The app's views (NiKrause/yoga-clips#1, step 4): Library, a playlist's
 * page, Practise, Share and Me. A view is the URL's hash (`#library`,
 * `#playlist`, …), so the browser's back and forward move between them, and
 * the query keeps what it carried before (`?db=`, `?clip=`).
 */
import { writable } from 'svelte/store';

export const VIEWS = /** @type {const} */ (['library', 'playlist', 'practise', 'share', 'me']);
/** @typedef {(typeof VIEWS)[number]} View */

/** The sections of the bottom bar; a playlist's page belongs to the library. */
export const SECTIONS = /** @type {const} */ (['library', 'practise', 'share', 'me']);

/**
 * @param {string} hash `location.hash`
 * @returns {View}
 */
export function viewOf(hash) {
	const name = String(hash ?? '').replace(/^#/, '');
	return /** @type {View} */ (VIEWS.includes(/** @type {any} */ (name)) ? name : 'library');
}

/** @param {View} view */
export const sectionOf = (view) => (view === 'playlist' ? 'library' : view);

export const viewStore = writable(
	/** @type {View} */ (typeof location === 'undefined' ? 'library' : viewOf(location.hash))
);

if (typeof window !== 'undefined') {
	window.addEventListener('hashchange', () => viewStore.set(viewOf(location.hash)));
}

/**
 * Go to a view: a new entry in the browser's history, unless it is the
 * view already shown.
 * @param {View} view
 */
export function goTo(view) {
	if (typeof location === 'undefined') return viewStore.set(view);
	if (viewOf(location.hash) === view && location.hash) return;
	location.hash = view;
}
