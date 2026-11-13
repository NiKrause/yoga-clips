<script>
	// The bridge to the yoga-break mod: clips.json out, clips.json in.
	import { _ } from '$lib/i18n/index.js';
	import { parseImport } from './clips/schema.js';
	import YogaBreakHint from './YogaBreakHint.svelte';
	import { clipsCountStore, exportClips, importClips, activePlaylistStore } from './clips/store.js';

	/** @type {(message: string, type?: 'default' | 'success' | 'error' | 'warning') => void} */
	export let notify = () => {};

	/** @type {HTMLInputElement | null} */
	let fileInput = null;
	let importing = false;

	function download() {
		const document_ = exportClips();
		if (!document_.clips.length) {
			notify($_('transfer.nothing'), 'warning');
			return;
		}
		const blob = new Blob([JSON.stringify(document_, null, 2) + '\n'], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'clips.json';
		anchor.rel = 'noopener';
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	/** @param {Event} event */
	async function onFile(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		importing = true;
		try {
			const { clips, rejected } = parseImport(await file.text());
			const result = await importClips(clips);
			if (result.kind === 'denied') {
				notify($_('clip.denied'), 'error');
			} else if (result.kind) {
				notify($_('transfer.importFailed', { values: { reason: result.message ?? '' } }), 'error');
			} else {
				notify(
					$_('transfer.imported', { values: { added: result.added, skipped: result.skipped } }),
					'success'
				);
			}
			if (rejected.length) {
				notify($_('transfer.importRejected', { values: { count: rejected.length } }), 'warning');
				console.warn('Rejected clips in import:', rejected);
			}
		} catch (error) {
			notify(
				$_('transfer.importFailed', {
					values: { reason: error instanceof Error ? error.message : String(error) }
				}),
				'error'
			);
		} finally {
			importing = false;
		}
	}

	$: canWrite = $activePlaylistStore.kind !== 'none';
</script>

<section class="card mt-4 p-4" data-testid="transfer-panel">
	<div class="flex flex-wrap items-center gap-3">
		<div class="min-w-0 flex-1">
			<h2 class="text-lg font-semibold text-heading">{$_('transfer.heading')}</h2>
			<p class="mt-1 text-xs text-faint">{$_('transfer.hint')}</p>
		</div>
		<button
			type="button"
			on:click={download}
			disabled={!canWrite || $clipsCountStore === 0}
			data-testid="export-clips"
			class="btn btn-ghost btn-sm"
		>
			{$_('transfer.export')}
		</button>
		<button
			type="button"
			on:click={() => fileInput?.click()}
			disabled={!canWrite || importing}
			data-testid="import-clips"
			class="btn btn-ghost btn-sm"
		>
			{$_('transfer.import')}
		</button>
		<input
			type="file"
			accept="application/json,.json"
			bind:this={fileInput}
			on:change={onFile}
			class="hidden"
			data-testid="import-clips-file"
		/>
	</div>
	<YogaBreakHint playlistAddress={$activePlaylistStore.address} />
</section>
