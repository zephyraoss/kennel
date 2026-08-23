import { json } from '@sveltejs/kit';
import { withTasks } from '$lib/server/api';

export const GET = withTasks('tasks:read', async ({ tasks }) => {
	return json({ labels: await tasks.labels() });
});
