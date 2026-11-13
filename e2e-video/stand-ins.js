// What the film shows of YouTube, without YouTube: made-up clips (teachers,
// titles, lengths), answered by stand-ins for its oEmbed endpoint, its
// thumbnails and its player. The recording contacts no video service, shows
// no third party's video, and says "sample video" on the one it plays.
import { LANG } from './brand.js';

/** Made-up clips; YouTube-shaped ids that are nobody's video. */
export const CLIPS = {
	shoulders: {
		id: 'DemoClip001',
		hue: 28,
		seconds: 300,
		teacher: 'Mara Wolkenstein',
		title: { en: 'Shoulders free at the desk', de: 'Schultern lösen am Schreibtisch' },
		tags: { en: 'shoulders, seated', de: 'schultern, sitzen' }
	},
	wrists: {
		id: 'DemoClip002',
		hue: 200,
		seconds: 180,
		teacher: 'Jonas Feldberg',
		title: { en: 'Wrist and hand warm-up', de: 'Handgelenke aufwärmen' },
		tags: { en: 'hands', de: 'hände' }
	},
	side: {
		id: 'DemoClip003',
		hue: 150,
		seconds: 240,
		teacher: 'Mara Wolkenstein',
		title: { en: 'Standing side stretch', de: 'Seitdehnung im Stehen' },
		tags: { en: 'standing', de: 'stehen' }
	}
};

/** @param {keyof typeof CLIPS} key */
export const clipUrl = (key) => `https://www.youtube.com/watch?v=${CLIPS[key].id}`;

/** @param {keyof typeof CLIPS} key */
export const clip = (key) => ({
	url: clipUrl(key),
	title: CLIPS[key].title[LANG],
	teacher: CLIPS[key].teacher,
	duration: `${Math.floor(CLIPS[key].seconds / 60)}:${String(CLIPS[key].seconds % 60).padStart(2, '0')}`,
	tags: CLIPS[key].tags[LANG]
});

const byId = (/** @type {string} */ id) => Object.values(CLIPS).find((c) => c.id === id);

/** A calm picture for a clip: a gradient, a low sun, a horizon. No text. */
function picture(/** @type {number} */ hue) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="hsl(${hue} 55% 78%)"/><stop offset="1" stop-color="hsl(${hue + 30} 45% 45%)"/></linearGradient></defs>
<rect width="480" height="270" fill="url(#g)"/>
<circle cx="240" cy="168" r="54" fill="hsl(${hue + 10} 90% 92%)" opacity=".75"/>
<rect y="180" width="480" height="90" fill="hsl(${hue + 40} 35% 32%)" opacity=".85"/>
</svg>`;
}

/** The player: reports its length when greeted; with autoplay it plays and ends. */
function player(
	/** @type {{ hue: number, seconds: number }} */ c,
	/** @type {URLSearchParams} */ q
) {
	const label = LANG === 'de' ? 'Beispielvideo' : 'sample video';
	const plays = q.get('autoplay') === '1';
	return `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; height: 100%; overflow: hidden; background: #000; font-family: system-ui, sans-serif; }
.frame { position: absolute; inset: 0; }
.frame svg { width: 100%; height: 100%; display: block; }
.breath { position: absolute; left: 50%; top: 52%; width: 22vmin; height: 22vmin; margin: -11vmin; border-radius: 50%;
  border: .8vmin solid rgba(255,255,255,.85); animation: breathe 4s ease-in-out infinite; }
@keyframes breathe { 0%, 100% { transform: scale(.75); opacity: .55; } 50% { transform: scale(1.15); opacity: 1; } }
.label { position: absolute; left: 3vmin; top: 3vmin; padding: .6vmin 1.4vmin; border-radius: 1vmin;
  background: rgba(0,0,0,.45); color: #fff; font-size: 2.4vmin; letter-spacing: .04em; }
.bar { position: absolute; left: 0; bottom: 0; height: .9vmin; width: 0; background: #ff3b30; }
.playing .bar { animation: run var(--ms) linear forwards; }
@keyframes run { to { width: 100%; } }
</style></head><body class="${plays ? 'playing' : ''}" style="--ms: ${PLAY_MS}ms">
<div class="frame">${picture(c.hue)}</div><div class="breath"></div><div class="label">${label}</div><div class="bar"></div>
<script>
let greeted = false;
const say = (event, info) => parent.postMessage(JSON.stringify({ event, info }), '*');
addEventListener('message', (e) => {
  let m; try { m = JSON.parse(e.data); } catch { return; }
  if (m.event !== 'listening' || greeted) return;
  greeted = true;
  say('initialDelivery', { duration: ${c.seconds}, playerState: ${plays ? 1 : 5} });
  ${plays ? `setTimeout(() => say('infoDelivery', { playerState: 0 }), ${PLAY_MS});` : ''}
});
</script></body></html>`;
}

/** How long the stand-in plays before it says the clip is over. */
export const PLAY_MS = 7000;

const VIDEO_HOSTS =
	/^https:\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|ggpht\.com|google\.com|gstatic\.com|googleapis\.com|vimeo\.com|vimeocdn\.com|instagram\.com|cdninstagram\.com)\//;

const APP = 'https://yoga-clips.le-space.de';
const BUILD = `http://localhost:${process.env.E2E_PREVIEW_PORT || 4283}`;

/**
 * The app's own address answered from the local build, and every request to
 * a video service by a stand-in.
 * @param {import('@playwright/test').BrowserContext} context
 */
export async function standIns(context) {
	await context.route(`${APP}/**`, async (route) => {
		const url = new URL(route.request().url());
		const response = await route.fetch({ url: `${BUILD}${url.pathname}${url.search}` });
		await route.fulfill({ response });
	});
	await context.route(VIDEO_HOSTS, (route) => {
		const url = new URL(route.request().url());
		if (url.hostname === 'www.youtube.com' && url.pathname === '/oembed') {
			const id = new URL(url.searchParams.get('url') ?? '').searchParams.get('v') ?? '';
			const c = byId(id);
			if (!c) return route.fulfill({ status: 404, body: '' });
			return route.fulfill({
				contentType: 'application/json',
				headers: { 'access-control-allow-origin': '*' },
				body: JSON.stringify({
					title: c.title[LANG],
					author_name: c.teacher,
					thumbnail_url: `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`
				})
			});
		}
		if (url.hostname === 'i.ytimg.com') {
			const c = byId(url.pathname.split('/')[2] ?? '');
			return route.fulfill({ contentType: 'image/svg+xml', body: picture(c?.hue ?? 220) });
		}
		if (url.hostname === 'www.youtube-nocookie.com' && url.pathname.startsWith('/embed/')) {
			const c = byId(url.pathname.split('/')[2] ?? '');
			if (c) return route.fulfill({ contentType: 'text/html', body: player(c, url.searchParams) });
		}
		return route.fulfill({ status: 204, body: '' });
	});
}
