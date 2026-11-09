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
const DEFAULT_REGISTRATION_ID = 'relay:orbitdb-relay:relay-main-ekb';
const DEFAULT_MAX_AGE_MS = 13 * 60 * 60 * 1000;

/**
 * @param {string | undefined} candidate the post's registrationId
 * @param {string} wanted the id to match, with or without the hash suffix
 */
export function matchesRegistrationId(candidate, wanted) {
	if (!candidate) return false;
	return candidate === wanted || candidate.startsWith(`${wanted}:`);
}

export async function discoverScopedBootstrapMultiaddrs({
	profile = 'orbitdb-relay',
	registrationId = DEFAULT_REGISTRATION_ID,
	maxAgeMs = DEFAULT_MAX_AGE_MS,
	pagination = 100
} = {}) {
	const posts = await fetchAlephBootstrapPosts({ pagination });
	const current = selectCurrentRelayBootstrapPosts(posts, { maxAgeMs });
	const profiled = filterRelayBootstrapPostsByProfile(current, profile);
	const scoped = registrationId
		? profiled.filter((post) => matchesRegistrationId(post.content?.registrationId, registrationId))
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
