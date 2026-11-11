<script>
	// Between two passkey prompts: what the next one is for, and "Continue"
	// starts it (passkey-steps.js). Escape cancels like "Cancel", where the step
	// can be cancelled at all.
	import { _ } from '$lib/i18n/index.js';
	import { passkeyStepStore, PasskeyStepCancelled } from './passkey-steps.js';

	/** @type {HTMLDialogElement | undefined} */
	let dialog;

	$: step = $passkeyStepStore;
	$: if (dialog) {
		if (step && !dialog.open) dialog.showModal();
		else if (!step && dialog.open) dialog.close();
	}

	function cancel() {
		if (step?.canCancel) step.reject(new PasskeyStepCancelled());
	}
</script>

<dialog
	bind:this={dialog}
	on:cancel|preventDefault={cancel}
	aria-labelledby="passkey-step-title"
	class="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-border bg-surface p-5 text-text shadow-2xl backdrop:bg-black/55"
	data-testid="passkey-step-dialog"
>
	{#if step}
		<p
			class="text-xs font-semibold tracking-wide text-faint uppercase"
			data-testid="passkey-step-count"
		>
			{step.of
				? $_('passkeySteps.count', { values: { n: step.n, of: step.of } })
				: $_('passkeySteps.countOpen', { values: { n: step.n } })}
		</p>
		<h2
			id="passkey-step-title"
			class="mt-1 text-lg font-semibold text-heading"
			data-testid="passkey-step-title"
			data-purpose={step.purpose}
		>
			{$_(`passkeySteps.purpose.${step.purpose}.title`)}
		</h2>
		<p class="mt-2 text-sm leading-relaxed">{$_(`passkeySteps.purpose.${step.purpose}.why`)}</p>
		<p class="mt-2 text-sm leading-relaxed text-faint">{$_('passkeySteps.notALoop')}</p>
		<div class="mt-4 flex flex-wrap justify-end gap-2">
			{#if step.canCancel}
				<button
					type="button"
					class="min-h-11 rounded-md border border-border px-3 text-sm text-text hover:bg-surface-2 hover:text-heading"
					on:click={cancel}
					data-testid="passkey-step-cancel"
				>
					{$_('passkeySteps.cancel')}
				</button>
			{/if}
			<!-- svelte-ignore a11y_autofocus -->
			<button
				type="button"
				class="min-h-11 rounded-md bg-coral-700 px-4 text-sm font-medium text-white hover:bg-coral-800"
				on:click={() => step?.resolve()}
				autofocus
				data-testid="passkey-step-continue"
			>
				{$_('passkeySteps.continue')}
			</button>
		</div>
	{/if}
</dialog>
