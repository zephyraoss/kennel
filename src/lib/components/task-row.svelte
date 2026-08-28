<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { RemoteFormEnhanceInstance } from '@sveltejs/kit';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import TaskFields from '$lib/components/task-fields.svelte';
	import { type OptimisticTasks } from '$lib/optimistic-tasks.svelte';
	import { deleteTask, toggleTask, updateTask } from '$lib/tasks.remote';
	import type { SerializedProject, SerializedTask } from '$lib/server/tasks';
	import { taskValues, type TaskValues } from '$lib/task-form';

	let {
		task,
		optimistic,
		projects,
		showProject,
		labelSuggestions = []
	}: {
		task: SerializedTask;
		optimistic: OptimisticTasks;
		projects: SerializedProject[];
		showProject: boolean;
		labelSuggestions?: string[];
	} = $props();

	let editing = $state(false);
	let draft = $state<TaskValues | null>(null);

	const initial = $derived(draft ?? task);

	const done = $derived(task.status === 'done');
	const projectName = $derived(projects.find((p) => p.id === task.projectId)?.name ?? null);

	const priorityClass: Record<string, string> = {
		high: 'text-destructive',
		medium: 'text-amber-700 dark:text-amber-400',
		low: 'text-muted-foreground'
	};

	const dueLabel = (iso: string | null) => {
		if (!iso) return null;
		const date = new Date(iso);
		const overdue = !done && date < new Date(new Date().toDateString());
		return {
			text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
			overdue
		};
	};

	const due = $derived(dueLabel(task.dueAt));

	const repeatLabel: Record<string, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };
	const repeats = $derived(
		task.repeat
			? task.repeat.interval === 1
				? repeatLabel[task.repeat.every]
				: `Every ${task.repeat.interval} ${task.repeat.every}s`
			: null
	);

	const saveForm = $derived(updateTask.for(task.id));
	const removeForm = $derived(deleteTask.for(task.id));
	const toggleForm = $derived(toggleTask.for(task.id));
	const removeFormId = $derived(`delete-task-${task.id}`);

	const save = async (form: RemoteFormEnhanceInstance) => {
		const values = taskValues(new FormData(form.element));
		const settle = optimistic.patch(task.id, values);
		try {
			if (await form.submit().updates()) {
				editing = false;
				draft = null;
				await invalidateAll();
			} else {
				draft = values;
			}
		} finally {
			settle();
		}
	};
</script>

<li class="py-2.5 sm:py-2">
	{#if editing}
		<form {...saveForm.enhance(save)} class="grid gap-3 rounded-md border p-3">
			<input type="hidden" name="id" value={task.id} />
			<Input name="title" aria-label="Title" value={initial.title} required />
			<TaskFields
				{projects}
				notes={initial.notes}
				priority={initial.priority}
				dueAt={initial.dueAt}
				labels={initial.labels}
				projectId={initial.projectId}
				repeat={initial.repeat}
				showProject
				{labelSuggestions}
			/>
			{#each saveForm.fields.allIssues() ?? [] as issue (issue)}
				<p role="alert" class="text-base text-destructive sm:text-sm">{issue.message}</p>
			{/each}
			<div class="flex items-center gap-2">
				<Button type="submit" size="sm">Save</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onclick={() => {
						editing = false;
						draft = null;
					}}>Cancel</Button
				>
				<Button
					type="submit"
					size="sm"
					variant="ghost"
					form={removeFormId}
					class="ml-auto text-destructive">Delete</Button
				>
			</div>
		</form>
		<form {...removeForm} id={removeFormId}>
			<input type="hidden" name="id" value={task.id} />
		</form>
	{:else}
		<div class="flex items-start gap-3">
			<form
				{...toggleForm.enhance(async (form) => {
					const settle = optimistic.patch(task.id, {
						status: done ? 'open' : 'done',
						completedAt: done ? null : new Date().toISOString()
					});
					try {
						if (await form.submit().updates()) await invalidateAll();
					} finally {
						settle();
					}
				})}
				class="pt-0.5"
			>
				<input type="hidden" name="id" value={task.id} />
				<input type="hidden" name="status" value={task.status} />
				<button
					type="submit"
					aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
					class="relative block size-5 rounded-full border border-foreground/40 transition-colors hover:border-foreground sm:size-4 {done
						? 'bg-foreground/60'
						: ''}"
				>
					<span
						class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
						aria-hidden="true"
					></span>
				</button>
			</form>
			<button type="button" class="min-w-0 flex-1 text-left" onclick={() => (editing = true)}>
				<span class="sr-only">Edit</span>
				<div class="text-base sm:text-sm {done ? 'text-muted-foreground line-through' : ''}">
					{task.title}{#if done}<span class="sr-only"> (done)</span>{/if}
				</div>
				{#if task.notes}
					<div
						class="mt-0.5 line-clamp-2 text-sm whitespace-pre-line text-muted-foreground sm:text-xs"
					>
						{task.notes}
					</div>
				{/if}
				{#if task.priority !== 'none' || due || repeats || task.labels.length || (showProject && projectName)}
					<div
						class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:text-xs"
					>
						{#if task.priority !== 'none'}
							<span class="capitalize {priorityClass[task.priority]}"
								>{task.priority}<span class="sr-only"> priority</span></span
							>
						{/if}
						{#if due}
							<span class={due.overdue ? 'text-destructive' : ''}
								>{due.text}{#if due.overdue}<span class="sr-only"> (overdue)</span>{/if}</span
							>
						{/if}
						{#if repeats}
							<span>{repeats}</span>
						{/if}
						{#each task.labels as label (label)}
							<span class="rounded bg-muted px-1.5 py-0.5">{label}</span>
						{/each}
						{#if showProject && projectName}
							<span>{projectName}</span>
						{/if}
					</div>
				{/if}
			</button>
		</div>
	{/if}
</li>
