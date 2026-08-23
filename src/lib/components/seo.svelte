<script lang="ts">
	import { page } from '$app/state';

	let {
		title,
		description,
		noindex = false,
		jsonLd,
		image
	}: {
		title: string;
		description: string;
		noindex?: boolean;
		jsonLd?: Record<string, unknown>;
		image?: { title: string; subtitle: string };
	} = $props();

	const canonical = $derived(`${page.url.origin}${page.url.pathname}`);
	const imageUrl = $derived.by(() => {
		const og = new URL('/og.png', page.url.origin);
		if (image) {
			og.searchParams.set('title', image.title);
			og.searchParams.set('subtitle', image.subtitle);
		}
		return og.toString();
	});
	const jsonLdScript = $derived(
		jsonLd
			? `<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}<\/script>`
			: ''
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="kennel" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{@html jsonLdScript}
</svelte:head>
