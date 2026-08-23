<script lang="ts">
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import XIcon from '@lucide/svelte/icons/x';
	import { authClient } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Seo from '$lib/components/seo.svelte';

	let { data, children } = $props();

	let menuOpen = $state(false);

	const links = [
		{ href: resolve('/app'), label: 'Tasks' },
		{ href: resolve('/app/keys'), label: 'API keys' },
		{ href: resolve('/app/oauth'), label: 'OAuth' },
		{ href: resolve('/docs'), label: 'Docs' }
	];

	const pageLabel = $derived(
		links.find((link) => link.href === page.url.pathname)?.label ?? 'Dashboard'
	);

	const isCurrent = (href: string) => page.url.pathname === href;

	const linkClass = (href: string) =>
		isCurrent(href) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground';

	const signOut = async () => {
		await authClient.signOut();
		await goto(resolve('/'));
	};

	afterNavigate(() => {
		menuOpen = false;
	});
</script>

<Seo title="kennel: {pageLabel.toLowerCase()}" description="Your tasks and projects." noindex />

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-8">
	<a
		href="#main"
		class="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
	>
		Skip to content
	</a>
	<header class="mb-8">
		<div class="flex items-center justify-between gap-4">
			<nav aria-label="Main" class="flex min-w-0 items-center gap-4 text-base sm:text-sm">
				<a href={resolve('/app')} class="font-semibold">kennel</a>
				<div class="hidden items-center gap-4 lg:flex">
					{#each links as link (link.href)}
						<a
							href={link.href}
							class={linkClass(link.href)}
							aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a
						>
					{/each}
				</div>
			</nav>
			<div class="hidden items-center gap-4 text-sm lg:flex">
				<span class="truncate text-muted-foreground">{data.user.name}</span>
				<Button variant="ghost" size="sm" class="text-muted-foreground" onclick={signOut}>
					Sign out
				</Button>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="relative lg:hidden"
				onclick={() => (menuOpen = !menuOpen)}
				aria-expanded={menuOpen}
				aria-controls="mobile-menu"
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
			>
				<span
					class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
					aria-hidden="true"
				></span>
				{#if menuOpen}
					<XIcon class="size-5" />
				{:else}
					<MenuIcon class="size-5" />
				{/if}
			</Button>
		</div>
		{#if menuOpen}
			<nav
				id="mobile-menu"
				aria-label="Mobile"
				class="mt-4 grid gap-1 border-t pt-4 text-base lg:hidden"
			>
				{#each links as link (link.href)}
					<a
						href={link.href}
						class="rounded-md px-2 py-2.5 {linkClass(link.href)}"
						aria-current={isCurrent(link.href) ? 'page' : undefined}>{link.label}</a
					>
				{/each}
				<div class="mt-2 flex items-center justify-between gap-3 border-t pt-3">
					<span class="truncate text-muted-foreground">{data.user.name}</span>
					<Button variant="ghost" class="text-muted-foreground" onclick={signOut}>Sign out</Button>
				</div>
			</nav>
		{/if}
	</header>
	<main id="main" class="flex flex-1 flex-col">
		<h1 class="sr-only">{pageLabel}</h1>
		{@render children()}
	</main>
	<SiteFooter />
</div>
