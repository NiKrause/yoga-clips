<script>
	// The cinema page: what a `?clip=<id>` link opens instead of the list. One
	// clip on a dark page, as large as the window allows, and nothing else
	// that is not needed — a quiet line saying what it is, "Done", and the way
	// back to the playlist.
	//
	// Nothing is asked of the clip's service until the start control is
	// pressed. That one press does three things a browser grants only on a
	// gesture: it loads the player, lets it start with sound, and asks for
	// fullscreen. Where fullscreen is refused or does not exist (an iPhone),
	// the clip plays large on the dark page instead.
	//
	// Leaving fullscreen, or the player saying the clip is over, comes back
	// here — to "Done" — and not to the list. The page is dark in both
	// themes: it is a cinema, not a view of the app.
	import { onMount, tick } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { formatDuration, parseClipUrl } from './clips/schema.js';
	import ClipFrame from './ClipFrame.svelte';

	/** The clip the link asked for, once it is here. @type {import('./clips/schema.js').Clip | null} */
	export let clip = null;
	/** The clip did not turn up in the playlist. */
	export let missing = false;
	/** Why the app could not start, if it could not. @type {string | null} */
	export let failure = null;
	export let doneToday = false;
	/** @type {(clip: import('./clips/schema.js').Clip) => void} */
	export let ondone = () => {};
	/** Back to the playlist. @type {() => void} */
	export let onleave = () => {};

	/** @type {HTMLDivElement | null} */
	let stage = null;
	/** @type {HTMLButtonElement | null} */
	let startControl = null;
	/** @type {HTMLButtonElement | null} */
	let doneControl = null;
	/** @type {HTMLButtonElement | null} */
	let backControl = null;

	let started = false;
	let fullscreen = false;
	/** Set for a moment by the Escape that left fullscreen, see `onKeydown`. */
	let justLeftFullscreen = false;
	let greeted = false;

	$: parsed = clip ? parseClipUrl(clip.url) : null;
	$: playable = Boolean(parsed?.embedUrl);
	$: instagram = clip?.source === 'instagram';
	$: sourceName = clip ? $_(`source.${clip.source}`) : '';
	$: line = clip
		? [clip.teacher, formatDuration(clip.durationSec), sourceName].filter(Boolean).join(' · ')
		: '';
	// Focus lands on the start control once, when there is one — not again
	// each time the playlist behind it changes.
	$: if (startControl && !greeted) {
		greeted = true;
		startControl.focus();
	}

	function fullscreenElement() {
		return document.fullscreenElement ?? /** @type {any} */ (document).webkitFullscreenElement;
	}

	/** Must be called in the handler of a press: later the browser refuses. */
	function enterFullscreen() {
		const target = /** @type {any} */ (stage);
		const request = target?.requestFullscreen ?? target?.webkitRequestFullscreen;
		if (!request) return;
		try {
			// Refused, or no such thing here: the clip stays large on the page.
			Promise.resolve(request.call(target)).catch(() => {});
		} catch {
			// The same, said synchronously.
		}
	}

	function leaveFullscreen() {
		if (!fullscreenElement()) return;
		const exit = document.exitFullscreen ?? /** @type {any} */ (document).webkitExitFullscreen;
		try {
			Promise.resolve(exit?.call(document)).catch(() => {});
		} catch {
			// Already out.
		}
	}

	function start() {
		started = true;
		enterFullscreen();
	}

	function onFullscreenChange() {
		const now = fullscreenElement() === stage;
		if (fullscreen && !now) {
			justLeftFullscreen = true;
			setTimeout(() => (justLeftFullscreen = false), 100);
			void focusAfterTheClip();
		}
		fullscreen = now;
	}

	async function focusAfterTheClip() {
		await tick();
		(doneControl ?? backControl)?.focus();
	}

	function playerEnded() {
		if (fullscreenElement()) leaveFullscreen();
		else void focusAfterTheClip();
	}

	/** @param {KeyboardEvent} event */
	function onKeydown(event) {
		if (event.key !== 'Escape' || event.defaultPrevented) return;
		// The Escape that left fullscreen has done its work: it does not also
		// leave the cinema. Browsers mostly keep that key press to themselves;
		// where one hands it on, it arrives with the change or just after.
		if (fullscreenElement() || justLeftFullscreen) return;
		onleave();
	}

	function leave() {
		leaveFullscreen();
		onleave();
	}

	onMount(() => {
		// Safari before 16.4 says it with a prefix.
		document.addEventListener('webkitfullscreenchange', onFullscreenChange);
		return () => document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
	});
