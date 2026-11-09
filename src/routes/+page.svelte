<script>
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n/index.js';
	import { peerIdStore, initializationStore, ownDidStore, libp2pStore } from '$lib/p2p-stores.js';
	import PasskeyOnboarding from '$lib/PasskeyOnboarding.svelte';
	import DidBadge from '$lib/DidBadge.svelte';
	import { createPasskeyCredential, recoverPasskeyCredential } from '$lib/passkey-identity.js';
	import {
		orbitdbStore,
		clipsStore,
		teachersStore,
		tagsStore,
		activePlaylistStore,
		requestedClipStore,
		removeClip
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
	import LeSpaceLogo from '$lib/LeSpaceLogo.svelte';
	import ToastNotification from '$lib/ToastNotification.svelte';
	import P2PStatusNav from '$lib/P2PStatusNav.svelte';
	import ErrorAlert from '$lib/ErrorAlert.svelte';
	import ConnectedPeers from '$lib/ConnectedPeers.svelte';
	import PeerIdCard from '$lib/PeerIdCard.svelte';
	import OwnMultiaddrs from '$lib/OwnMultiaddrs.svelte';
	import ManualConnectForm from '$lib/ManualConnectForm.svelte';
	import PlaylistPanel from '$lib/PlaylistPanel.svelte';
	import SharePanel from '$lib/SharePanel.svelte';
	import PermissionsPanel from '$lib/PermissionsPanel.svelte';
	import AddClipForm from '$lib/AddClipForm.svelte';
	import ClipFilters from '$lib/ClipFilters.svelte';
	import ClipGrid from '$lib/ClipGrid.svelte';
	import ClipPlayer from '$lib/ClipPlayer.svelte';
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

	let showModal = true;
	let rememberDecision = false;

	// Filters
	let filterTeacher = '';
	let filterTag = '';
	let filterMinutes = 0;

	// Player
	/** @type {Clip | null} */
	let playing = null;

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

	// A `?clip=<id>` link: open the player as soon as the clip is here. It may
	// take a moment — a guest's copy arrives from the relay — so this waits, and
	// says so if the clip never turns up.
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
			playing = found;
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
			showToast($_('player.notFound'), 'warning', 8000);
		}, DEEP_LINK_PATIENCE_MS);
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

	const handleModalClose = async () => {
		error = null;
		try {
			if (rememberDecision) localStorage.setItem(CONSENT_KEY, 'true');
		} catch {
			// ignore storage errors
		}
		try {
			// WebAuthn calls must run inside the user gesture of the proceed click.
			let passkeyCredential = null;
			if (identityMode === 'create') {
				if (!passkeyLabel.trim()) throw new IdentityChoiceError($_('consent.errorNeedsLabel'));
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
			const reason = err instanceof Error ? err.message : String(err);
			error =
				err instanceof IdentityChoiceError
					? reason
					: $_('consent.errorStart', { values: { reason } });
			console.error('P2P initialization failed:', err);
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

{#if showModal}
	<ConsentModal
		bind:show={showModal}
		bind:rememberDecision
		canProceed={true}
		identity={identityMode}
		{error}
		{notice}
		on:proceed={handleModalClose}
	>
		<svelte:fragment slot="before-confirmation">
			<PasskeyOnboarding bind:mode={identityMode} bind:label={passkeyLabel} />
		</svelte:fragment>
	</ConsentModal>
{/if}

<main class="container mx-auto max-w-5xl p-4 sm:p-6">
	<header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex flex-1 items-center gap-3">
			<LeSpaceLogo size={52} />
			<div>
				<h1 class="text-2xl font-bold text-heading sm:text-3xl">{$_('app.title')}</h1>
				<p class="mt-1 text-sm text-faint">{$_('app.tagline')}</p>
			</div>
		</div>
		<div class="flex flex-shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
			<DidBadge did={$ownDidStore ?? ''} />
			<LanguageSwitcher />
			<ThemeToggle />
			<SocialIcons size="w-5 h-5" className="" />
		</div>
	</header>

	<P2PStatusNav initialization={$initializationStore} libp2p={$libp2pStore} peerId={$peerIdStore}>
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

	{#if !showModal && (error || $initializationStore.error)}
		<ErrorAlert error={error || $initializationStore.error} dismissible={true} />
	{/if}

	{#if $initializationStore.isInitialized}
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<PracticeStats {stats} />
		</div>
		<PlaylistPanel notify={showToast} />
		<SharePanel />
		<PermissionsPanel />
	{/if}

	<AddClipForm disabled={!$initializationStore.isInitialized} notify={showToast} />

	{#if $initializationStore.isInitialized && $activePlaylistStore.kind !== 'none'}
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
			onplay={play}
			ondone={done}
			onundo={undo}
			onremove={remove}
		/>
		<TransferPanel notify={showToast} />
	{/if}
</main>

<ClipPlayer
	clip={playing}
	playlistAddress={$activePlaylistStore.address}
	doneToday={playing ? doneToday(doneLog, playing.id) : false}
	onclose={() => (playing = null)}
	ondone={done}
/>

{#if SponsorRelayFab}
	<svelte:component
		this={SponsorRelayFab}
		manifestUrl="./rootfs-manifest.json"
		showInstances={true}
	/>
{/if}
