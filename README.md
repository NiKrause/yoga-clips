# Yoga Clips — a shared collection of short yoga clips, peer to peer

A local-first PWA for the short clips (2–10 minutes) from your favourite yoga
teachers: paste a link, give it a duration and a few tags, and share the
playlist with friends — without a server, an account or a password. Built on
the stack of [simple-todo](https://github.com/NiKrause/simple-todo)
(libp2p · Helia/IPFS · OrbitDB · SvelteKit), starting from its `acl01`
chapter: passkey identities and per-DID write permissions.

The playlist's export is the file the
[**yoga-break**](https://github.com/NiKrause/yoga-break) mod for Claude Code
reads from `~/.yoga/clips.json`: while a long tool call runs, the mod suggests
a clip that fits the wait and opens it — in a later version through this app's
`?clip=<id>` deep link.

## What it does

- **Add a clip by link.** YouTube (incl. `youtu.be` and Shorts), Instagram
  (Reels and posts), Vimeo, or any other web link. The source is detected from
  the URL; for YouTube and Vimeo the title and thumbnail are prefilled through
  the services' public oEmbed endpoints (no API key). The duration is typed —
  oEmbed does not carry it. Teachers autocomplete from the playlist.
- **Find one.** Grid of cards, filtered by teacher, tag, and "I have N minutes".
- **Play it.** YouTube and Vimeo play inline, from `youtube-nocookie.com` and
  `player.vimeo.com`, loaded only after the click. Instagram is a card with an
  _Open_ button — no Instagram script is ever loaded.
- **Deep link.** `?clip=<id>` opens a clip in the player; `?db=<address>` opens
  a playlist. Both may be combined.
- **clips.json.** _Export_ writes every clip of the open playlist as
  `{ "clips": [ … ] }` in the schema below; _Import_ reads such a file back
  (clips whose id is already there are skipped).
- **Share.** A playlist is shared by link or QR code. Anyone with the address
  can read it; writing needs the owner to add the friend's DID under _Write
  permissions_ — and the owner can take it back.
- **Done marks and minutes.** Mark a clip done; the app counts your minutes
  today and this week. This stays in this browser, per identity — it is not
  part of the shared playlist.
- **Offline.** A service worker keeps the app shell; playlists and clips live
  in IndexedDB. German and English.

## The schema

One OrbitDB document per clip, indexed by `id`. This is the shape the mod
reads, so it is fixed:

```json
{
  "id": "uuid",
  "url": "https://...",
  "source": "youtube" | "instagram" | "vimeo" | "other",
  "title": "Shoulder Opener",
  "teacher": "Name",
  "durationSec": 300,
  "tags": ["schultern", "sitzen"],
  "addedAt": "ISO-8601",
  "addedBy": "did:..."
}
```

`addedBy` is the identity that wrote the clip (the passkey's DID, or the
anonymous per-browser id). The mod ignores fields it does not know; the export
writes exactly these nine. Validation, source detection and the export live in
[`src/lib/clips/schema.js`](src/lib/clips/schema.js), with tests.

## Architecture

```
browser ──libp2p (WebSocket/WebRTC)──▶ orbitdb-relay ◀── another browser
   │                                   (introduces peers, keeps a copy)
   ├─ Helia (IPFS blocks)  ─ IndexedDB via browser-level
   ├─ OrbitDB
   │    ├─ playlist registry   keyvalue, owner-only, name derived from a signature
   │    └─ playlist …          documents(indexBy: id), OrbitDBAccessController
   ├─ identity: WebAuthn passkey → DID (or anonymous)
   └─ done marks, thumbnails cache, language, theme: localStorage
```

- **Playlists** are OrbitDB `documents` databases with
  `OrbitDBAccessController({ write: [owner] })`. Grants and revokes mutate the
  controller's own replicated store, so the address never changes and peers
  pick up permission changes live. A refused write throws inside OrbitDB's
  `canAppend` before anything is appended — nothing ever looks saved.
- **The registry** of playlists an identity knows is itself an OrbitDB
  database, so it follows the passkey to another device. Its name is derived
  from a signature over a fixed string, not from the DID, so that nobody who
  has seen your DID can enumerate your playlists (simple-todo acl01).
- **Identity** comes from
  [`@le-space/orbitdb-identity-provider-webauthn-did`](https://github.com/Le-Space/orbitdb-identity-provider-webauthn-did):
  the DID is the passkey's P-256 key; OrbitDB signs with a secp256k1 key
  derived from the passkey's PRF output. Create-or-recover
  (largeBlob first, localStorage as fallback) is in
  [`src/lib/passkey-identity.js`](src/lib/passkey-identity.js). Passkeys are
  bound to the origin: one created on `localhost` does not exist on the
  deployed domain.
- **Networking** is simple-todo's: a relay from
  [NiKrause/orbitdb-relay](https://github.com/NiKrause/orbitdb-relay) for
  discovery and replication, WebRTC between browsers where possible. Nothing
  dials before the consent screen is accepted.
- **Third parties.** Pasting a YouTube/Vimeo link asks `youtube.com` /
  `vimeo.com` for oEmbed. Cards load thumbnails from `i.ytimg.com` /
  `vimeocdn.com` (Vimeo's, once per clip, cached in localStorage). Playing
  loads the embed. The consent screen says all of this.

### From simple-todo

Kept: build setup, libp2p/Helia/OrbitDB wiring, relay bootstrap and
discovery, passkey identity, the access-controller permissions panel, the
playlist registry, the consent dialog, theming (Le-Space tokens as CSS custom
properties), the Playwright setup with a local relay, the service worker from
`main`. Replaced: the todo domain (keyvalue todos, the public three-word
mnemonic list) with playlists of clips, plus oEmbed, export/import, deep links
and done marks. Persistence is always on here — simple-todo makes it a choice
because its default list is public.

## Development

```bash
pnpm install
pnpm dev
```

In development the app dials `VITE_RELAY_BOOTSTRAP_ADDR_DEV` from `.env`
(see `.env.example`). For a local relay:

```bash
npm install -g orbitdb-relay
RELAY_LISTEN_IPV4=127.0.0.1 RELAY_DISABLE_IPV6=true RELAY_DISABLE_QUIC=true \
RELAY_DISABLE_WEBRTC=true DATASTORE_PATH=/tmp/yoga-clips-relay orbitdb-relay --test
curl -s http://127.0.0.1:9090/multiaddrs
```

Put the printed `/ws` address into `.env` as `VITE_RELAY_BOOTSTRAP_ADDR_DEV`
and restart `pnpm dev`.

Tests: see [docs/TESTING.md](docs/TESTING.md). The two-browser E2E (Alice
shares, Bob is refused, Alice grants, Bob writes, the export fits the schema,
the deep link plays) runs against a local relay:

```bash
pnpm exec playwright test e2e/clips-sharing.spec.js --project=chromium
```

## Deployment

`.github/workflows/deploy.yml` runs the unit and E2E tests and publishes the
static build to Aleph IPFS, linking `yoga-clips.le-space.de` — the same path
simple-todo takes. It needs the `ALEPH_PRIVATE_KEY` secret; without it the
build is only checked and publishing is skipped with a warning.

The domain needs three DNS records in the `le-space.de` zone, all "DNS only"
(not proxied), like every other le-space.de site on Aleph:

| Type  | Name                  | Value                                                    |
| ----- | --------------------- | -------------------------------------------------------- |
| CNAME | `yoga-clips`          | `ipfs.public.aleph.sh`                                   |
| CNAME | `_dnslink.yoga-clips` | `_dnslink.yoga-clips.le-space.de.static.public.aleph.sh` |
| TXT   | `_control.yoga-clips` | the address of the account that signs the publish        |

`bash scripts/cloudflare-dns.sh` creates or updates them through the Cloudflare
API; it asks for the token hidden. The `_dnslink` CNAME lets Aleph answer the
`dnslink=/ipfs/<cid>` TXT record itself, so it follows every new publish.

Create the records **before** the first deploy links the domain. A domain
linked while its name still pointed elsewhere is served by Aleph's gateway
with a default certificate, and later deploys do not change that. The workflow
"Relink the custom domain on Aleph" (`relink-domain.yml`, run by hand) detaches
the domain from the account's `domains` aggregate and attaches it again with
the same target, so the gateway sets it up anew.

## Privacy, in short

No server of ours, no account. A playlist is readable by anyone who has its
address, including the relay that stores it: links, titles, teachers, tags.
Nothing is encrypted. Which clips you did, and when, never leaves your
browser. The consent screen states what is contacted and when.

## License

[LICENSE](./LICENSE) — the same as simple-todo.
