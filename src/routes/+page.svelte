<script lang="ts">
	import { resolve } from '$app/paths';
	import GithubSignIn from '$lib/components/github-sign-in.svelte';
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6">
	<div class="space-y-3">
		<h1 class="text-2xl font-semibold">kennel</h1>
		<p class="text-muted-foreground">
			A simple task list built to be integrated into your own apps and agents. Use it from the
			dashboard, add it via MCP or add it to your app via the API.
		</p>
	</div>
	<div class="space-y-3">
		<GithubSignIn />
		<a
			href={resolve('/docs')}
			class="block text-center text-sm text-muted-foreground hover:text-foreground"
		>
			Read the docs
		</a>
	</div>
</main>
