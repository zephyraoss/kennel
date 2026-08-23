import { json } from '@sveltejs/kit';
import { parseBody, withTasks } from '$lib/server/api';
import { serializeTask, taskOrder } from '$lib/server/tasks';

export const PUT = withTasks('tasks:write', async ({ event, tasks }) => {
	const { ids } = await parseBody(event.request, taskOrder);
	const rows = await tasks.reorder(ids);
	return json({ tasks: rows.map(serializeTask) });
});
