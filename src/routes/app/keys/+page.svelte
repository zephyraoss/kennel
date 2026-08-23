<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let { data, form } = $props();

	const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never');
</script>

<section class="mb-8 space-y-2 text-base sm:text-sm">
	<p class="text-muted-foreground">
		Send a key as <code>Authorization: Bearer kn_…</code> to either endpoint. See the
		<a href={resolve('/docs')} class="underline">docs</a> for details.
	</p>
	<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
		<dt class="text-muted-foreground">REST</dt>
		<dd class="min-w-0 break-all"><code>{data.urls.api}/tasks</code></dd>
		<dt class="text-muted-foreground">MCP</dt>
		<dd class="min-w-0 break-all"><code>{data.urls.mcp}</code></dd>
	</dl>
</section>

<form method="POST" action="?/create" use:enhance class="mb-6 flex gap-2">
	<Input
		name="name"
		placeholder="Key name (e.g. my-cli)"
		aria-label="Key name"
		required
		class="min-w-0 flex-1"
	/>
	<Button type="submit" class="shrink-0">Create key</Button>
</form>

{#if form?.message}
	<p role="alert" class="mb-4 text-base text-destructive sm:text-sm">{form.message}</p>
{/if}

{#if form?.createdKey}
	<div role="status" class="mb-6 rounded-md border p-3 text-base sm:text-sm">
		<p class="mb-1">
			New key <strong>{form.createdName}</strong>. Copy it now. It won't be shown again.
		</p>
		<code class="block break-all select-all">{form.createdKey}</code>
	</div>
{/if}

{#if data.keys.length === 0}
	<p class="text-base text-muted-foreground sm:text-sm">No API keys yet.</p>
{/if}

<ul class="divide-y">
	{#each data.keys as key (key.id)}
		<li class="flex items-start gap-3 py-2.5 text-base sm:items-center sm:py-2 sm:text-sm">
			<div class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
				<span class="truncate">{key.name}</span>
				<code class="text-muted-foreground">{key.start}…</code>
				<span class="text-sm text-muted-foreground sm:text-xs"
					>last used {dateLabel(key.lastRequest)}</span
				>
			</div>
			<form method="POST" action="?/delete" use:enhance class="shrink-0">
				<input type="hidden" name="id" value={key.id} />
				<button
					type="submit"
					class="relative text-sm text-muted-foreground hover:text-destructive sm:text-xs"
				>
					<span
						class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
						aria-hidden="true"
					></span>
					Revoke
				</button>
			</form>
		</li>
	{/each}
</ul>
