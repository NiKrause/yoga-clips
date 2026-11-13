// Yoga Clips' side of its demo film, on @le-space/video-kit: the signet and
// the wordmark on the title cards in Le Space Belege's night palette, the
// narrator's voice folder, and the scene preconfigured with both.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCards } from '@le-space/video-kit/card';
import { qrSvg } from '@le-space/video-kit/qr';
import { startScene as kitStartScene } from '@le-space/video-kit/scene';
import { createVoice } from '@le-space/video-kit/voice';

export const NIGHT = '#0b0e15';
export const APP_URL = 'https://yoga-clips.le-space.de/';
/** The language of this run: DEMO_LANG=de records the German app and lines. */
export const LANG = process.env.DEMO_LANG === 'de' ? 'de' : 'en';

/** Spoken lines are kept in e2e-video/voice/ (not in git). */
export const voice = createVoice({ dir: fileURLToPath(new URL('./voice/', import.meta.url)) });

/**
 * A scene of Yoga Clips, narrated, on the night.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Record<string, string> | string[]} lines
 * @param {{ lang?: string, captions?: boolean }} [options]
 */
export const startScene = (page, context, lines, options = {}) =>
	kitStartScene(page, context, lines, { voice, night: NIGHT, lang: LANG, ...options });

const font = `data:font/woff2;base64,${readFileSync(new URL('../src/lib/fonts/sora-latin-wght-normal.woff2', import.meta.url)).toString('base64')}`;

// The countdown (brand/mark-dark.svg): the arc draws itself as a timer runs,
// then the play triangle settles in.
const MARK = `<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">
  <path class="arc" d="M50 15A35 35 0 1 1 15 50" fill="none" stroke-width="14" stroke-linecap="round" pathLength="100"/>
  <path class="play" d="M43 37V63L65 50Z" stroke-width="8" stroke-linejoin="round"/>
</svg>`;

/** @type {string | null} */
let qr = null;

/** @type {import('@le-space/video-kit/card').Brand} */
export const BRAND = {
	name: 'Le Space Yoga Clips',
	introTitle: 'yoga clips',
	mark: () => MARK,
	words: `<span class="words" aria-hidden="true"><span class="prefix">LE SPACE</span><span class="name">yoga clips</span></span>`,
	css: `.arc { stroke: var(--accent); stroke-dasharray: 100; stroke-dashoffset: 100; }
.play { fill: var(--snow); stroke: var(--snow); opacity: 0; transform: scale(.85); transform-origin: 54px 50px; }
.go .arc { animation: draw 900ms cubic-bezier(.2,.7,.2,1) 200ms forwards; }
.go .play { animation: settle 600ms cubic-bezier(.2,.7,.2,1) 800ms forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes settle { to { opacity: 1; transform: none; } }
`,
	stillCss:
		'.scene .arc{stroke-dashoffset:0;animation:none}.scene .play{opacity:1;transform:none;animation:none}',
	palette: {
		night: NIGHT,
		panel: '#161b26',
		snow: '#f4f6fb',
		muted: '#8a94a6',
		accent: '#c6f24e',
		accent2: '#7c5cff',
		ink: '#0f1b2d',
		line: '#2a3140'
	},
	font: { family: 'Sora', src: font },
	site: 'yoga-clips.le-space.de',
	get qr() {
		return (qr ??= qrSvg(APP_URL, { ink: '#0f1b2d' }));
	},
	texts: {
		en: {
			tagline: 'A short yoga clip while Claude works.',
			introSay: 'Yoga Clips. A short yoga clip while Claude works.',
			scene: 'Part',
			facts: ['no account, no server', 'open source, MIT', 'playlists shared by link'],
			outroSay: 'Yoga Clips. Find it at yoga clips dot le-space dot de.',
			scan: 'Scan to open the app'
		},
		de: {
			tagline: 'Ein kurzer Yoga-Clip, während Claude arbeitet.',
			introSay: 'Yoga Clips. Ein kurzer Yoga-Clip, während Claude arbeitet.',
			scene: 'Teil',
			facts: ['kein Konto, kein Server', 'Open Source, MIT', 'Playlists per Link teilen'],
			outroSay: 'Yoga Clips. Zu finden unter yoga clips Punkt le-space Punkt de.',
			scan: 'Scannen und die App öffnen'
		}
	}
};

export const cards = createCards(BRAND);
