# Relaunch mockups

Three static sketches of how Yoga Clips could look to someone who practises
yoga and has never heard of OrbitDB. They are the starting point of the
relaunch issue; nothing here is built into the app.

- `mockups.html` — the three directions side by side, phone size, made-up
  clips, teachers and playlists. Open it in a browser; `?theme=dark` shows
  the night mode.
- `mockups-light.png`, `mockups-dark.png` — the same page rendered, for the
  issue and the pull request.

The colours are Le Space Belege's tokens (paper and amber by day, night and
lime at night), the signet is the Yoga Clips countdown.

Render the images again after a change (Chrome, headless):

```bash
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1.5 \
  --window-size=1230,1110 --screenshot=mockups-light.png "file://$PWD/mockups.html"
```
