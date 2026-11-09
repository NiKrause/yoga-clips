<script>
	import '../app.css';
	import { formatBuildDate } from '$lib/build-info.js';

	let { children } = $props();
</script>

<svelte:head>
	<title
		>Yoga Clips {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'} [{formatBuildDate(
			typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''
		)}]</title
	>
</svelte:head>

{@render children?.()}
