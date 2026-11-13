<script>
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { _ } from '$lib/i18n/index.js';
	import { peerIdStore, initializationStore, ownDidStore, libp2pStore } from '$lib/p2p-stores.js';
	import PasskeyOnboarding from '$lib/PasskeyOnboarding.svelte';
	import PasskeyStepDialog from '$lib/PasskeyStepDialog.svelte';
	import { beginPasskeyFlow, PROMPTS_TO_CREATE } from '$lib/passkey-steps.js';
	import DidBadge from '$lib/DidBadge.svelte';
	import { createPasskeyCredential, recoverPasskeyCredential } from '$lib/passkey-identity.js';
	import {
		orbitdbStore,
		clipsStore,
		teachersStore,
		tagsStore,
		activePlaylistStore,
		requestedClipStore,
		removeClip,
		playlistDisplayName
	} from '$lib/clips/store.js';
	import {
		loadDoneLog,
		saveDoneLog,
		markDone,
		unmarkLast,
		practiceStats,
		doneToday
	} from '$lib/clips/done.js';
	import { formatVersions } from '$lib/build-info.js';
	import ConsentModal from '$lib/ConsentModal.svelte';
	import SocialIcons from '$lib/SocialIcons.svelte';
	import ThemeToggle from '$lib/ThemeToggle.svelte';
	import LanguageSwitcher from '$lib/LanguageSwitcher.svelte';
	import YogaClipsLogo from '$lib/YogaClipsLogo.svelte';
	import ConnectionPoint from '$lib/ConnectionPoint.svelte';
	import PlaylistAddress from '$lib/PlaylistAddress.svelte';
	import ToastNotification from '$lib/ToastNotification.svelte';
	import P2PStatusNav from '$lib/P2PStatusNav.svelte';
	import ErrorAlert from '$lib/ErrorAlert.svelte';
	import ConnectedPeers from '$lib/ConnectedPeers.svelte';
	import PeerIdCard from '$lib/PeerIdCard.svelte';
	import OwnMultiaddrs from '$lib/OwnMultiaddrs.svelte';
	import ManualConnectForm from '$lib/ManualConnectForm.svelte';
	import Library from '$lib/Library.svelte';
	import PlaylistView from '$lib/PlaylistView.svelte';
	import BottomBar from '$lib/BottomBar.svelte';
	import { goTo, sectionOf, viewStore } from '$lib/views.js';
	import { lastClip, rememberLastClip } from '$lib/clips/summaries.js';
	import SharePanel from '$lib/SharePanel.svelte';
	import PermissionsPanel from '$lib/PermissionsPanel.svelte';
	import AddClipForm from '$lib/AddClipForm.svelte';
	import ClipFilters from '$lib/ClipFilters.svelte';
	import ClipGrid from '$lib/ClipGrid.svelte';
	import ClipPlayer from '$lib/ClipPlayer.svelte';
	import ClipCinema from '$lib/ClipCinema.svelte';
	import { parseAppLink } from '$lib/clips/share.js';
	import TransferPanel from '$lib/TransferPanel.svelte';
	import PracticeStats from '$lib/PracticeStats.svelte';

	/** @typedef {'default' | 'success' | 'error' | 'warning'} ToastType */
	/** @typedef {import('$lib/clips/schema.js').Clip} Clip */

	const CONSENT_KEY = `consentAccepted@${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}`;
	const IDENTITY_MODE_KEY = 'yogaClips.identityMode';
	const DEEP_LINK_PATIENCE_MS = 20_000;

	/** @type {'create' | 'existing' | 'anonymous'} */
	let identityMode = 'anonymous';
	let passkeyLabel = '';

	/** @type {string | null} */
	let toastMessage = null;
	/** @type {ToastType} */
	let toastType = 'default';
	let toastDuration = 3000;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let toastTimer = null;
	/** @type {string | null} */
	let error = null;
	/** @type {string | null} */
	let notice = null;
	// The identity choice `error` complains about, while it is that complaint.
	/** @type {string | null} */
	let complainedAbout = null;

	let showModal = true;
	let rememberDecision = false;

	// Filters
	let filterTeacher = '';
	let filterTag = '';
	let filterMinutes = 0;

	// Player
	/** @type {Clip | null} */
	let playing = null;

	// What the library knows without opening every playlist: each one's clips
	// and minutes from when it was last open here, and the clip played last.
	let last = typeof localStorage === 'undefined' ? null : lastClip();
	$: continueClip =
		last && last.playlist === $activePlaylistStore.address
			? ($clipsStore.find((clip) => clip.id === last?.clip) ?? null)
			: null;

	/** @param {Clip} clip */
	function rememberPlayed(clip) {
		if (!$activePlaylistStore.address) return;
		last = { playlist: $activePlaylistStore.address, clip: clip.id };
		rememberLastClip(last);
	}

	/** The add-a-clip sheet, opened by the plus. @type {HTMLDialogElement | null} */
	let addSheet = null;

	$: navItems = [
		{ id: 'library', label: $_('nav.library'), href: '#library', icon: 'library' },
		{ id: 'practise', label: $_('nav.practise'), href: '#practise', icon: 'practise' },
		{ id: 'share', label: $_('nav.share'), href: '#share', icon: 'share' },
		{ id: 'me', label: $_('nav.me'), href: '#me', icon: 'me' }
	];

	// Done marks, scoped to the identity that is signed in.
	$: identityId = String($ownDidStore ?? $orbitdbStore?.identity?.id ?? '');
	/** @type {import('$lib/clips/done.js').DoneLog} */
	let doneLog = {};
	let doneLogFor = '';
	$: if (identityId !== doneLogFor) {
		doneLogFor = identityId;
		doneLog = identityId ? loadDoneLog(identityId) : {};
	}
	$: stats = practiceStats(doneLog, $clipsStore);

	$: filtered = $clipsStore.filter(
		(clip) =>
			(!filterTeacher || clip.teacher === filterTeacher) &&
			(!filterTag || clip.tags.includes(filterTag)) &&
			(filterMinutes <= 0 || clip.durationSec <= filterMinutes * 60)
	);

	// A `?clip=<id>` link opens the cinema page instead of the list: the one
	// clip, large, on a dark page. The clip may take a moment — a guest's copy
	// arrives from the relay — so the cinema waits, and says so if the clip
	// never turns up. Nothing of the list is drawn meanwhile, so no card asks
	// a service for a thumbnail behind the cinema's back.
	let cinema = typeof location !== 'undefined' && parseAppLink(location.search).clip !== null;
	/** @type {Clip | null} */
	let cinemaClip = null;
	let cinemaMissing = false;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let deepLinkTimer = null;
	$: resolveDeepLink($requestedClipStore, $clipsStore, $initializationStore.isInitialized);

	/**
	 * @param {string | null} wanted
	 * @param {Clip[]} clips
	 * @param {boolean} ready
	 */
	function resolveDeepLink(wanted, clips, ready) {
		if (!wanted) return;
		const found = clips.find((clip) => clip.id === wanted);
		if (found) {
			if (cinema) cinemaClip = found;
			else playing = found;
			rememberPlayed(found);
			requestedClipStore.set(null);
			if (deepLinkTimer) clearTimeout(deepLinkTimer);
			deepLinkTimer = null;
			return;
		}
		if (deepLinkTimer || !ready) return;
		deepLinkTimer = setTimeout(() => {
			deepLinkTimer = null;
			if (!$requestedClipStore) return;
			requestedClipStore.set(null);
			if (cinema) cinemaMissing = true;
			else showToast($_('player.notFound'), 'warning', 8000);
		}, DEEP_LINK_PATIENCE_MS);
	}

	/**
	 * "Fullscreen" by the player: the cinema page for this clip, started at
	 * once — the press that asked for it is the gesture fullscreen needs.
	 * @param {Clip} clip
	 */
	function openCinema(clip) {
		cinemaAutostart = true;
		cinemaClip = clip;
		cinemaMissing = false;
		cinema = true;
		playing = null;
	}
	let cinemaAutostart = false;

	/** Back to the playlist, and to an address that would not come back here. */
	function leaveCinema() {
		cinemaAutostart = false;
		cinema = false;
		cinemaClip = null;
		cinemaMissing = false;
		requestedClipStore.set(null);
		if (deepLinkTimer) clearTimeout(deepLinkTimer);
		deepLinkTimer = null;
		const url = new URL(location.href);
		url.searchParams.delete('clip');
		try {
			replaceState(url, {});
		} catch {
			history.replaceState(history.state, '', url);
		}
	}

	class IdentityChoiceError extends Error {}

	/**
	 * The passkey binds the identity only as far as the authenticator lets it;
	 * without PRF the same passkey yields a different identity on another
	 * device. Said once per credential — see simple-todo passkey01.
	 * @param {any} credential
	 */
	function warnIfIdentityCannotTravel(credential) {
		if (!credential || credential.extensionSupport?.prf !== false) return;
		const seen = `yogaClips.prfWarned.${credential.credentialId ?? 'unknown'}`;
		try {
			if (localStorage.getItem(seen) === 'true') return;
			localStorage.setItem(seen, 'true');
		} catch {
			// No storage: warn every time rather than not at all.
		}
		showToast($_('consent.prfMissing'), 'warning', 12_000);
	}

	/**
	 * Whether the identity choice can be carried out, asked before the consent
	 * dialog closes. A new passkey needs its label; without one the dialog stays
	 * where it is and says so.
	 */
	function identityChoiceIsComplete() {
		if (identityMode === 'create' && !passkeyLabel.trim()) {
			error = $_('consent.errorNeedsLabel');
			complainedAbout = identityChoice(identityMode, passkeyLabel);
			return false;
		}
		return true;
	}

	/** @param {string} mode @param {string} label */
	const identityChoice = (mode, label) => `${mode}\n${label}`;

	// The complaint goes when what it complained about is changed, not only on
	// the next press: a message that stays under a field filled in since reads
	// as "still wrong".
	$: forgetChoiceComplaint(identityChoice(identityMode, passkeyLabel));

	/** @param {string} choice */
	function forgetChoiceComplaint(choice) {
		if (complainedAbout === null || choice === complainedAbout) return;
		complainedAbout = null;
		error = null;
	}

	const handleModalClose = async () => {
		error = null;
		complainedAbout = null;
		try {
			if (rememberDecision) localStorage.setItem(CONSENT_KEY, 'true');
		} catch {
			// ignore storage errors
		}
		// A passkey is asked several times before the app is ready. The flow
		// counts the prompts of this start and, after the first, says what each
		// one is for before it comes (passkey-steps.js). A new passkey takes four;
		// how many an existing one takes depends on what this browser still holds.
		const chosen = identityMode;
		const flow =
			chosen === 'anonymous'
				? null
				: beginPasskeyFlow({ of: chosen === 'create' ? PROMPTS_TO_CREATE : null });
		try {
			// WebAuthn calls must run inside the user gesture of the proceed click.
			let passkeyCredential = null;
			if (identityMode === 'create') {
				// The label was asked for before the dialog closed (identityChoiceIsComplete).
				passkeyCredential = await createPasskeyCredential({
					userId: passkeyLabel.trim(),
					displayName: passkeyLabel.trim()
				});
			} else if (identityMode === 'existing') {
				passkeyCredential = await recoverPasskeyCredential();
				if (!passkeyCredential) throw new IdentityChoiceError($_('consent.errorNoPasskey'));
			}
			try {
				localStorage.setItem(IDENTITY_MODE_KEY, passkeyCredential ? 'passkey' : 'anon');
			} catch {
				// ignore storage errors
			}

			if ($initializationStore.isInitialized) {
				const { restartP2P } = await import('$lib/p2p.js');
				await restartP2P();
			} else {
				await startP2P({ passkeyCredential });
			}
			warnIfIdentityCannotTravel(passkeyCredential);
		} catch (err) {
			showModal = true;
			if (flow?.cancelled) {
				// "Cancel" between two prompts is a decision, not a failure. A new
				// passkey that was already created stays: pressing proceed again
				// must carry on with it, not register a second one.
				const created = chosen === 'create' && flow.completed > 0;
				error = $_(created ? 'passkeySteps.cancelledCreated' : 'passkeySteps.cancelled');
				if (created) identityMode = 'existing';
				return;
			}
			const reason = err instanceof Error ? err.message : String(err);
			error =
				err instanceof IdentityChoiceError
					? reason
					: $_('consent.errorStart', { values: { reason } });
			console.error('P2P initialization failed:', err);
		} finally {
			flow?.end();
		}
	};

	// Loaded on demand: p2p.js pulls libp2p, Helia and OrbitDB, none of which
	// the consent dialog needs.
	async function startP2P(/** @type {any} */ options) {
		void loadSponsorFab();
		const { initializeP2P } = await import('$lib/p2p.js');
		await initializeP2P(options);
	}

	/** @type {any} */
	let SponsorRelayFab = null;
	async function loadSponsorFab() {
		if (SponsorRelayFab) return;
		SponsorRelayFab = (await import('@le-space/ui/svelte')).default;
	}

	onMount(async () => {
		try {
			const rememberedIdentityMode = localStorage.getItem(IDENTITY_MODE_KEY);
			if (rememberedIdentityMode === 'passkey') {
				// A WebAuthn prompt needs a user gesture, so a remembered passkey
				// session cannot auto-start: preselect recovery and say why the
				// dialog is back.
				identityMode = 'existing';
				notice = $_('consent.existingNeedsTap');
			} else if (localStorage.getItem(CONSENT_KEY) === 'true') {
				showModal = false;
				await startP2P({ passkeyCredential: null });
			}
		} catch {
			// ignore storage errors
		}
	});

	/**
	 * @param {string} message
	 * @param {ToastType} [type]
	 * @param {number} [duration]
	 */
	function showToast(message, type = 'default', duration = 3000) {
		toastMessage = message;
		toastType = type;
		toastDuration = duration;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toastMessage = null;
			toastTimer = null;
		}, duration);
	}

	/** @param {Clip} clip */
	function play(clip) {
		playing = clip;
		rememberPlayed(clip);
	}

	/** @param {Clip} clip */
	function done(clip) {
		if (!identityId) return;
		doneLog = markDone(doneLog, clip.id);
		saveDoneLog(identityId, doneLog);
		showToast(
			$_('clip.markedDone', { values: { minutes: Math.round(clip.durationSec / 60) } }),
			'success'
		);
	}

	/** @param {Clip} clip */
	function undo(clip) {
		if (!identityId) return;
		doneLog = unmarkLast(doneLog, clip.id);
		saveDoneLog(identityId, doneLog);
	}

	/** @param {Clip} clip */
	async function remove(clip) {
		const result = await removeClip(clip.id);
		if (result.ok) {
			showToast($_('clip.removed'), 'success');
		} else if (result.kind === 'denied') {
			showToast($_('clip.denied'), 'error', 6000);
		} else {
			showToast($_('clip.removeFailed', { values: { reason: result.message } }), 'error', 6000);
		}
	}

	/**
	 * @param {{ detail: { status: 'stable' | 'dropped', detail: string, remotePeer: string | null, remoteAddr: string } }} event
	 */
	const handleManualConnect = (event) => {
		const peerTarget = event.detail.remotePeer || event.detail.remoteAddr;
		if (event.detail.status === 'stable') {
			showToast(`🔗 ${peerTarget}`, 'success');
			return;
		}
		showToast(`⚠️ ${peerTarget}`, 'warning');
	};

	let connectedPeersRef;
