import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	ProjectNotFound,
	createTaskService,
	projectInput,
	serializeProject,
	serializeTask,
	taskInput,
	taskPatch
} from '$lib/server/tasks';

const service = (locals: App.Locals) => createTaskService(locals.database, locals.user!.id);

export const load: PageServerLoad = async ({ locals, url }) => {
	const tasks = service(locals);
	const projectId = url.searchParams.get('project') ?? undefined;
	const [rows, projects] = await Promise.all([tasks.list({ projectId }), tasks.projects.list()]);
	return {
		tasks: rows.map(serializeTask),
		projects: projects.map(serializeProject),
		activeProjectId: projectId ?? null
	};
};

const field = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
};

const optional = (value: string) => (value === '' ? null : value);

const parseLabels = (raw: string) => [
	...new Set(
		raw
			.split(',')
			.map((l) => l.trim())
			.filter(Boolean)
	)
];

const taskFields = (form: FormData) => ({
	title: field(form, 'title'),
	notes: optional(field(form, 'notes')),
	priority: field(form, 'priority') || 'none',
	dueAt: optional(field(form, 'dueAt')) && new Date(field(form, 'dueAt')).toISOString(),
	labels: parseLabels(field(form, 'labels')),
	projectId: optional(field(form, 'projectId'))
});

const firstIssue = (error: { issues: { message: string }[] }) =>
	error.issues[0]?.message ?? 'Invalid input';

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const form = await request.formData();
		const parsed = taskInput.safeParse(taskFields(form));
		if (!parsed.success) return fail(400, { action: 'create', message: firstIssue(parsed.error) });
		try {
			await service(locals).create(parsed.data);
		} catch (error) {
			if (error instanceof ProjectNotFound)
				return fail(400, { action: 'create', message: 'Unknown project' });
			throw error;
		}
	},
	update: async ({ locals, request }) => {
		const form = await request.formData();
		const id = field(form, 'id');
		const parsed = taskPatch.safeParse(taskFields(form));
		if (!parsed.success)
			return fail(400, { action: 'update', id, message: firstIssue(parsed.error) });
		try {
			await service(locals).update(id, parsed.data);
		} catch (error) {
			if (error instanceof ProjectNotFound)
				return fail(400, { action: 'update', id, message: 'Unknown project' });
			throw error;
		}
	},
	toggle: async ({ locals, request }) => {
		const form = await request.formData();
		const status = field(form, 'status') === 'done' ? 'open' : 'done';
		await service(locals).update(field(form, 'id'), { status });
	},
	delete: async ({ locals, request }) => {
		await service(locals).remove(field(await request.formData(), 'id'));
	},
	createProject: async ({ locals, request }) => {
		const form = await request.formData();
		const parsed = projectInput.safeParse({ name: field(form, 'name') });
		if (!parsed.success)
			return fail(400, { action: 'createProject', message: firstIssue(parsed.error) });
		const created = await service(locals).projects.create(parsed.data.name);
		redirect(303, `/app?project=${created.id}`);
	},
	deleteProject: async ({ locals, request }) => {
		await service(locals).projects.remove(field(await request.formData(), 'id'));
		redirect(303, '/app');
	}
};
