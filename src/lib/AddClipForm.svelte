<script>
	// Paste a link, get title, preview and length filled in where the service
	// offers them, type the rest. Title and preview come from oEmbed (YouTube,
	// Vimeo — no key). The length comes from oEmbed at Vimeo and from the
	// player at YouTube, whose oEmbed has none. Nothing here waits for a
	// service: a clip can be added while a lookup is still out.
	import { _ } from '$lib/i18n/index.js';
	import {
		MAX_DURATION_SEC,
		MIN_DURATION_SEC,
		formatDuration,
		parseClipUrl,
		parseDurationInput
	} from './clips/schema.js';
	import { fetchOEmbed } from './clips/oembed.js';
	import { readYouTubeDuration } from './clips/youtube-duration.js';
	import { rememberThumbnail } from './clips/thumbnails.js';
	import { addClip, teachersStore, activePlaylistStore } from './clips/store.js';

	export let disabled = false;
	/** @type {(message: string, type?: 'default' | 'success' | 'error' | 'warning') => void} */
	export let notify = () => {};
	/** The two lookups, replaceable so a test needs no YouTube and no Vimeo. */
	export let lookupOEmbed = fetchOEmbed;
	export let lookupYouTubeDuration = readYouTubeDuration;

	let url = '';
	let title = '';
	let teacher = '';
	let duration = '';
	let tags = '';
	let busy = false;
	let looking = false;
	/** @type {string | null} */
	let errorMessage = null;
	/** @type {string | null} */
	let thumbnailUrl = null;
	/** @type {AbortController | null} */
	let lookupController = null;
	let lookedUpFor = '';
	/**
	 * What a lookup wrote into the duration field. While the field still holds
	 * exactly this, nobody typed it — so the next link may replace it. Without
	 * that, a second link would be saved with the first one's length.
	 */
	let filledDuration = '';
	/**
	 * What the hint under the field has to be true about: nothing looked up
	 * (`idle`), the length taken from the service (`filled`), a service that
	 * should have told and did not (`missing`), or a length this app has no
	 * clip for (`outOfRange`).
	 *
	 * @type {'idle' | 'filled' | 'missing' | 'outOfRange'}
	 */
	let durationFrom = 'idle';
	let reportedLength = '';

	$: parsed = parseClipUrl(url);
	$: source = parsed?.source ?? null;
	$: if (parsed && parsed.url !== lookedUpFor) void lookup(parsed.url);
	$: if (!parsed) {
		lookedUpFor = '';
		thumbnailUrl = null;
		lookupController?.abort();
		forgetFilledDuration();
	}
	// A filled length somebody then changed is theirs, and the hint stops
	// naming the service as its source.
	$: if (durationFrom === 'filled' && duration !== filledDuration) durationFrom = 'idle';

	function forgetFilledDuration() {
		if (filledDuration && duration === filledDuration) duration = '';
		filledDuration = '';
		durationFrom = 'idle';
	}

	/** @param {number | null} seconds what the service reported, if anything */
	function offerDuration(seconds) {
		if (seconds === null) {
			durationFrom = 'missing';
			return;
		}
		if (seconds < MIN_DURATION_SEC || seconds > MAX_DURATION_SEC) {
			reportedLength = formatDuration(seconds);
			durationFrom = 'outOfRange';
			return;
		}
		// Never overwrite what the person typed — only fill what is empty.
		if (duration.trim()) return;
		duration = formatDuration(seconds);
		filledDuration = duration;
		durationFrom = 'filled';
	}

	/** @param {string} canonical */
	async function lookup(canonical) {
		lookedUpFor = canonical;
		lookupController?.abort();
		thumbnailUrl = parsed?.thumbnailUrl ?? null;
		forgetFilledDuration();
		if (!parsed || (parsed.source !== 'youtube' && parsed.source !== 'vimeo')) return;
		const { source: service, videoId } = parsed;
		const controller = new AbortController();
		const { signal } = controller;
		lookupController = controller;
		looking = true;
		const stillWanted = () => !signal.aborted && lookedUpFor === canonical;

		// Two questions, each answered when it is: the title does not wait the
		// seconds YouTube's player takes to load.
		const details = Promise.resolve()
			.then(() => lookupOEmbed(canonical, { signal }))
			.catch(() => null)
			.then((info) => {
				if (!info || !stillWanted()) return null;
				if (!title.trim() && info.title) title = info.title;
				if (!teacher.trim() && info.authorName) teacher = info.authorName;
				if (info.thumbnailUrl) thumbnailUrl = info.thumbnailUrl;
				return info.durationSec ?? null;
			});
		const fromPlayer =
			service === 'youtube' && videoId
				? Promise.resolve()
						.then(() => lookupYouTubeDuration(videoId, { signal }))
						.catch(() => null)
				: Promise.resolve(null);

		try {
			const [fromOEmbed, playerSeconds] = await Promise.all([details, fromPlayer]);
			if (stillWanted()) offerDuration(fromOEmbed ?? playerSeconds);
		} finally {
			if (lookupController === controller) {
				looking = false;
				lookupController = null;
			}
		}
	}

	async function submit() {
		errorMessage = null;
		// Read the field directly rather than through `parsed`: a submit that
		// follows the last keystroke in the same tick would otherwise judge the
		// previous value.
		const parsed = parseClipUrl(url);
		if (!parsed) {
			errorMessage = $_('clip.invalidUrl');
			return;
		}
		if (!title.trim()) {
			errorMessage = $_('clip.invalidTitle');
			return;
		}
		const durationSec = parseDurationInput(duration);
		if (durationSec === null) {
			errorMessage = $_('clip.invalidDuration');
			return;
		}
		busy = true;
		try {
			const result = await addClip({ url, title, teacher, durationSec, tags });
			if (result.ok) {
				rememberThumbnail(result.clip.id, thumbnailUrl);
				url = '';
				title = '';
				duration = '';
				filledDuration = '';
				durationFrom = 'idle';
				tags = '';
				thumbnailUrl = null;
				notify($_('clip.added'), 'success');
				return;
			}
			if (result.kind === 'denied') errorMessage = $_('clip.denied');
			else if (result.kind === 'noPlaylist') errorMessage = $_('clip.noPlaylist');
			else if (result.kind === 'invalid')
				errorMessage = /durationSec/.test(result.message)
					? $_('clip.invalidDuration')
					: /url/.test(result.message)
						? $_('clip.invalidUrl')
						: $_('clip.failed', { values: { reason: result.message } });
			else errorMessage = $_('clip.failed', { values: { reason: result.message } });
		} finally {
			busy = false;
		}
	}

	$: formDisabled = disabled || $activePlaylistStore.kind === 'none';
