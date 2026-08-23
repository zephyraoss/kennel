import { json } from '@sveltejs/kit';
import { parseBody, parseQuery, withTasks } from '$lib/server/api';
import { bulkTaskPatch, serializeTask, taskInput, taskListQuery } from '$lib/server/tasks';

export const GET = withTasks('tasks:read', async ({ event, tasks }) => {
	const query = parseQuery(event.url, taskListQuery);
	const rows = await tasks.list(query);
	return json({ tasks: rows.map(serializeTask) });
});

export const POST = withTasks('tasks:write', async ({ event, tasks }) => {
	const input = await parseBody(event.request, taskInput);
	const row = await tasks.create(input);
	return json({ task: serializeTask(row) }, { status: 201 });
});

export const PATCH = withTasks('tasks:write', async ({ event, tasks }) => {
	const input = await parseBody(event.request, bulkTaskPatch);
	const result = await tasks.updateMany(input);
	return json({ tasks: result.tasks.map(serializeTask), next: result.next.map(serializeTask) });
});
