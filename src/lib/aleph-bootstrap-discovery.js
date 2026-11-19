import {
	fetchAlephBootstrapPosts,
	selectCurrentRelayBootstrapPosts,
	filterRelayBootstrapPostsByProfile
} from '@le-space/aleph-bootstrap';

// The relay registrations live on a public Aleph channel: anyone with an ETH
// key can post there, and registrations of erased VMs are orphaned forever
// (guests self-publish with generated keys since relay-button #66, so no
// remaining key can FORGET them). Discovery therefore scopes hard before any
// dial probe runs (issue #84):
//  - registrationId: only the app's own production registration — ephemeral
//    E2E relays register as `relay:<profile>:simple-todo-e2e-*` and polluted
//    the candidate list until the browser's probe wave exhausted its stream
//    budget and dropped the healthy relay along with the corpses.
//  - maxAgeMs: orphans stop refreshing (live relays republish every 6 h), so
//    anything older than ~2 cadences is dead weight even when the
//    registrationId matches.
//
// Since 2026-11-02 the Le-Space production relay is `relay-main-ekb`, kept
// alive by the janitor in Le-Space/simple-todo; the older
// `relay:orbitdb-relay:orbitdb-relay` registration stopped refreshing a week
// later, which is what turned this app's first deploy red. A registration id
// carries the instance's item hash as a suffix (`…:relay-main-ekb:<hash>`),
// which changes when the VM is replaced, so the match is by prefix.
// The production relays this app will bootstrap from. `relay-main-ekb` is the
// Le-Space relay kept alive by the janitor; `orbitdb-relay` is the shared
// orbitdb-relay pool. Discovering both, rather than pinning the single
// `relay-main-ekb`, is what keeps a dead relay from being a single point of
// failure (a build with no relay, and a deployed app that cannot reconnect).
// Orphaned and ephemeral registrations are still kept out: smoke and E2E
// relays register under other ids (`smoke-orbitdb-relay-*`,
// `simple-todo-e2e-*`), and `maxAgeMs` drops anything that stopped
// republishing — so widening the id set does not bring the corpses back.
const DEFAULT_REGISTRATION_IDS = [
	'relay:orbitdb-relay:relay-main-ekb',
	'relay:orbitdb-relay:orbitdb-relay'
];
const DEFAULT_MAX_AGE_MS = 13 * 60 * 60 * 1000;

export { DEFAULT_REGISTRATION_IDS };

/**
 * @param {string | undefined} candidate the post's registrationId
 * @param {string} wanted the id to match, with or without the hash suffix
 */
export function matchesRegistrationId(candidate, wanted) {
	if (!candidate) return false;
	return candidate === wanted || candidate.startsWith(`${wanted}:`);
}

/**
 * Browser-dialable relay multiaddresses from the Aleph channel, scoped to our
 * own production relay registration(s), fresh, and from our profile.
 *
 * @param {{
 *   profile?: string,
 *   registrationId?: string,
 *   registrationIds?: readonly string[],
 *   maxAgeMs?: number,
 *   pagination?: number
 * }} [options] `registrationIds` matches a post when ANY id matches (by prefix);
 *   `registrationId` is the single-id form, kept for callers that scope to one.
 */
export async function discoverScopedBootstrapMultiaddrs({
	profile = 'orbitdb-relay',
	registrationId,
	registrationIds,
	maxAgeMs = DEFAULT_MAX_AGE_MS,
	pagination = 100
} = {}) {
	// One id, several ids, or — if a caller passes neither — the production set.
	const wanted =
		registrationIds ?? (registrationId != null ? [registrationId] : DEFAULT_REGISTRATION_IDS);
	const posts = await fetchAlephBootstrapPosts({ pagination });
	const current = selectCurrentRelayBootstrapPosts(posts, { maxAgeMs });
	const profiled = filterRelayBootstrapPostsByProfile(current, profile);
	const scoped =
		wanted.length > 0
			? profiled.filter((post) =>
					wanted.some((id) => matchesRegistrationId(post.content?.registrationId, id))
				)
			: profiled;
	const addresses = scoped.flatMap((post) => {
		const content = post.content;
		if (!content) return [];
		return content.browserMultiaddrs?.length
			? content.browserMultiaddrs
			: (content.multiaddrs ?? []);
	});
	return [...new Set(addresses)];
}
