<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let { labels = $bindable(), suggestions = [] }: { labels: string[]; suggestions?: string[] } =
		$props();

	let draft = $state('');
	let input = $state<HTMLInputElement | null>(null);

	const matches = $derived(
		suggestions
			.filter((s) => !labels.includes(s))
			.filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
			.slice(0, 6)
	);

	const add = (value: string) => {
		const name = value.trim();
		if (!name || labels.includes(name)) return;
		labels = [...labels, name];
		draft = '';
	};

	const remove = (name: string) => (labels = labels.filter((l) => l !== name));

	const onkeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			add(draft);
		} else if (event.key === 'Backspace' && !draft && labels.length) {
			remove(labels[labels.length - 1]);
		}
	};
</script>

<div class="grid gap-2">
	{#if labels.length}
		<div class="flex flex-wrap gap-1">
			{#each labels as name (name)}
				<Badge variant="secondary" class="pr-1">
					{name}
					<button
						type="button"
						class="relative rounded-full text-muted-foreground hover:text-foreground"
						onclick={() => remove(name)}
					>
						<X class="size-3" data-icon="inline-end" />
						<span class="sr-only">Remove {name}</span>
						<span
							class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
							aria-hidden="true"
						></span>
					</button>
				</Badge>
			{/each}
		</div>
	{/if}
	<Input
		bind:ref={input}
		bind:value={draft}
		{onkeydown}
		aria-label="Add a label"
		placeholder="Add a label"
		autocomplete="off"
	/>
	{#if matches.length}
		<div class="flex flex-wrap gap-1">
			{#each matches as name (name)}
				<Button
					type="button"
					variant="ghost"
					size="xs"
					class="text-muted-foreground"
					onclick={() => {
						add(name);
						input?.focus();
					}}
				>
					{name}
				</Button>
			{/each}
		</div>
	{/if}
</div>
