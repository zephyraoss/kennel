<script lang="ts">
	import type { Component } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	let {
		icon: Icon,
		name,
		text,
		textClass = '',
		...rest
	}: {
		icon: Component;
		name: string;
		text: string;
		textClass?: string;
		[key: string]: unknown;
	} = $props();

	let ref = $state<HTMLElement | null>(null);
	let widthBeforeUpdate = 0;
	let animation: Animation | null = null;

	const settledWidth = (node: HTMLElement) => {
		node.style.transition = 'none';
		const width = node.getBoundingClientRect().width;
		node.style.transition = '';
		return width;
	};

	$effect.pre(() => {
		void text;
		widthBeforeUpdate = ref?.getBoundingClientRect().width ?? 0;
	});

	$effect(() => {
		void text;
		if (!ref || !widthBeforeUpdate) return;
		animation?.cancel();
		const widthAfterUpdate = settledWidth(ref);
		if (widthAfterUpdate === widthBeforeUpdate) return;
		if (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		animation = ref.animate(
			[{ width: `${widthBeforeUpdate}px` }, { width: `${widthAfterUpdate}px` }],
			{ duration: 150, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
		);
		animation.onfinish = animation.oncancel = () => (animation = null);
	});
</script>

<Button
	{...rest}
	bind:ref
	type="button"
	variant={text ? 'outline' : 'ghost'}
	size={text ? 'sm' : 'icon-sm'}
	class="relative overflow-hidden {text
		? `has-data-[icon=inline-start]:pl-2 ${textClass}`
		: 'text-muted-foreground has-data-[icon=inline-start]:pl-0'}"
>
	<Icon data-icon="inline-start" aria-hidden="true" />
	{#if text}
		<span>{text}<span class="sr-only">, change {name}</span></span>
	{:else}
		<span class="sr-only">Set {name}</span>
	{/if}
	<span
		class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
		aria-hidden="true"
	></span>
</Button>
