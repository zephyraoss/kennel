import { json } from '@sveltejs/kit';
import { parseBody, withTasks } from '$lib/server/api';
import { projectInput, serializeProject } from '$lib/server/tasks';

export const GET = withTasks('tasks:read', async ({ tasks }) =>
	json({ projects: (await tasks.projects.list()).map(serializeProject) })
);

export const POST = withTasks('tasks:write', async ({ event, tasks }) => {
	const { name } = await parseBody(event.request, projectInput);
	return json({ project: serializeProject(await tasks.projects.create(name)) }, { status: 201 });
});
