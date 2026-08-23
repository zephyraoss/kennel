import { json } from '@sveltejs/kit';
import { apiError, parseBody, withTasks } from '$lib/server/api';
import { serializeTask, taskPatch } from '$lib/server/tasks';

const notFound = () => apiError(404, 'not_found', 'Task not found');

export const GET = withTasks('tasks:read', async ({ event, tasks }) => {
	const row = await tasks.get(event.params.id!);
	return row ? json({ task: serializeTask(row) }) : notFound();
});

export const PATCH = withTasks('tasks:write', async ({ event, tasks }) => {
	const patch = await parseBody(event.request, taskPatch);
	const row = await tasks.update(event.params.id!, patch);
	return row ? json({ task: serializeTask(row) }) : notFound();
});

export const DELETE = withTasks('tasks:write', async ({ event, tasks }) => {
	const removed = await tasks.remove(event.params.id!);
	return removed ? new Response(null, { status: 204 }) : notFound();
});
