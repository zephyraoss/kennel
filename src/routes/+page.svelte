<script lang="ts">
	import { resolve } from '$app/paths';
	import GithubSignIn from '$lib/components/github-sign-in.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Seo from '$lib/components/seo.svelte';
	import { page } from '$app/state';
</script>

<Seo
	title="kennel: a simple, programmable task list"
	description="A simple task list with a REST API and MCP server."
	jsonLd={{
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'kennel',
		url: page.url.origin,
		applicationCategory: 'ProductivityApplication',
		operatingSystem: 'Web',
		description: 'A simple task list with a REST API and MCP server.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		featureList: [
			'Task list dashboard',
			'REST API',
			'Remote MCP server',
			'OAuth 2.1 with PKCE',
			'API keys'
		],
		license: 'https://www.gnu.org/licenses/agpl-3.0.html'
	}}
/>

<main class="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
	<div class="flex flex-1 flex-col justify-center gap-8">
		<div class="space-y-3">
			<h1 class="text-2xl font-semibold">kennel</h1>
			<p class="text-base/7 text-muted-foreground sm:text-sm/6">
				A simple task list built to be integrated into your own apps and agents. Use it from the
				dashboard, add it via MCP or add it to your app via the API.
			</p>
		</div>
		<div class="space-y-3">
			<GithubSignIn />
			<a
				href={resolve('/docs')}
				class="block text-center text-base text-muted-foreground hover:text-foreground sm:text-sm"
			>
				Read the docs
			</a>
		</div>
	</div>
	<SiteFooter />
</main>
