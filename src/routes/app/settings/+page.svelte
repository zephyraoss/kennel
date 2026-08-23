<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { notifications } from '$lib/notifications.svelte';

	let { data, form } = $props();

	let name = $state(untrack(() => data.user.name));
	let confirmDelete = $state('');

	const feedback = (action: string) => (form?.action === action ? form.message : null);
	const feedbackClass = page.status >= 400 ? 'text-destructive' : 'text-muted-foreground';

	const toggleNotifications = async () => {
		if (notifications.enabled) notifications.disable();
		else await notifications.enable();
	};
</script>

<div class="flex flex-col gap-10 text-base sm:text-sm">
	<section class="flex flex-col gap-3">
		<h2 class="font-semibold">Profile</h2>
		<p class="text-muted-foreground">Signed in with GitHub as {data.email}.</p>
		<form
			method="POST"
			action="?/rename"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					await invalidateAll();
				}}
			class="flex flex-col gap-2"
		>
			<Label for="name">Display name</Label>
			<div class="flex gap-2">
				<Input id="name" name="name" bind:value={name} required maxlength={100} class="flex-1" />
				<Button type="submit" class="shrink-0" disabled={name.trim() === data.user.name}
					>Save</Button
				>
			</div>
			{#if feedback('rename')}
				<p role="status" class={feedbackClass}>{feedback('rename')}</p>
			{/if}
		</form>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="font-semibold">Notifications</h2>
		{#if !notifications.supported}
			<p class="text-muted-foreground">
				This browser doesn't support notifications. On iOS, add kennel to your home screen first.
			</p>
		{:else if notifications.permission === 'denied' && !notifications.enabled}
			<p class="text-muted-foreground">
				Notifications are blocked for this site. Allow them in your browser settings to turn them
				on.
			</p>
		{:else}
			<p class="text-muted-foreground">
				Get a reminder for overdue and due-today tasks whenever you open kennel on this device.
			</p>
			<div>
				<Button
					variant={notifications.enabled ? 'outline' : 'default'}
					onclick={toggleNotifications}
					aria-pressed={notifications.enabled}
				>
					{notifications.enabled ? 'Turn off reminders' : 'Turn on reminders'}
				</Button>
			</div>
		{/if}
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="font-semibold">Your data</h2>
		<p class="text-muted-foreground">
			Export everything as JSON, or import a previous export. Imported tasks and projects are added
			alongside what's already here.
		</p>
		<div>
			<a
				href={resolve('/app/settings/export')}
				download
				class={buttonVariants({ variant: 'outline' })}>Export JSON</a
			>
		</div>
		<form
			method="POST"
			action="?/import"
			enctype="multipart/form-data"
			use:enhance
			class="flex flex-col gap-2"
		>
			<Label for="file">Import from file</Label>
			<div class="flex gap-2">
				<Input
					id="file"
					name="file"
					type="file"
					accept="application/json,.json"
					required
					class="flex-1"
				/>
				<Button type="submit" variant="outline" class="shrink-0">Import</Button>
			</div>
			{#if feedback('import')}
				<p role="status" class={feedbackClass}>{feedback('import')}</p>
			{/if}
		</form>
	</section>

	<section class="flex flex-col gap-3 rounded-md border border-destructive/40 p-4">
		<h2 class="font-semibold text-destructive">Delete account</h2>
		<p class="text-muted-foreground">
			Permanently removes your account, tasks, projects, API keys, and connected apps. This can't be
			undone, so export first if you might want your data later.
		</p>
		<form method="POST" action="?/deleteAccount" use:enhance class="flex flex-col gap-2">
			<Label for="confirm">Type <strong>{data.deletePhrase}</strong> to confirm</Label>
			<div class="flex gap-2">
				<Input
					id="confirm"
					name="confirm"
					bind:value={confirmDelete}
					autocomplete="off"
					class="flex-1"
				/>
				<Button
					type="submit"
					variant="destructive"
					class="shrink-0"
					disabled={confirmDelete.trim().toLowerCase() !== data.deletePhrase}
				>
					Delete account
				</Button>
			</div>
			{#if feedback('deleteAccount')}
				<p role="alert" class="text-destructive">{feedback('deleteAccount')}</p>
			{/if}
		</form>
	</section>
</div>
