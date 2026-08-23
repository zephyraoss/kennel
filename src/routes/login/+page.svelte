<script lang="ts">
	import GithubSignIn from '$lib/components/github-sign-in.svelte';
	import Seo from '$lib/components/seo.svelte';

	let { data } = $props();
</script>

<Seo title="kennel: sign in" description="Sign in with GitHub." noindex />

<main class="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
	<div class="space-y-1">
		<h1 class="text-xl font-semibold">Sign in to kennel</h1>
		<p class="text-base text-muted-foreground sm:text-sm">
			{data.clientName ? `${data.clientName} wants` : 'An app wants'} access to your tasks. Sign in to
			continue.
		</p>
	</div>
	<GithubSignIn />
</main>
