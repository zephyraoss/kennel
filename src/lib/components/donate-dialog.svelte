<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
</script>

<Dialog.Root>
	<Dialog.Trigger class="hover:text-foreground">donate</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Support kennel</Dialog.Title>
		</Dialog.Header>
		<div class="flex flex-col gap-4 text-base/7 text-pretty text-muted-foreground sm:text-sm/6">
			<p>
				Kennel is a free and open source project and I have no interest in turning it into a paid
				product. If you find that Kennel helps you in some way, I'd appreciate if you'd consider
				donating. Even a dollar helps pay for the cost of building these tools for you.
			</p>
			<p>
				Thanks,<br />
				- addi &lt;3
			</p>
		</div>
		<div class="flex items-center gap-3">
			<Dialog.Close class={buttonVariants({ variant: 'ghost' })}>Maybe later</Dialog.Close>
			<a
				href="https://addi.lol/donate"
				target="_blank"
				rel="noopener noreferrer"
				class={buttonVariants()}
			>
				<HeartIcon class="fill-current" aria-hidden="true" />
				Donate
			</a>
		</div>
	</Dialog.Content>
</Dialog.Root>
