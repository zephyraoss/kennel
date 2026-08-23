<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';

	let { data, form } = $props();

	const dateLabel = (iso: string) => new Date(iso).toLocaleDateString();
	const scopeLabel: Record<string, string> = { 'tasks:read': 'read', 'tasks:write': 'write' };
</script>

<section class="mb-10">
	<h2 class="mb-1 text-sm font-medium">Connected apps</h2>
	<p class="mb-4 text-sm text-muted-foreground">
		Apps you've authorized to use your tasks. Revoking will stop the app from accessing your tasks.
	</p>

	{#if data.apps.length === 0}
		<p class="text-sm text-muted-foreground">No apps connected yet.</p>
	{/if}

	<ul class="divide-y">
		{#each data.apps as app (app.id)}
			<li class="flex items-start gap-3 py-2 text-sm">
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span>{app.name}</span>
						{#if app.ownedByMe}
							<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">yours</span
							>
						{/if}
					</div>
					<div class="text-xs text-muted-foreground">
						{app.scopes.map((s) => scopeLabel[s] ?? s).join(' + ')} · authorized {dateLabel(
							app.authorizedAt
						)}
						{#if app.clientUri}
							· <a href={app.clientUri} class="underline" rel="noreferrer">{app.clientUri}</a>
						{/if}
					</div>
				</div>
				<form method="POST" action="?/revoke" use:enhance>
					<input type="hidden" name="id" value={app.id} />
					<button type="submit" class="text-xs text-muted-foreground hover:text-destructive">
						Revoke
					</button>
				</form>
			</li>
		{/each}
	</ul>
</section>

<section>
	<h2 class="mb-1 text-sm font-medium">Your apps</h2>
	<p class="mb-4 text-sm text-muted-foreground">
		Register an OAuth client to let your own app act on a user's tasks. See the
		<a href={resolve('/docs')} class="underline">docs</a> for the flow.
	</p>
	<dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
		<dt class="text-muted-foreground">Issuer</dt>
		<dd><code>{data.issuer}</code></dd>
		<dt class="text-muted-foreground">Authorize</dt>
		<dd><code>{data.issuer}/oauth2/authorize</code></dd>
		<dt class="text-muted-foreground">Token</dt>
		<dd><code>{data.issuer}/oauth2/token</code></dd>
	</dl>

	<form method="POST" action="?/create" use:enhance class="mb-6 space-y-2">
		<Input name="name" placeholder="Client name" required />
		<Textarea name="redirect_uris" placeholder="Redirect URIs, one per line" rows={2} required />
		<Button type="submit">Create client</Button>
	</form>

	{#if form?.message}
		<p class="mb-4 text-sm text-destructive">{form.message}</p>
	{/if}

	{#if form?.created}
		<div class="mb-6 space-y-1 rounded-md border p-3 text-sm">
			<p>Client <strong>{form.created.name}</strong> created. The secret is only shown once.</p>
			<p>
				<span class="text-muted-foreground">client_id</span>
				<code class="select-all">{form.created.clientId}</code>
			</p>
			{#if form.created.clientSecret}
				<p>
					<span class="text-muted-foreground">client_secret</span>
					<code class="break-all select-all">{form.created.clientSecret}</code>
				</p>
			{/if}
		</div>
	{/if}

	{#if data.clients.length === 0}
		<p class="text-sm text-muted-foreground">No clients yet.</p>
	{/if}

	<ul class="divide-y">
		{#each data.clients as client (client.clientId)}
			<li class="flex items-start gap-3 py-2 text-sm">
				<div class="flex-1">
					<div>{client.name}</div>
					<code class="text-xs text-muted-foreground">{client.clientId}</code>
					<div class="text-xs text-muted-foreground">{client.redirectUris.join(', ')}</div>
				</div>
				<form method="POST" action="?/delete" use:enhance>
					<input type="hidden" name="client_id" value={client.clientId} />
					<button type="submit" class="text-xs text-muted-foreground hover:text-destructive">
						Delete
					</button>
				</form>
			</li>
		{/each}
	</ul>
</section>
