# Yoga Clips signet

The countdown: an arc for the waiting time that runs out, and a clip in its
middle. Drawn on Le Space Belege's construction and palette (Brand & Style
Guide v1): one accent shape and one ink shape, never rotated, no shadows, no
other colours. The masters are kept in
[NiKrause/yoga-break](https://github.com/NiKrause/yoga-break/tree/f89b855/brand)
(commit `f89b855`); these are copies.

| File                                  | Use                                                         |
| ------------------------------------- | ----------------------------------------------------------- |
| `mark-light.svg`                      | on paper `#FAF6EE`: arc amber `#FFB020`, play ink `#0F1B2D` |
| `mark-dark.svg`                       | on night `#0B0E15`: arc lime `#C6F24E`, play snow `#F4F6FB` |
| `mark-mono.svg`                       | one colour (`currentColor`)                                 |
| `favicon.svg`                         | browser tab and home screen: snow on an ink tile            |
| `avatar-light.svg`, `avatar-dark.svg` | square avatars, 1024 px                                     |

The wordmark is set in text, not drawn: "LE SPACE" small with wide tracking
above "yoga clips" in Sora (`src/lib/fonts/sora-latin-wght-normal.woff2`, from
`@fontsource-variable/sora` 5.3.0, SIL Open Font License 1.1). In the app the
signet is `src/lib/YogaClipsLogo.svelte`, the same geometry with the theme's
tokens.

The icons in `static/` are made from these files by `scripts/brand-images.sh`
(Inkscape and ImageMagick for the icons, Playwright for `og-image.png`, whose
text needs Sora).
