import { json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { createTaskService, importProjectsInput, importTasksInput } from '$lib/server/tasks';

const body = z.union([importProjectsInput, importTasksInput]);

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ error: 'Invalid import payload' }, { status: 400 });
	const tasks = createTaskService(locals.database, locals.user.id);
	if ('projects' in parsed.data) return json(await tasks.importProjects(parsed.data.projects));
	return json({ imported: await tasks.importTasks(parsed.data.tasks) });
};
