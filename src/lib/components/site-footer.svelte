<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import DonateDialog from '$lib/components/donate-dialog.svelte';
</script>

<footer
	class="mt-auto flex flex-col items-center gap-1 pt-8 text-base text-muted-foreground sm:flex-row sm:justify-center sm:gap-2 sm:text-sm"
>
	<span class="flex items-center gap-1">
		made with
		<HeartIcon
			class="size-4 shrink-0 animate-pulse fill-pink-300 text-pink-300"
			aria-hidden="true"
		/>
		by addi
	</span>
	<span class="hidden sm:inline" aria-hidden="true">·</span>
	<span class="flex items-center gap-2">
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
	</span>
</footer>