</script>

<section
	class="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
	data-testid="add-clip"
>
	<h2 class="text-lg font-semibold text-heading">{$_('clip.addHeading')}</h2>
	{#if $activePlaylistStore.kind === 'none' && !disabled}
		<p class="mt-1 text-xs text-faint">{$_('clip.noPlaylist')}</p>
	{/if}
	<form class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]" on:submit|preventDefault={submit}>
		<div class="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto]">
			<label class="block text-xs text-faint">
				{$_('clip.urlLabel')}
				{#if source}
					<span
						class="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-heading"
						data-testid="clip-source">{$_(`source.${source}`)}</span
					>
				{/if}
				{#if looking && source}
					<span class="ml-1 text-[10px]"
						>{$_('clip.looking', { values: { source: $_(`source.${source}`) } })}</span
					>
				{/if}
				<input
					type="url"
					inputmode="url"
					bind:value={url}
					placeholder={$_('clip.urlPlaceholder')}
					disabled={formDisabled}
					data-testid="clip-url"
					class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
				/>
			</label>
			{#if thumbnailUrl}
				<img
					src={thumbnailUrl}
					alt=""
					referrerpolicy="no-referrer"
					class="h-16 w-28 self-end rounded object-cover"
					data-testid="clip-preview"
				/>
			{/if}
		</div>

		<label class="block text-xs text-faint sm:col-span-2">
			{$_('clip.titleLabel')}
			<input
				type="text"
				bind:value={title}
				placeholder={$_('clip.titlePlaceholder')}
				disabled={formDisabled}
				data-testid="clip-title"
				class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
			/>
		</label>

		<div class="grid gap-3 sm:col-span-2 sm:grid-cols-3">
			<label class="block text-xs text-faint">
				{$_('clip.teacherLabel')}
				<input
					type="text"
					bind:value={teacher}
					list="yoga-teachers"
					placeholder={$_('clip.teacherPlaceholder')}
					disabled={formDisabled}
					data-testid="clip-teacher"
					class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
				/>
				<datalist id="yoga-teachers">
					{#each $teachersStore as name (name)}
						<option value={name}></option>
					{/each}
				</datalist>
			</label>
			<label class="block text-xs text-faint">
				{$_('clip.durationLabel')}
				<input
					type="text"
					inputmode="numeric"
					bind:value={duration}
					placeholder={$_('clip.durationPlaceholder')}
					disabled={formDisabled}
					data-testid="clip-duration"
					class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
				/>
				<span
					class="mt-1 block text-[10px]"
					data-testid="clip-duration-hint"
					data-duration-from={durationFrom}
				>
					{#if durationFrom === 'filled' && source}
						{$_('clip.durationHintFilled', { values: { source: $_(`source.${source}`) } })}
					{:else if durationFrom === 'missing' && source}
						{$_('clip.durationHintMissing', { values: { source: $_(`source.${source}`) } })}
					{:else if durationFrom === 'outOfRange' && source}
						{$_('clip.durationHintOutOfRange', {
							values: { source: $_(`source.${source}`), length: reportedLength }
						})}
					{:else}
						{$_('clip.durationHint')}
					{/if}
				</span>
			</label>
			<label class="block text-xs text-faint">
				{$_('clip.tagsLabel')}
				<input
					type="text"
					bind:value={tags}
					placeholder={$_('clip.tagsPlaceholder')}
					disabled={formDisabled}
					data-testid="clip-tags"
					class="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
				/>
			</label>
		</div>

		<div class="flex items-center gap-3 sm:col-span-2">
			<button
				type="submit"
				disabled={formDisabled || busy}
				data-testid="clip-add"
				class="rounded-md bg-coral-700 px-6 py-2 font-medium text-white transition-colors hover:bg-coral-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{busy ? $_('clip.adding') : $_('clip.add')}
			</button>
			{#if errorMessage}
				<p class="text-xs text-danger" role="alert" data-testid="clip-error">{errorMessage}</p>
			{/if}
		</div>
	</form>
</section>
