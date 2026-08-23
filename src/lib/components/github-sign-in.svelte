<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { authClient } from '$lib/auth';

	let { callbackURL = '/app' }: { callbackURL?: string } = $props();
	let pending = $state(false);

	const signIn = async () => {
		pending = true;
		await authClient.signIn.social({ provider: 'github', callbackURL });
	};
</script>

<Button onclick={signIn} disabled={pending} aria-busy={pending} class="w-full">
	{pending ? 'Redirecting…' : 'Continue with GitHub'}
</Button>
