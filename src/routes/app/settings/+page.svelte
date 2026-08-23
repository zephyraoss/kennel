<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import TransferDialog from '$lib/components/transfer-dialog.svelte';
	import { notifications } from '$lib/notifications.svelte';

	let { data, form } = $props();

	let name = $state(untrack(() => data.user.name));
	let confirmDelete = $state('');
	let importOpen = $state(false);
	let exportOpen = $state(false);

	const feedback = (action: string) => (form?.action === action ? form.message : null);
	const feedbackClass = page.status >= 400 ? 'text-destructive' : 'text-muted-foreground';

	let busy = $state(false);
	let pushError = $state<string | null>(null);

	$effect(() => {
		notifications.refresh();
	});

	const describePushError = (cause: unknown) => {
		const message = cause instanceof Error ? cause.message : String(cause);
		if (/push service/i.test(message))
			return "This browser couldn't reach its push service. De-Googled Chromium builds like Helium or ungoogled-chromium can't subscribe; try Firefox or Google Chrome.";
		if (/applicationServerKey/i.test(message))
			return 'An older subscription is in the way. Unregister the service worker in devtools and try again.';
		return `Couldn't turn on reminders: ${message}`;
	};

	const toggleNotifications = async () => {
		if (!data.vapidPublicKey) return;
		busy = true;
		pushError = null;
		try {
			if (notifications.enabled) await notifications.disable();
			else await notifications.enable(data.vapidPublicKey);
		} catch (cause) {
			pushError = describePushError(cause);
		} finally {
			busy = false;
		}
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
				This browser doesn't support push notifications. On iOS, add kennel to your home screen
				first.
			</p>
		{:else if !data.vapidPublicKey}
			<p class="text-muted-foreground">Push notifications aren't configured on this server.</p>
		{:else if notifications.permission === 'denied' && !notifications.enabled}
			<p class="text-muted-foreground">
				Notifications are blocked for this site. Allow them in your browser settings to turn them
				on.
			</p>
		{:else}
			<p class="text-muted-foreground">
				Get a push notification on this device for tasks that are due.
			</p>
			<div class="flex flex-wrap gap-2">
				<Button
					variant={notifications.enabled ? 'outline' : 'default'}
					onclick={toggleNotifications}
					disabled={busy || !notifications.ready}
					aria-pressed={notifications.enabled}
				>
					{notifications.enabled ? 'Turn off reminders' : 'Turn on reminders'}
				</Button>
				{#if notifications.enabled}
					<form method="POST" action="?/testNotification" use:enhance>
						<Button type="submit" variant="ghost">Send a test</Button>
					</form>
				{/if}
			</div>
			{#if pushError}
				<p role="alert" class="text-destructive">{pushError}</p>
			{:else if feedback('test')}
				<p role="status" class={feedbackClass}>{feedback('test')}</p>
			{/if}
		{/if}
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="font-semibold">Your data</h2>
		<p class="text-muted-foreground">
			Bring tasks from your previously-favorite task system or export to another system.
		</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => (importOpen = true)}>Import tasks</Button>
			<Button variant="outline" onclick={() => (exportOpen = true)}>Export tasks</Button>
			<a
				href={resolve('/app/settings/export')}
				download
				class={buttonVariants({ variant: 'ghost' })}>Quick JSON backup</a
			>
		</div>
		<TransferDialog mode="import" bind:open={importOpen} />
		<TransferDialog mode="export" bind:open={exportOpen} />
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
