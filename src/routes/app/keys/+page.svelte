<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let { data, form } = $props();

	const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never');
</script>

<section class="mb-8 space-y-2 text-sm">
	<p class="text-muted-foreground">
		Send a key as <code>Authorization: Bearer kn_…</code> to either endpoint. See the
		<a href={resolve('/docs')} class="underline">docs</a> for details.
	</p>
	<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
		<dt class="text-muted-foreground">REST</dt>
		<dd><code>{data.urls.api}/tasks</code></dd>
		<dt class="text-muted-foreground">MCP</dt>
		<dd><code>{data.urls.mcp}</code></dd>
	</dl>
</section>

<form method="POST" action="?/create" use:enhance class="mb-6 flex gap-2">
	<Input name="name" placeholder="Key name (e.g. my-cli)" required class="flex-1" />
	<Button type="submit">Create key</Button>
</form>

{#if form?.message}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

{#if form?.createdKey}
	<div class="mb-6 rounded-md border p-3 text-sm">
		<p class="mb-1">
			New key <strong>{form.createdName}</strong>. Copy it now; it won't be shown again.
		</p>
		<code class="block break-all select-all">{form.createdKey}</code>
	</div>
{/if}

{#if data.keys.length === 0}
	<p class="text-sm text-muted-foreground">No API keys yet.</p>
{/if}

<ul class="divide-y">
	{#each data.keys as key (key.id)}
		<li class="flex items-center gap-3 py-2 text-sm">
			<span class="flex-1">{key.name}</span>
			<code class="text-muted-foreground">{key.start}…</code>
			<span class="text-xs text-muted-foreground">last used {dateLabel(key.lastRequest)}</span>
			<form method="POST" action="?/delete" use:enhance>
				<input type="hidden" name="id" value={key.id} />
				<button type="submit" class="text-xs text-muted-foreground hover:text-destructive"
					>Revoke</button
				>
			</form>
		</li>
	{/each}
</ul>
