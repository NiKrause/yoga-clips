# Testing

The suite runs locally with Playwright's Chromium project. The configured web
server (`e2e/start-e2e-server.mjs`) builds the app, starts a local
`orbitdb-relay` and serves the build on port 4273 — a different port from
simple-todo's 4173, so both checkouts can run their suites at the same time.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

## Commands

Unit tests (vitest, in a headless Chromium):

```bash
pnpm run test:unit
```

All end-to-end tests:

```bash
pnpm run test:e2e
```

The two-browser story alone — Alice shares a playlist with Bob, Bob is refused,
Alice grants his DID, Bob's clip reaches Alice, the export fits the schema, the
deep link opens the player:

```bash
pnpm exec playwright test e2e/clips-sharing.spec.js --project=chromium
```

Both browsers run with a CDP virtual authenticator (CTAP 2.1, resident keys,
largeBlob), so the passkey ceremonies need no OS dialog.

## Ports

| What           | Default       | Env                                        |
| -------------- | ------------- | ------------------------------------------ |
| Preview        | 4273          | `E2E_PREVIEW_PORT`                         |
| Relay HTTP     | 49200         | `E2E_RELAY_HTTP_PORT`                      |
| Relay TCP / WS | 49201 / 49202 | `E2E_RELAY_TCP_PORT` / `E2E_RELAY_WS_PORT` |

`pnpm run check:preview-origin` fails when a spec names the preview port
instead of reading it from `e2e/preview-origin.mjs`.

## Debugging

```bash
pnpm exec playwright test --ui --project=chromium
PWDEBUG=1 pnpm exec playwright test --project=chromium --headed
pnpm exec playwright show-report
```

Screenshots are captured on failure, videos are retained on failure, and a
trace is collected on the first retry. The relay's log is in `e2e/relay.log`.
