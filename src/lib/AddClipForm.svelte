<script>
	// Paste a link, get title and preview filled in where the service offers
	// them (YouTube, Vimeo — oEmbed, no key), type the rest. The duration is
	// always typed: oEmbed does not carry it.
	import { _ } from '$lib/i18n/index.js';
	import { parseClipUrl, parseDurationInput } from './clips/schema.js';
	import { fetchOEmbed } from './clips/oembed.js';
	import { rememberThumbnail } from './clips/thumbnails.js';
	import { addClip, teachersStore, activePlaylistStore } from './clips/store.js';

	export let disabled = false;
	/** @type {(message: string, type?: 'default' | 'success' | 'error' | 'warning') => void} */
	export let notify = () => {};

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

	$: parsed = parseClipUrl(url);
	$: source = parsed?.source ?? null;
	$: if (parsed && parsed.url !== lookedUpFor) void lookup(parsed.url);
	$: if (!parsed) {
		lookedUpFor = '';
		thumbnailUrl = null;
	}

	/** @param {string} canonical */
	async function lookup(canonical) {
		lookedUpFor = canonical;
		lookupController?.abort();
		thumbnailUrl = parsed?.thumbnailUrl ?? null;
		if (!parsed || (parsed.source !== 'youtube' && parsed.source !== 'vimeo')) return;
		const controller = new AbortController();
		lookupController = controller;
		looking = true;
		try {
			const info = await fetchOEmbed(canonical, { signal: controller.signal });
			if (controller.signal.aborted || lookedUpFor !== canonical) return;
			if (info) {
				// Never overwrite what the person typed — only fill what is empty.
				if (!title.trim() && info.title) title = info.title;
				if (!teacher.trim() && info.authorName) teacher = info.authorName;
				if (info.thumbnailUrl) thumbnailUrl = info.thumbnailUrl;
			}
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
				<span class="mt-1 block text-[10px]">{$_('clip.durationHint')}</span>
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
