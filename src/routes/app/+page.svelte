<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import TaskFields from '$lib/components/task-fields.svelte';
	import TaskRow from '$lib/components/task-row.svelte';

	let { data, form } = $props();

	let expanded = $state(false);
	let addingProject = $state(false);
	let title = $state('');

	const open = $derived(data.tasks.filter((t) => t.status === 'open'));
	const done = $derived(data.tasks.filter((t) => t.status === 'done'));
	const activeProject = $derived(data.projects.find((p) => p.id === data.activeProjectId) ?? null);

	const tabClass = (active: boolean) =>
		`rounded-md px-2 py-1 text-sm ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`;
</script>

<nav class="mb-6 flex flex-wrap items-center gap-1">
	<a href={resolve('/app')} class={tabClass(!data.activeProjectId)}>All</a>
	{#each data.projects as p (p.id)}
		<a href="{resolve('/app')}?project={p.id}" class={tabClass(p.id === data.activeProjectId)}
			>{p.name}</a
		>
	{/each}
	{#if addingProject}
		<form method="POST" action="?/createProject" use:enhance class="flex items-center gap-1">
			<Input name="name" placeholder="Project name" class="h-8 w-40" required autofocus />
			<Button type="submit" size="sm" variant="ghost">Add</Button>
			<Button type="button" size="sm" variant="ghost" onclick={() => (addingProject = false)}
				>Cancel</Button
			>
		</form>
	{:else}
		<button type="button" class={tabClass(false)} onclick={() => (addingProject = true)}
			>+ Project</button
		>
	{/if}
	{#if activeProject}
		<form method="POST" action="?/deleteProject" use:enhance class="ml-auto">
			<input type="hidden" name="id" value={activeProject.id} />
			<button type="submit" class="text-xs text-muted-foreground hover:text-destructive"
				>Delete project</button
			>
		</form>
	{/if}
</nav>

{#if form?.action === 'createProject'}
	<p class="mb-4 text-sm text-destructive">{form.message}</p>
{/if}

<form
	method="POST"
	action="?/create"
	use:enhance={() =>
		async ({ result, update }) => {
			if (result.type === 'success') {
				title = '';
				expanded = false;
			}
			await update({ reset: false });
		}}
	class="mb-8 rounded-md border {expanded ? 'p-3' : 'p-1'} transition-[padding]"
>
	<div class="flex items-center gap-2">
		<Input
			name="title"
			placeholder={activeProject ? `Add a task to ${activeProject.name}` : 'Add a task'}
			required
			bind:value={title}
			class="flex-1 border-0 shadow-none focus-visible:ring-0"
		/>
		<Button
			type="button"
			variant="ghost"
			size="sm"
			class="text-muted-foreground"
			onclick={() => (expanded = !expanded)}
			aria-expanded={expanded}
		>
			{expanded ? 'Less' : 'More'}
		</Button>
		<Button type="submit" size="sm" disabled={!title.trim()}>Add</Button>
	</div>
	{#if expanded}
		<div class="mt-3">
			<TaskFields projects={data.projects} projectId={data.activeProjectId} />
		</div>
	{:else}
		<input type="hidden" name="projectId" value={data.activeProjectId ?? ''} />
	{/if}
	{#if form?.action === 'create'}
		<p class="mt-2 text-sm text-destructive">{form.message}</p>
	{/if}
</form>

{#if open.length === 0 && done.length === 0}
	<p class="text-sm text-muted-foreground">Nothing here yet.</p>
{/if}

<ul class="divide-y">
	{#each open as task (task.id)}
		<TaskRow
			{task}
			projects={data.projects}
			showProject={!data.activeProjectId}
			error={form?.action === 'update' && form.id === task.id ? form.message : null}
		/>
	{/each}
</ul>

{#if done.length > 0}
	<h2 class="mt-8 mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
		Done ({done.length})
	</h2>
	<ul class="divide-y">
		{#each done as task (task.id)}
			<TaskRow
				{task}
				projects={data.projects}
				showProject={!data.activeProjectId}
				error={form?.action === 'update' && form.id === task.id ? form.message : null}
			/>
		{/each}
	</ul>
{/if}
