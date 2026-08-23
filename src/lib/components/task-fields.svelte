<script lang="ts">
	import { CalendarDate, getLocalTimeZone, parseDate, today } from '@internationalized/date';
	import AlignLeft from '@lucide/svelte/icons/align-left';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import Flag from '@lucide/svelte/icons/flag';
	import Folder from '@lucide/svelte/icons/folder';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import Tag from '@lucide/svelte/icons/tag';
	import type { Component } from 'svelte';
	import LabelInput from '$lib/components/label-input.svelte';
	import TaskChip from '$lib/components/task-chip.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Popover from '$lib/components/ui/popover';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { SerializedProject, SerializedTask } from '$lib/server/tasks';

	let {
		projects,
		notes: initialNotes = '',
		priority: initialPriority = 'none',
		dueAt: initialDueAt = null,
		labels: initialLabels = [],
		projectId: initialProjectId = null,
		repeat: initialRepeat = null,
		showProject = true,
		labelSuggestions = []
	}: {
		projects: SerializedProject[];
		notes?: string | null;
		priority?: string;
		dueAt?: string | null;
		labels?: string[];
		projectId?: string | null;
		repeat?: SerializedTask['repeat'];
		showProject?: boolean;
		labelSuggestions?: string[];
	} = $props();

	// svelte-ignore state_referenced_locally
	let notes = $state(initialNotes ?? '');
	// svelte-ignore state_referenced_locally
	let priority = $state(initialPriority);
	// svelte-ignore state_referenced_locally
	let due = $state<CalendarDate | undefined>(
		initialDueAt ? parseDate(initialDueAt.slice(0, 10)) : undefined
	);
	// svelte-ignore state_referenced_locally
	let labels = $state(initialLabels);
	// svelte-ignore state_referenced_locally
	let projectId = $state(initialProjectId ?? '');
	// svelte-ignore state_referenced_locally
	let repeat = $state(initialRepeat?.every ?? '');
	// svelte-ignore state_referenced_locally
	let showNotes = $state(Boolean(initialNotes));

	let dueOpen = $state(false);
	let labelsOpen = $state(false);

	const priorityOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'low', label: 'Low' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'high', label: 'High' }
	];
	const repeatOptions = [
		{ value: '', label: 'Never' },
		{ value: 'day', label: 'Daily' },
		{ value: 'week', label: 'Weekly' },
		{ value: 'month', label: 'Monthly' }
	];
	const projectOptions = $derived([
		{ value: '', label: 'None' },
		...projects.map((p) => ({ value: p.id, label: p.name }))
	]);

	const priorityClass: Record<string, string> = {
		high: 'text-destructive',
		medium: 'text-amber-700 dark:text-amber-400'
	};

	const unsetValues = new Set(['', 'none']);
	const labelFor = (options: { value: string; label: string }[], value: string) =>
		unsetValues.has(value) ? '' : (options.find((o) => o.value === value)?.label ?? '');

	const todayDate = today(getLocalTimeZone());
	const dueQuickPicks = $derived([
		{ label: 'Today', date: todayDate },
		{ label: 'Tomorrow', date: todayDate.add({ days: 1 }) },
		{ label: 'Next week', date: todayDate.add({ weeks: 1 }) }
	]);

	const dueText = $derived.by(() => {
		if (!due) return '';
		if (due.compare(todayDate) === 0) return 'Today';
		if (due.compare(todayDate.add({ days: 1 })) === 0) return 'Tomorrow';
		return due
			.toDate(getLocalTimeZone())
			.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	});

	const labelText = $derived(labels.join(', '));
</script>

{#snippet picker(
	icon: Component,
	name: string,
	options: { value: string; label: string }[],
	value: string,
	pick: (value: string) => void,
	textClass = ''
)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<TaskChip {...props} {icon} {name} text={labelFor(options, value)} {textClass} />
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="start">
			<DropdownMenu.RadioGroup {value} onValueChange={pick}>
				{#each options as option (option.value)}
					<DropdownMenu.RadioItem value={option.value}>{option.label}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<input type="hidden" name="priority" value={priority} />
<input type="hidden" name="dueAt" value={due?.toString() ?? ''} />
<input type="hidden" name="repeat" value={repeat} />
<input type="hidden" name="labels" value={labels.join(',')} />
{#if showProject}
	<input type="hidden" name="projectId" value={projectId} />
{/if}

<div class="grid gap-2">
	<div class="flex flex-wrap items-center gap-1">
		{@render picker(
			Flag,
			'priority',
			priorityOptions,
			priority,
			(v) => (priority = v),
			priorityClass[priority] ?? ''
		)}

		<Popover.Root bind:open={dueOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<TaskChip {...props} icon={CalendarIcon} name="due date" text={dueText} />
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="start" class="w-auto items-center gap-0 p-0">
				<div class="flex flex-wrap justify-center gap-1 px-3 pt-3">
					{#each dueQuickPicks as pick (pick.label)}
						<Button
							type="button"
							variant="secondary"
							size="xs"
							onclick={() => {
								due = pick.date;
								dueOpen = false;
							}}>{pick.label}</Button
						>
					{/each}
					{#if due}
						<Button
							type="button"
							variant="ghost"
							size="xs"
							class="text-muted-foreground"
							onclick={() => {
								due = undefined;
								dueOpen = false;
							}}>Clear</Button
						>
					{/if}
				</div>
				<Calendar type="single" bind:value={due} onValueChange={() => (dueOpen = false)} />
			</Popover.Content>
		</Popover.Root>

		{@render picker(RepeatIcon, 'repeat', repeatOptions, repeat, (v) => (repeat = v))}

		<Popover.Root bind:open={labelsOpen}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<TaskChip {...props} icon={Tag} name="labels" text={labelText} />
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="start" class="w-64">
				<LabelInput bind:labels suggestions={labelSuggestions} />
			</Popover.Content>
		</Popover.Root>

		{#if showProject}
			{@render picker(Folder, 'project', projectOptions, projectId, (v) => (projectId = v))}
		{/if}

		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="relative text-muted-foreground"
			aria-pressed={showNotes}
			onclick={() => (showNotes = !showNotes)}
		>
			<AlignLeft aria-hidden="true" />
			<span class="sr-only">{showNotes ? 'Hide notes' : 'Add notes'}</span>
			<span
				class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
				aria-hidden="true"
			></span>
		</Button>
	</div>

	{#if showNotes}
		<Textarea name="notes" placeholder="Notes" aria-label="Notes" rows={2} bind:value={notes} />
	{:else}
		<input type="hidden" name="notes" value={notes} />
	{/if}
</div>
