<script>
	// Where this playlist is used outside the app: the yoga-break mod for
	// Claude Code suggests one of its clips while a long tool call runs. The
	// mod is not in a directory people would find it in, so the app that
	// fills its clips.json says where it is and how the two are joined.
	//
	// Only text and one link: nothing is requested from GitHub by showing it.
	import { _ } from '$lib/i18n/index.js';
	import { buildAppLink } from './clips/share.js';

	/** The open playlist's OrbitDB address. */
	export let playlistAddress = '';

	const REPOSITORY = 'https://github.com/NiKrause/yoga-break';
	const INSTALL = 'claude plugin install yoga-break --marketplace NiKrause/yoga-break';

	let copied = '';

	$: link = playlistAddress
		? buildAppLink(typeof location === 'undefined' ? '' : location.origin, { db: playlistAddress })
		: '';
	$: playlistCommand = link ? `/yoga playlist ${link}` : '';

	/** @param {string} what @param {string} text */
	async function copy(what, text) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => (copied = ''), 2000);
		} catch (error) {
			console.warn('Clipboard unavailable:', error);
		}
	}
</script>

<div class="mt-4 border-t border-border pt-3 text-xs text-faint" data-testid="yoga-break-hint">
	<p>
		<a
			href={REPOSITORY}
			target="_blank"
			rel="noopener noreferrer"
			class="font-semibold underline"
			data-testid="yoga-break-link">Yoga Break</a
		>
		— {$_('yogaBreak.what')}
	</p>
	<ol class="mt-2 list-decimal space-y-2 pl-5">
		<li>
			{$_('yogaBreak.install')}
			<span class="mt-1 flex items-center gap-2">
				<code class="min-w-0 flex-1 font-mono break-all text-text" data-testid="yoga-break-install"
					>{INSTALL}</code
				>
				<button
					type="button"
					on:click={() => copy('install', INSTALL)}
					class="btn btn-ghost btn-sm shrink-0"
					data-testid="yoga-break-copy-install"
				>
					{copied === 'install' ? $_('share.copied') : $_('share.copy')}
				</button>
			</span>
		</li>
		<li>{$_('yogaBreak.export')}</li>
		{#if playlistCommand}
			<li>
				{$_('yogaBreak.playlist')}
				<span class="mt-1 flex items-center gap-2">
					<code
						class="min-w-0 flex-1 font-mono break-all text-text"
						data-testid="yoga-break-playlist-command">{playlistCommand}</code
					>
					<button
						type="button"
						on:click={() => copy('playlist', playlistCommand)}
						class="btn btn-ghost btn-sm shrink-0"
						data-testid="yoga-break-copy-playlist"
					>
						{copied === 'playlist' ? $_('share.copied') : $_('share.copy')}
					</button>
				</span>
			</li>
		{/if}
	</ol>
</div>
