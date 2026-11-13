# The demo film

A narrated film of about two minutes that shows the whole loop: Claude works,
the yoga-break mod suggests a clip, the clip plays in the cinema page, a
playlist is made, shared and connected to Claude. Recorded by Playwright from
sample data, in English and German, with
[`@le-space/video-kit`](https://github.com/Le-Space/belege/tree/main/packages/video-kit)
(Belege's kit, as a package). Not part of `pnpm test:e2e`.

```bash
DEMO_VOICE=say pnpm video                  # every scene and card, English, macOS's voice (free)
DEMO_VOICE=say DEMO_LANG=de pnpm video     # the German app and lines
pnpm video:compose e2e-video/out           # MP4 + voice + .srt per recording
pnpm video:compose e2e-video/out --film e2e-video/films/intro-en.json   # … and the film
```

Without `DEMO_VOICE` the narrator is ElevenLabs when its key is in the
keychain (`security add-generic-password -a belege -s elevenlabs -w`) or in
`ELEVENLABS_API_KEY`. Each spoken line is kept under its hash in
`e2e-video/voice/` (not in git; a minute of speech costs cents), so only new
or changed lines are paid for. `DEMO_RES=2160` records at 4K for YouTube.
Playwright wipes `e2e-video/results/` on the next run, so compose at once.

## What is here

- `brand.js` — the title cards in Yoga Clips' brand: the countdown signet
  (`brand/mark-dark.svg`, its arc draws itself, the play triangle settles),
  "LE SPACE / yoga clips" in Sora, Le Space Belege's night palette, the texts
  of the opening and closing cards, the address and its QR. Also the narrator
  and `startScene` with both.
- `stand-ins.js` — made-up clips (teachers, titles, lengths) and stand-ins
  for YouTube's oEmbed endpoint, thumbnails and player. The film contacts no
  video service and shows no third party's video; the clip that plays is a
  calm picture labelled "sample video".
- Scenes: `playlist.spec.js` (a playlist, a clip by link, its length filling
  itself in), `cinema.spec.js` (a clip link in the cinema page, one press,
  "Done"), `share.spec.js` (link and QR; a second browser opens the playlist
  and plays a clip — two clips, `share.<lang>` and `share-friend.<lang>`),
  `export.spec.js` (clips.json and `/yoga playlist <link>`).
- `cards.spec.js`, `compose.mjs` — the kit's card recorder and compose.
- `films/intro-<lang>.json` — the film's parts in order.

## Placeholders

- **The Claude recording.** The part of the film that shows Claude at work
  (a long task, the countdown and the band with a suggestion, _Open_) is a
  screen recording of the desktop app made by hand. Until it exists, the film
  lists a silent card in its place, marked `"placeholder": "claude-desktop.<lang>"`.
  To put the recording in: save it as `e2e-video/out/claude-desktop.<lang>.mp4`
  (1920×1080, with its own sound or none) and replace that card in the film
  list by `{ "scene": "claude-desktop.<lang>" }`.
- **Fullscreen.** The cinema page asks for fullscreen on its start control. A
  headless browser's fullscreen shrinks what the recorder sees, so the
  cinema scene refuses it, and the clip fills the page instead — the same
  picture in a 16:9 film.
