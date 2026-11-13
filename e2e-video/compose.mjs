// After a recording run: every scene and card with its voice and subtitles
// into <out dir>, and with --film the film end to end. Playwright wipes
// e2e-video/results/ on the next run, so compose at once.
//
//   node e2e-video/compose.mjs <out dir> [--film e2e-video/films/intro-en.json]
import { fileURLToPath } from 'node:url';
import { composeCli } from '@le-space/video-kit/compose';
import { NIGHT } from './brand.js';

composeCli(process.argv.slice(2), {
	results: fileURLToPath(new URL('./results/', import.meta.url)),
	night: NIGHT
});
