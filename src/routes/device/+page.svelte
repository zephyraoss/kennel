<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { authClient } from '$lib/auth';
	import Seo from '$lib/components/seo.svelte';

	let { data } = $props();
	let code = $state('');
	let pending = $state(false);
	let failure = $state<string | null>(null);
	let outcome = $state<'approved' | 'denied' | null>(null);

	const descriptions: Record<string, string> = {
		'tasks:read': 'Read your tasks',
		'tasks:write': 'Create, update, and delete your tasks',
		openid: 'Confirm your identity',
		profile: 'See your name and avatar',
		email: 'See your email address',
		offline_access: 'Stay connected without asking again'
	};

	const lookUp = (event: SubmitEvent) => {
		event.preventDefault();
		goto(resolve(`/device?user_code=${encodeURIComponent(code.trim())}`));
	};

	const decide = async (accept: boolean) => {
		pending = true;
		failure = null;
		const body = { userCode: data.userCode };
		const result = accept
			? await authClient.device.approve(body)
			: await authClient.device.deny(body);
		pending = false;
		if (result.error) {
			failure = result.error.error_description;
			return;
		}
		outcome = accept ? 'approved' : 'denied';
	};
</script>

<Seo
	title="kennel: connect a device"
	description="Approve a device or terminal signing in."
	noindex
/>

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
	{#if outcome === 'approved'}
		<div class="space-y-1">
			<h1 class="text-xl font-semibold">Device connected</h1>
			<p class="text-base text-muted-foreground sm:text-sm">
				{data.request?.clientName} can now access your tasks. You can close this tab.
			</p>
		</div>
	{:else if outcome === 'denied'}
		<div class="space-y-1">
			<h1 class="text-xl font-semibold">Request denied</h1>
			<p class="text-base text-muted-foreground sm:text-sm">
				{data.request?.clientName} was not given access. You can close this tab.
			</p>
		</div>
	{:else if data.request}
		<div class="space-y-1">
			<h1 class="text-xl font-semibold">Authorize {data.request.clientName}</h1>
			<p class="text-base text-muted-foreground sm:text-sm">
				Signed in as {data.user?.name}. Code <span class="font-mono">{data.userCode}</span>
			</p>
		</div>
		<ul class="list-disc space-y-1 pl-5 text-base sm:text-sm">
			{#each data.request.scopes as scope (scope)}
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
	{:else}
		<div class="space-y-1">
			<h1 class="text-xl font-semibold">Connect a device</h1>
			<p class="text-base text-muted-foreground sm:text-sm">
				Enter the code shown on the device or terminal you are signing in from.
			</p>
		</div>
		<form class="space-y-4" onsubmit={lookUp}>
			<div class="space-y-2">
				<Label for="user_code">Code</Label>
				<Input
					id="user_code"
					name="user_code"
					bind:value={code}
					autocomplete="off"
					autocapitalize="characters"
					spellcheck={false}
					placeholder="ABCD-EFGH"
					class="font-mono tracking-widest uppercase"
				/>
			</div>
			{#if data.failure}
				<p role="alert" class="text-base text-destructive sm:text-sm">{data.failure}</p>
			{/if}
			<Button type="submit" class="w-full" disabled={!code.trim()}>Continue</Button>
		</form>
	{/if}
</main>
