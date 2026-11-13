// The demo film's scenes (e2e-video/): the app built as for the E2E specs,
// with its own relay, one browser, 16:9, and a video of every page. Not part
// of `pnpm test:e2e`. DEMO_LANG=de records the German app and lines,
// DEMO_RES the frame height (1080 by default; 2160 for YouTube),
// DEMO_VOICE=say a dry run with macOS's voice. The kit is @le-space/video-kit.
import { defineConfig, devices } from '@playwright/test';

// Ports of their own, so a film can be recorded while the E2E suite runs.
const port = Number((process.env.E2E_PREVIEW_PORT ||= '4283'));
const relay = {
	E2E_RELAY_HTTP_PORT: '49210',
	E2E_RELAY_TCP_PORT: '49211',
	E2E_RELAY_WS_PORT: '49212',
	E2E_RELAY_WEBRTC_PORT: '49213',
	E2E_RELAY_WEBRTC_DIRECT_PORT: '49216'
};
for (const [key, value] of Object.entries(relay)) process.env[key] ||= value;
const height = Number(process.env.DEMO_RES || 1080);
const viewport = { width: Math.round((height * 16) / 9), height };

export default defineConfig({
	testDir: 'e2e-video',
	outputDir: 'e2e-video/results',
	retries: 0,
	workers: 1,
	timeout: 900_000,
	expect: { timeout: 30_000 },
	webServer: {
		command: 'node e2e/start-e2e-server.mjs',
		env: { E2E_PREVIEW_PORT: String(port), ...relay },
		port,
		reuseExistingServer: false,
		timeout: 240_000
	},
	use: {
		// The app as people see it: its own address, answered from the local
		// build (e2e-video/stand-ins.js), so the links and QR codes in the film
		// are the real ones.
		baseURL: 'https://yoga-clips.le-space.de',
		serviceWorkers: 'block',
		actionTimeout: 30_000,
		locale: process.env.DEMO_LANG === 'de' ? 'de-DE' : 'en-GB',
		viewport,
		video: { mode: 'on', size: viewport },
		screenshot: 'off',
		trace: 'off'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				viewport,
				// The page is the public address, the relay is on this machine:
				// Chrome's local network checks would keep the two apart. Only for
				// this recording browser.
				launchOptions: {
					args: [
						'--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults'
					]
				}
			}
		}
	]
});
