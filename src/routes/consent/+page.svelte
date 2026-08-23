<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth';
	import Seo from '$lib/components/seo.svelte';

	let { data } = $props();
	let pending = $state(false);
	let failure = $state<string | null>(null);

	const descriptions: Record<string, string> = {
		'tasks:read': 'Read your tasks',
		'tasks:write': 'Create, update, and delete your tasks',
		openid: 'Confirm your identity',
		profile: 'See your name and avatar',
		email: 'See your email address',
		offline_access: 'Stay connected without asking again'
	};

	const decide = async (accept: boolean) => {
		pending = true;
		failure = null;
		const result = await authClient.oauth2.consent({ accept });
		if (result.error) {
			failure = result.error.message ?? 'Something went wrong';
			pending = false;
			return;
		}
		window.location.href = result.data.url;
	};
</script>

<Seo title="kennel: authorize app" description="Let an app access your tasks." noindex />

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
	<div class="space-y-1">
		<h1 class="text-xl font-semibold">Authorize {data.clientName}</h1>
		<p class="text-base text-muted-foreground sm:text-sm">Signed in as {data.user?.name}</p>
	</div>
	<ul class="list-disc space-y-1 pl-5 text-base sm:text-sm">
		{#each data.scopes as scope (scope)}
			<li>{descriptions[scope] ?? scope}</li>
		{/each}
	</ul>
	{#if failure}
		<p role="alert" class="text-base text-destructive sm:text-sm">{failure}</p>
	{/if}
	<div class="flex gap-2">
		<Button variant="outline" class="flex-1" disabled={pending} onclick={() => decide(false)}
			>Deny</Button
		>
		<Button class="flex-1" disabled={pending} onclick={() => decide(true)}>Allow</Button>
	</div>
</main>
