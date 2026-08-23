import { json } from '@sveltejs/kit';
import { apiError, parseBody, withTasks } from '$lib/server/api';
import { projectInput, serializeProject } from '$lib/server/tasks';

const notFound = () => apiError(404, 'not_found', 'Project not found');

export const GET = withTasks('tasks:read', async ({ event, tasks }) => {
	const row = await tasks.projects.get(event.params.id!);
	return row ? json({ project: serializeProject(row) }) : notFound();
});

export const PATCH = withTasks('tasks:write', async ({ event, tasks }) => {
	const { name } = await parseBody(event.request, projectInput);
	const row = await tasks.projects.rename(event.params.id!, name);
	return row ? json({ project: serializeProject(row) }) : notFound();
});

export const DELETE = withTasks('tasks:write', async ({ event, tasks }) => {
	const removed = await tasks.projects.remove(event.params.id!);
	return removed ? new Response(null, { status: 204 }) : notFound();
});