</script>

<ToastNotification message={toastMessage} type={toastType} duration={toastDuration} />

<svelte:head>
	<title
		>{$_('app.title')} {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}</title
	>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="description" content={$_('app.tagline')} />
</svelte:head>

<PasskeyStepDialog />

{#if showModal}
	<ConsentModal
		bind:show={showModal}
		bind:rememberDecision
		canProceed={true}
		identity={identityMode}
		{error}
		{notice}
		beforeProceed={identityChoiceIsComplete}
		on:proceed={handleModalClose}
	>
		<svelte:fragment slot="before-confirmation">
			<PasskeyOnboarding bind:mode={identityMode} bind:label={passkeyLabel} />
		</svelte:fragment>
	</ConsentModal>
{/if}

{#if cinema}
	<ClipCinema
		clip={cinemaClip}
		missing={cinemaMissing}
		failure={showModal ? null : error || $initializationStore.error || null}
		doneToday={cinemaClip ? doneToday(doneLog, cinemaClip.id) : false}
		autostart={cinemaAutostart}
		ondone={done}
		onleave={leaveCinema}
	/>
{/if}

<main class="container mx-auto max-w-5xl px-4 pt-4 pb-28 sm:px-6" hidden={cinema}>
	<header class="mb-5 flex items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2">
			<YogaClipsLogo size={34} label="" />
			<div class="min-w-0">
				<p
					class="font-[Sora] text-[9px] leading-none font-medium tracking-[0.32em] text-infra"
					aria-hidden="true"
				>
					LE SPACE
				</p>
				<h1
					class="font-[Sora] text-xl leading-tight font-bold tracking-tight text-heading lowercase"
				>
					{$_('app.title')}
				</h1>
			</div>
		</div>
		<ConnectionPoint initialization={$initializationStore} libp2p={$libp2pStore}>
			<PlaylistAddress />
			<P2PStatusNav
				initialization={$initializationStore}
				libp2p={$libp2pStore}
				peerId={$peerIdStore}
			>
				<ManualConnectForm
					compact
					disabled={!$initializationStore.isInitialized}
					on:connected={handleManualConnect}
				/>
				<ConnectedPeers compact bind:this={connectedPeersRef} libp2p={$libp2pStore} />
				<div class="max-w-full min-w-0 space-y-3 overflow-hidden">
					<PeerIdCard compact peerId={$peerIdStore} />
					<OwnMultiaddrs libp2p={$libp2pStore} />
					<p class="text-xs break-words text-faint" data-testid="build-info">
						{formatVersions({ appName: 'Yoga Clips' })} · {typeof __APP_BRANCH__ !== 'undefined'
							? __APP_BRANCH__
							: 'local'} [{typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'dev'}]
					</p>
				</div>
			</P2PStatusNav>
		</ConnectionPoint>
	</header>

	{#if !showModal && (error || $initializationStore.error)}
		<ErrorAlert error={error || $initializationStore.error} dismissible={true} />
	{/if}

	<!--
		Every view stays mounted and is only hidden: a half-typed form keeps its
		text, and the playlist keeps its place, when a person looks elsewhere.
	-->
	<div hidden={$viewStore !== 'library'} data-testid="view-library">
		{#if $initializationStore.isInitialized}
			<Library
				notify={showToast}
				onopened={() => goTo('playlist')}
				{continueClip}
				continueDoneToday={continueClip ? doneToday(doneLog, continueClip.id) : false}
				ondone={done}
			/>
		{/if}
	</div>

	<div hidden={$viewStore !== 'playlist'} data-testid="view-playlist">
		<PlaylistView onback={() => goTo('library')} onshare={() => goTo('share')} notify={showToast}>
			<ClipPlayer
				clip={cinema ? null : playing}
				playlistAddress={$activePlaylistStore.address}
				playlistName={playlistDisplayName($activePlaylistStore.name)}
				doneToday={playing ? doneToday(doneLog, playing.id) : false}
				onclose={() => (playing = null)}
				ondone={done}
				onfullscreen={openCinema}
			/>
			{#if $initializationStore.isInitialized && $activePlaylistStore.kind !== 'none' && !cinema}
				<ClipFilters
					teachers={$teachersStore}
					tags={$tagsStore}
					bind:teacher={filterTeacher}
					bind:tag={filterTag}
					bind:minutes={filterMinutes}
					count={filtered.length}
					total={$clipsStore.length}
				/>
				<ClipGrid
					clips={filtered}
					total={$clipsStore.length}
					{doneLog}
					isOwner={$activePlaylistStore.kind === 'owner'}
					{identityId}
					currentId={playing?.id ?? ''}
					onplay={play}
					ondone={done}
					onundo={undo}
					onremove={remove}
				/>
			{/if}
		</PlaylistView>
	</div>

	<div hidden={$viewStore !== 'practise'} data-testid="view-practise">
		<h2 class="mb-3 text-2xl font-semibold text-heading">{$_('nav.practise')}</h2>
		{#if $initializationStore.isInitialized}
			<PracticeStats {stats} />
		{/if}
	</div>

	<div hidden={$viewStore !== 'share'} data-testid="view-share">
		<h2 class="mb-3 text-2xl font-semibold text-heading">{$_('nav.share')}</h2>
		{#if $initializationStore.isInitialized}
			{#if !$activePlaylistStore.address}
				<p class="card p-6 text-center text-sm text-faint">{$_('share.none')}</p>
			{/if}
			<SharePanel />
			<PermissionsPanel />
		{/if}
	</div>

	<div hidden={$viewStore !== 'me'} data-testid="view-me" class="space-y-4">
		<h2 class="text-2xl font-semibold text-heading">{$_('nav.me')}</h2>
		<section class="card p-4">
			<h3 class="text-sm font-semibold text-heading">{$_('connection.identityHeading')}</h3>
			<p class="mt-0.5 mb-2 text-xs text-faint">
				{$ownDidStore ? $_('connection.identityHint') : $_('connection.identityAnonymous')}
			</p>
			<DidBadge did={$ownDidStore ?? ''} />
		</section>
		<section class="card flex flex-wrap items-center justify-between gap-3 p-4">
			<span class="text-sm font-semibold text-heading">{$_('me.appearance')}</span>
			<span class="flex items-center gap-2"><LanguageSwitcher /><ThemeToggle /></span>
		</section>
		<p class="text-xs text-faint">{$_('me.connectionHint')}</p>
		{#if $initializationStore.isInitialized && $activePlaylistStore.kind !== 'none'}
			<TransferPanel notify={showToast} />
		{/if}
		<div class="flex justify-center pt-2"><SocialIcons size="w-5 h-5" className="" /></div>
	</div>
</main>

{#if !cinema && !showModal}
	{#if $viewStore === 'library' || $viewStore === 'playlist'}
		<button
			type="button"
			class="fixed right-4 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl leading-none text-accent-ink shadow-lg sm:right-8"
			aria-label={$_('clip.addHeading')}
			data-testid="add-clip-open"
			on:click={() => addSheet?.showModal()}>+</button
		>
	{/if}
	<BottomBar items={navItems} current={sectionOf($viewStore)} label={$_('nav.label')} />
{/if}

<dialog
	bind:this={addSheet}
	class="sheet backdrop:bg-black/70"
	aria-label={$_('clip.addHeading')}
	data-testid="add-clip-sheet"
	on:click={(event) => event.target === addSheet && addSheet?.close()}
>
	<div class="flex justify-end px-4 pt-3">
		<button
			type="button"
			class="btn btn-ghost btn-sm"
			aria-label={$_('connection.close')}
			on:click={() => addSheet?.close()}
			data-testid="add-clip-close">✕</button
		>
	</div>
	<AddClipForm
		disabled={!$initializationStore.isInitialized}
		notify={showToast}
		onadded={() => {
			addSheet?.close();
			goTo('playlist');
		}}
	/>
</dialog>

<!-- The relay's sponsor button floats where the plus and the bottom bar are; it lives on Me. -->
{#if SponsorRelayFab && !cinema && $viewStore === 'me'}
	<svelte:component
		this={SponsorRelayFab}
		manifestUrl="./rootfs-manifest.json"
		showInstances={true}
	/>
{/if}
