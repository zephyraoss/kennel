<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import TaskFields from '$lib/components/task-fields.svelte';
	import TaskRow from '$lib/components/task-row.svelte';
	import { createOptimisticTasks } from '$lib/optimistic-tasks.svelte';
	import { createProject, createTask, deleteProject } from '$lib/tasks.remote';
	import { draftTask, taskValues } from '$lib/task-form';

	let { data } = $props();

	let fieldsKey = $state(0);
	let addingProject = $state(false);
	let title = $state('');

	const optimistic = createOptimisticTasks();
	const tasks = $derived(optimistic.view(data.tasks, data.activeProjectId));
	const open = $derived(tasks.filter((t) => t.status === 'open'));
	const done = $derived(tasks.filter((t) => t.status === 'done'));
	const activeProject = $derived(data.projects.find((p) => p.id === data.activeProjectId) ?? null);

	const tabClass = (active: boolean) =>
		`rounded-md px-2 py-1.5 text-base sm:py-1 sm:text-sm ${active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`;
</script>

<nav aria-label="Projects" class="mb-6 flex flex-wrap items-center gap-1">
	<a
		href={resolve('/app')}
		class={tabClass(!data.activeProjectId)}
		aria-current={!data.activeProjectId ? 'page' : undefined}>All</a
	>
	{#each data.projects as p (p.id)}
		<a
			href="{resolve('/app')}?project={p.id}"
			class={tabClass(p.id === data.activeProjectId)}
			aria-current={p.id === data.activeProjectId ? 'page' : undefined}>{p.name}</a
		>
	{/each}
	{#if addingProject}
		<form
			{...createProject.enhance(async (form) => {
				if (await form.submit()) addingProject = false;
			})}
			class="flex items-center gap-1"
		>
			<Input
				name="name"
				placeholder="Project name"
				aria-label="Project name"
				class="h-8 w-36 sm:w-40"
				required
				autofocus
			/>
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
		<form {...deleteProject} class="ml-auto">
			<input type="hidden" name="id" value={activeProject.id} />
			<button type="submit" class="text-sm text-muted-foreground hover:text-destructive sm:text-xs"
				>Delete project<span class="sr-only"> {activeProject.name}</span></button
			>
		</form>
	{/if}
</nav>

{#each createProject.fields.allIssues() ?? [] as issue (issue)}
	<p role="alert" class="mb-4 text-base text-destructive sm:text-sm">{issue.message}</p>
{/each}

<form
	{...createTask.enhance(async (form) => {
		const submitted = title;
		const settle = optimistic.create(draftTask(taskValues(new FormData(form.element))));
		title = '';
		fieldsKey += 1;
		if (!(await form.submit())) title = submitted;
		settle();
	})}
	class="mb-8 grid gap-1 rounded-lg border p-1.5"
>
	<div class="flex items-center gap-2">
		<Input
			name="title"
			placeholder={activeProject ? `Add a task to ${activeProject.name}` : 'Add a task'}
			aria-label={activeProject ? `Add a task to ${activeProject.name}` : 'Add a task'}
			required
			bind:value={title}
			class="min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
		/>
		<Button type="submit" size="sm" disabled={!title.trim()}>Add</Button>
	</div>
	{#key fieldsKey}
		<TaskFields
			projects={data.projects}
			projectId={data.activeProjectId}
			showProject={!data.activeProjectId}
			labelSuggestions={data.labelSuggestions}
		/>
	{/key}
	{#if data.activeProjectId}
		<input type="hidden" name="projectId" value={data.activeProjectId} />
	{/if}
	{#each createTask.fields.allIssues() ?? [] as issue (issue)}
		<p role="alert" class="px-1.5 pb-1 text-base text-destructive sm:text-sm">{issue.message}</p>
	{/each}
</form>

{#if open.length === 0 && done.length === 0}
	<p class="text-base text-muted-foreground sm:text-sm">Nothing here yet.</p>
{/if}

<ul class="divide-y">
	{#each open as task (task.id)}
		<TaskRow
			{task}
			{optimistic}
			projects={data.projects}
			showProject={!data.activeProjectId}
			labelSuggestions={data.labelSuggestions}
		/>
	{/each}
</ul>

{#if done.length > 0}
	<h2
		class="mt-8 mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase sm:text-xs"
	>
		Done ({done.length})
	</h2>
	<ul class="divide-y">
		{#each done as task (task.id)}
			<TaskRow
				{task}
				{optimistic}
				projects={data.projects}
				showProject={!data.activeProjectId}
				labelSuggestions={data.labelSuggestions}
			/>
		{/each}
	</ul>
{/if}
