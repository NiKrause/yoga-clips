/**
 * A playlist's name as people gave it. A new playlist's database is named
 * `<name>-<time>-<random>` (eight and six characters) so two playlists of the same name stay apart, and
 * a guest learns that stored name; the suffix is not shown.
 *
 * @param {string} name
 */
export function playlistDisplayName(name) {
	return String(name ?? '').replace(/-[0-9a-z]{8}-[0-9a-z]{6}$/, '');
}
