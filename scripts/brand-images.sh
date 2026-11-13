#!/usr/bin/env bash
# The app's icons from the signet in brand/: favicons, the Apple touch icon,
# the Android/manifest icons (Inkscape, ImageMagick for the .ico), and the
# link preview og-image.png (Playwright: its wordmark is set in Sora).
#   bash scripts/brand-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."
png() { inkscape "$1" --export-type=png --export-width="$2" --export-filename="$3" >/dev/null 2>&1; }
png brand/favicon.svg 16 static/favicon-16x16.png
png brand/favicon.svg 32 static/favicon-32x32.png
png brand/favicon.svg 48 "${TMPDIR:-/tmp}/yoga-clips-favicon-48.png"
png brand/apple-touch-icon.svg 180 static/apple-touch-icon.png
png brand/favicon.svg 192 static/android-chrome-192x192.png
png brand/favicon.svg 512 static/android-chrome-512x512.png
magick static/favicon-16x16.png static/favicon-32x32.png "${TMPDIR:-/tmp}/yoga-clips-favicon-48.png" static/favicon.ico
cp brand/favicon.svg static/favicon.svg
node scripts/og-image.mjs
