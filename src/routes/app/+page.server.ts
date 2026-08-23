import type { PageServerLoad } from './$types';
import { createTaskService, serializeProject, serializeTask } from '$lib/server/tasks';

export const load: PageServerLoad = async ({ locals, url }) => {
	const tasks = createTaskService(locals.database, locals.user!.id);
	const projectId = url.searchParams.get('project') ?? undefined;
	const [rows, projects, labels] = await Promise.all([
		tasks.list({ projectId }),
		tasks.projects.list(),
		tasks.labels()
	]);
	return {
		tasks: rows.map(serializeTask),
		projects: projects.map(serializeProject),
		labelSuggestions: labels.map((l) => l.name),
		activeProjectId: projectId ?? null
	};
};
