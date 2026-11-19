import { appendFile } from 'node:fs/promises';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { discoverScopedBootstrapMultiaddrs } from '../src/lib/aleph-bootstrap-discovery.js';
import { ping } from '@libp2p/ping';
import { webRTCDirect } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';
import { createLibp2p } from 'libp2p';
import { resolveBootstrapCandidates } from '../src/lib/bootstrap-multiaddrs.js';

const PROBE_TIMEOUT_MS = Number(process.env.RELAY_BOOTSTRAP_PROBE_TIMEOUT_MS || 10_000);

async function probeBootstrapMultiaddr(address) {
	const node = await createLibp2p({
		transports: [webSockets(), webRTCDirect()],
		connectionEncrypters: [noise()],
		streamMuxers: [yamux()],
		services: {
			ping: ping({ timeout: PROBE_TIMEOUT_MS })
		}
	});
	const target = multiaddr(address);

	try {
		try {
			const rtt = await node.services.ping.ping(target, {
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
			});
			return { address, reachable: true, method: 'ping', detail: `${rtt}ms` };
		} catch (pingError) {
			try {
				const connection = await node.dial(target, {
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
				});
				await connection.close();
				return {
					address,
					reachable: true,
					method: 'dial-fallback',
					detail: `ping failed: ${formatError(pingError)}`
				};
			} catch (dialError) {
				return {
					address,
					reachable: false,
					method: 'failed',
					detail: `ping: ${formatError(pingError)}; dial: ${formatError(dialError)}`
				};
			}
		}
	} finally {
		await node.stop();
	}
}

function formatError(error) {
	if (error instanceof Error) return error.message;
	if (error && typeof error === 'object') {
		if ('message' in error && error.message) return String(error.message);
		if ('error' in error && error.error instanceof Error) return error.error.message;
	}
	return String(error);
}

async function verifyBootstrapMultiaddrs(addresses) {
	const results = [];
	for (const address of addresses) {
		const result = await probeBootstrapMultiaddr(address);
		results.push(result);
		console.log(
			`${result.reachable ? '✓' : '✗'} ${address} (${result.method}${result.detail ? `: ${result.detail}` : ''})`
		);
	}
	return results;
}

const override = process.env.RELAY_BOOTSTRAP_OVERRIDE?.trim() || '';
const fallback = process.env.RELAY_BOOTSTRAP_FALLBACK?.trim() || '';
// Multiple relay implementations register in the same Aleph channel
// (`orbitdb-relay` for simple-todo and this app, `uc-go-peer` for universal-connectivity).
// Scope discovery to our own profile so the build never bakes in a relay the
// browsers cannot form a shared circuit with (a `uc-go-peer` relay leaves two
// orbitdb browsers stuck at `candidates: 0`).
const profile = process.env.RELAY_BOOTSTRAP_PROFILE?.trim() || 'orbitdb-relay';
// Bake only the production registration into the site bundle: ephemeral E2E
// and smoke relays (`relay:<profile>:smoke-orbitdb-relay-*`) may be alive
// during a build, pass the ping probe, and then become permanent dial noise
// for every visitor once their VM is erased (simple-todo #84). The production
// relay is `relay-main-ekb` (see src/lib/aleph-bootstrap-discovery.js).
const registrationId =
	process.env.RELAY_BOOTSTRAP_REGISTRATION_ID?.trim() || 'relay:orbitdb-relay:relay-main-ekb';

// Every usable source in precedence order (override, Aleph discovery, then the
// configured fallback). Discovery runs unless an override is already given.
let candidates = resolveBootstrapCandidates({ override, fallback });
if (!candidates.some((candidate) => candidate.source === 'override')) {
	const discovered = await discoverScopedBootstrapMultiaddrs({ profile, registrationId });
	candidates = resolveBootstrapCandidates({ override, discovered, fallback });
}

if (candidates.length === 0) {
	throw new Error(
		'No valid browser-dialable Aleph bootstrap multiaddresses were discovered and no valid override or fallback was configured.'
	);
}

// Probe the sources in turn and bake the first that answers. A discovered
// production relay that is resolvable but down therefore falls through to the
// configured fallback instead of failing the deploy.
const probeResults = [];
const attempts = [];
let resolution = null;
for (const candidate of candidates) {
	const results = await verifyBootstrapMultiaddrs(candidate.addresses);
	probeResults.push(...results);
	const reachable = results.filter((result) => result.reachable).map((result) => result.address);
	attempts.push(`${candidate.source} ${reachable.length}/${candidate.addresses.length}`);
	if (reachable.length > 0) {
		resolution = { addresses: reachable, source: candidate.source };
		if (candidate.source !== candidates[0].source) {
			console.log(
				`↪ ${candidates[0].source} had no reachable relay; fell through to ${candidate.source}.`
			);
		}
		break;
	}
	console.log(
		`✗ ${candidate.source}: none of ${candidate.addresses.length} address(es) reachable; trying the next source.`
	);
}

if (!resolution) {
	throw new Error(
		`None of the ${probeResults.length} resolved bootstrap multiaddresses passed ping or the dial fallback (tried: ${attempts.join(', ')}).`
	);
}

const serialized = resolution.addresses.join(',');
if (process.env.GITHUB_ENV) {
	await appendFile(process.env.GITHUB_ENV, `VITE_RELAY_BOOTSTRAP_ADDR_PROD=${serialized}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
	const addressList = resolution.addresses.map((address) => `- \`${address}\``).join('\n');
	const probeTable = probeResults
		.map(
			(result) =>
				`| \`${result.address}\` | ${result.reachable ? '✅' : '❌'} | ${result.method} | ${result.detail || ''} |`
		)
		.join('\n');
	await appendFile(
		process.env.GITHUB_STEP_SUMMARY,
		`## Production bootstrap snapshot\n\nSource: **${resolution.source}**\n\n${addressList}\n\n### Reachability checks\n\n| Multiaddress | Reachable | Check | Detail |\n| --- | --- | --- | --- |\n${probeTable}\n`
	);
}

console.log(
	`Resolved ${resolution.addresses.length} bootstrap multiaddress(es) from ${resolution.source}.`
);
