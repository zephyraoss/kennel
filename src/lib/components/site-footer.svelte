<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import DonateDialog from '$lib/components/donate-dialog.svelte';
</script>

<footer
	class="mt-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-8 text-sm text-muted-foreground"
>
	<span class="flex items-center gap-1">
		made with
		<HeartIcon class="size-4 animate-pulse fill-pink-300 text-pink-300" aria-hidden="true" />
		by addi
	</span>
	<span aria-hidden="true">·</span>
	<DonateDialog />
	<span aria-hidden="true">·</span>
	<a
		href="https://github.com/zephyraoss/kennel"
		target="_blank"
		rel="noopener noreferrer"
		class="hover:text-foreground"
	>
		github
	</a>
	<span aria-hidden="true">·</span>
	<span class="tabular-nums">{__BUILD_ID__}</span>
</footer>