</script>

<svelte:window on:keydown={onKeydown} />
<svelte:document on:fullscreenchange={onFullscreenChange} />

<section
	class="fixed inset-0 z-40 flex flex-col bg-black text-white"
	aria-label={clip?.title ?? $_('cinema.waiting')}
	data-testid="cinema"
	data-started={started}
	data-fullscreen={fullscreen}
>
	<div
		bind:this={stage}
		class="relative flex min-h-0 flex-1 items-center justify-center bg-black"
		data-testid="cinema-stage"
	>
		{#if !clip}
			<p
				class="max-w-md px-6 text-center text-sm text-white/80"
				role="status"
				data-testid={failure || missing ? 'cinema-missing' : 'cinema-waiting'}
			>
				{failure ?? (missing ? $_('player.notFound') : $_('cinema.waiting'))}
			</p>
		{:else if started && parsed && playable}
			<ClipFrame
				{parsed}
				title={clip.title}
				onended={playerEnded}
				frameClass={instagram ? 'h-full w-full max-w-[32rem] bg-white' : 'h-full w-full'}
			/>
		{:else if playable}
			<button
				type="button"
				bind:this={startControl}
				on:click={start}
				class="group flex flex-col items-center gap-4 rounded-2xl px-10 py-8 text-white outline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
				aria-label={$_('cinema.startLabel', { values: { title: clip.title } })}
				data-testid="cinema-start"
			>
				<span
					class="flex h-28 w-28 items-center justify-center rounded-full bg-accent pl-2 text-5xl text-accent-ink transition-transform group-hover:scale-105 group-hover:brightness-95 sm:h-36 sm:w-36 sm:text-6xl"
					aria-hidden="true">▶</span
				>
				<span class="text-lg font-medium">{$_('cinema.start')}</span>
			</button>
		{:else}
			<div class="flex flex-col items-center gap-4 px-6 text-center">
				<p class="max-w-md text-sm text-white/80">{$_('player.otherHint')}</p>
				<a
					href={clip.url}
					target="_blank"
					rel="noopener noreferrer"
					class="btn btn-primary px-6"
					data-testid="cinema-open-external"
				>
					{$_('clip.openOn', { values: { source: sourceName } })}
				</a>
			</div>
		{/if}
	</div>

	<footer class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 px-4 py-3">
		<div class="min-w-0 flex-1 basis-56">
			{#if clip}
				<h1 class="truncate text-sm font-medium text-white" data-testid="cinema-title">
					{clip.title}
				</h1>
				<p class="truncate text-xs text-white/60" data-testid="cinema-line">
					{line}
				</p>
				{#if instagram && playable}
					<p class="mt-1 text-xs text-white/60" data-testid="cinema-instagram-hint">
						{$_('player.instagramHint')}
					</p>
				{/if}
			{/if}
		</div>

		{#if clip}
			{#if instagram && playable}
				<a
					href={clip.url}
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10"
					data-testid="cinema-open-external"
				>
					{$_('clip.openOn', { values: { source: sourceName } })}
				</a>
			{/if}
			{#if started && playable && !fullscreen}
				<button
					type="button"
					on:click={enterFullscreen}
					class="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10"
					data-testid="cinema-fullscreen"
				>
					{$_('cinema.fullscreen')}
				</button>
			{/if}
			{#if doneToday}
				<span
					class="rounded-md bg-identity-500/20 px-3 py-1.5 text-sm font-medium text-identity-200"
					data-testid="cinema-done-today">✓ {$_('clip.doneToday')}</span
				>
			{:else}
				<button
					type="button"
					bind:this={doneControl}
					on:click={() => clip && ondone(clip)}
					class="btn btn-primary btn-sm"
					data-testid="cinema-done"
				>
					✓ {$_('clip.done')}
				</button>
			{/if}
		{/if}
		<button
			type="button"
			bind:this={backControl}
			on:click={leave}
			class="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white hover:bg-white/10"
			data-testid="cinema-back"
		>
			{$_('cinema.back')}
		</button>
	</footer>
</section>
