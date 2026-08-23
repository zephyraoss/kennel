<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth';
	import { Button } from '$lib/components/ui/button';

	let { data, children } = $props();

	const links = [
		{ href: resolve('/app'), label: 'Tasks' },
		{ href: resolve('/app/keys'), label: 'API keys' },
		{ href: resolve('/app/oauth'), label: 'OAuth' },
		{ href: resolve('/docs'), label: 'Docs' }
	];

	const signOut = async () => {
		await authClient.signOut();
		await goto(resolve('/'));
	};
</script>

<div class="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-8">
	<header class="mb-8 flex items-center justify-between">
		<nav class="flex items-center gap-4 text-sm">
			<a href={resolve('/app')} class="font-semibold">kennel</a>
			{#each links as link (link.href)}
				<a
					href={link.href}
					class={page.url.pathname === link.href
						? 'text-foreground'
						: 'text-muted-foreground hover:text-foreground'}
				>
					{link.label}
				</a>
			{/each}
		</nav>
		<div class="flex items-center gap-3 text-sm">
			<span class="text-muted-foreground">{data.user.name}</span>
			<Button variant="ghost" size="sm" onclick={signOut}>Sign out</Button>
		</div>
	</header>
	{@render children()}
</div>
