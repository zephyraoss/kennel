<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { SerializedProject, SerializedTask } from '$lib/server/tasks';

	let {
		projects,
		notes = '',
		priority = 'none',
		dueAt = null,
		labels = [],
		projectId = null,
		repeat = null
	}: {
		projects: SerializedProject[];
		notes?: string | null;
		priority?: string;
		dueAt?: string | null;
		labels?: string[];
		projectId?: string | null;
		repeat?: SerializedTask['repeat'];
	} = $props();

	const dateValue = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
	const selectClass =
		'h-9 w-full min-w-0 rounded-md border bg-background px-2 text-base sm:text-sm';
</script>

<div class="grid gap-3">
	<Textarea name="notes" placeholder="Notes" aria-label="Notes" rows={2} value={notes ?? ''} />
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
		<label class="grid min-w-0 gap-1 text-sm text-muted-foreground sm:text-xs">
			Priority
			<select name="priority" class={selectClass} value={priority}>
				<option value="none">None</option>
				<option value="low">Low</option>
				<option value="medium">Medium</option>
				<option value="high">High</option>
			</select>
		</label>
		<label class="grid min-w-0 gap-1 text-sm text-muted-foreground sm:text-xs">
			Due
			<Input name="dueAt" type="date" value={dateValue(dueAt)} />
		</label>
		<label class="grid min-w-0 gap-1 text-sm text-muted-foreground sm:text-xs">
			Repeat
			<select name="repeat" class={selectClass} value={repeat?.every ?? ''}>
				<option value="">Never</option>
				<option value="day">Daily</option>
				<option value="week">Weekly</option>
				<option value="month">Monthly</option>
			</select>
		</label>
		<label class="grid min-w-0 gap-1 text-sm text-muted-foreground sm:text-xs">
			Labels
			<Input name="labels" placeholder="a, b" value={labels.join(', ')} />
		</label>
		<label class="grid min-w-0 gap-1 text-sm text-muted-foreground sm:text-xs">
			Project
			<select name="projectId" class={selectClass} value={projectId ?? ''}>
				<option value="">None</option>
				{#each projects as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
		</label>
	</div>
</div>
