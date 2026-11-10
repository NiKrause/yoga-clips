#!/usr/bin/env node
// Detach a custom domain from the Aleph `domains` aggregate and attach it
// again with the entry it had, so that Aleph's gateway sets the domain up
// anew (router and certificate).
//
// Use it when a domain was linked before its DNS records existed: the gateway
// then serves the site under the host name, but with its default certificate.
// A later link only swaps the target and does not make it ask for a
// certificate again.
//
// Only the one key of the aggregate is written; the other domains of the
// account are not touched. The message format follows @le-space/node
// (relay-button: packages/node/src/domain-link.ts, packages/core/src/broadcast.ts).
//
//   ALEPH_PRIVATE_KEY   key of the account that owns the domain (never printed)
//   ALEPH_SITE_DOMAIN   e.g. yoga-clips.le-space.de
//   RELINK_WAIT_SECONDS pause between detach and attach (default 120)
//   RELINK_MODULES      directory whose node_modules holds `ethers`
//   DRY_RUN=1           build and sign both messages, send nothing; without a
//                       key a throwaway one is used
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const CHANNEL = 'ALEPH-CLOUDSOLUTIONS';
const API_HOSTS = (process.env.ALEPH_API_HOSTS || 'https://api2.aleph.im,https://api.aleph.im')
	.split(',')
	.map((host) => host.trim())
	.filter(Boolean);

const dryRun = process.env.DRY_RUN === '1';
const domain = (process.env.ALEPH_SITE_DOMAIN || '').trim().toLowerCase();
const waitSeconds = Math.max(0, Number(process.env.RELINK_WAIT_SECONDS || 120));

function fail(message) {
	console.error(`relink-domain: ${message}`);
	process.exit(1);
}

if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
	fail('ALEPH_SITE_DOMAIN must be a plain host name such as yoga-clips.le-space.de');
}

const modulesDir = path.resolve(process.env.RELINK_MODULES || process.cwd());
const { Wallet } = createRequire(pathToFileURL(path.join(modulesDir, 'package.json')))('ethers');

let wallet;
if (process.env.ALEPH_PRIVATE_KEY) wallet = new Wallet(process.env.ALEPH_PRIVATE_KEY.trim());
else if (dryRun) wallet = Wallet.createRandom();
else fail('ALEPH_PRIVATE_KEY is not set');
const sender = wallet.address;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readEntry(address = sender) {
	let lastError;
	for (const host of API_HOSTS) {
		try {
			const response = await fetch(`${host}/api/v0/aggregates/${address}.json?keys=domains`, {
				cache: 'no-cache'
			});
			if (response.status === 404) return undefined;
			if (!response.ok) throw new Error(`${host} answered ${response.status}`);
			const payload = await response.json();
			return payload?.data?.domains?.[domain];
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}

async function buildMessage(entry) {
	const time = Date.now() / 1000;
	const itemContent = JSON.stringify({
		address: sender,
		key: 'domains',
		content: { [domain]: entry },
		time
	});
	const itemHash = createHash('sha256').update(itemContent).digest('hex');
	const unsigned = {
		sender,
		chain: 'ETH',
		type: 'AGGREGATE',
		item_hash: itemHash,
		item_type: 'inline',
		item_content: itemContent,
		time,
		channel: CHANNEL
	};
	const signature = await wallet.signMessage(
		[unsigned.chain, unsigned.sender, unsigned.type, unsigned.item_hash].join('\n')
	);
	return { ...unsigned, signature };
}

async function publish(entry, label) {
	const message = await buildMessage(entry);
	if (dryRun) {
		console.log(`[dry run] ${label}: ${message.item_content}`);
		return message.item_hash;
	}
	let lastError;
	for (const host of API_HOSTS) {
		try {
			const response = await fetch(`${host}/api/v0/messages`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sync: true, message })
			});
			const payload = await response.json().catch(() => ({}));
			const status = payload?.message_status ?? (response.status === 202 ? 'pending' : 'unknown');
			if (!response.ok || status === 'rejected') {
				throw new Error(`${host} answered ${response.status} (${status})`);
			}
			console.log(`${label}: message ${message.item_hash} ${status} via ${host}`);
			return message.item_hash;
		} catch (error) {
			lastError = error;
			console.warn(`${label}: ${error.message}`);
		}
	}
	throw lastError;
}

async function waitForEntry(predicate, what) {
	if (dryRun) return;
	for (let attempt = 0; attempt < 36; attempt += 1) {
		if (predicate(await readEntry().catch(() => Symbol('unreadable')))) return;
		await sleep(5000);
	}
	fail(`the aggregate did not show ${what} within three minutes`);
}

function output(name, value) {
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

// A dry run without a key reads the entry of the account named in
// RELINK_ADDRESS, to show what would be written.
const before = await readEntry(
	dryRun && !process.env.ALEPH_PRIVATE_KEY ? process.env.RELINK_ADDRESS || sender : sender
);
if (!before || typeof before !== 'object' || typeof before.message_id !== 'string') {
	fail(`${domain} is not linked in the domains aggregate of ${sender}; there is nothing to relink`);
}
console.log(`${domain} points at ${before.message_id} (${before.type}), account ${sender}`);

const detachHash = await publish(null, 'detach');
await waitForEntry((entry) => entry === null || entry === undefined, 'the domain detached');
console.log(`detached; waiting ${waitSeconds} s for the gateway to drop the domain`);
if (!dryRun) await sleep(waitSeconds * 1000);

let attachHash;
try {
	attachHash = await publish(before, 'attach');
	await waitForEntry(
		(entry) => entry && typeof entry === 'object' && entry.message_id === before.message_id,
		'the domain attached'
	);
} catch (error) {
	console.error(
		`relink-domain: ${domain} is DETACHED and the attach failed: ${error.message}. ` +
			'Run the deploy workflow (its link-domain job attaches the domain again).'
	);
	process.exit(1);
}

console.log(`attached again: ${domain} points at ${before.message_id}`);
output('domain', domain);
output('target', before.message_id);
output('detach_message', detachHash);
output('attach_message', attachHash);
