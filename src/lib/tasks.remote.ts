import { invalid, redirect } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import {
	ProjectNotFound,
	createTaskService,
	projectInput,
	taskInput,
	taskPatch
} from '$lib/server/tasks';
import { taskValues } from '$lib/task-form';

type Raw = Record<string, string | undefined>;

const service = () => {
	const { locals } = getRequestEvent();
	return createTaskService(locals.database, locals.user!.id);
};

const firstIssue = (error: { issues: { message: string }[] }) =>
	error.issues[0]?.message ?? 'Invalid input';

export const createTask = form('unchecked', async (data: Raw) => {
	const parsed = taskInput.safeParse(taskValues(data));
	if (!parsed.success) invalid(firstIssue(parsed.error));
	try {
		await service().create(parsed.data);
	} catch (cause) {
		if (cause instanceof ProjectNotFound) invalid('Unknown project');
		throw cause;
	}
});

export const updateTask = form('unchecked', async (data: Raw) => {
	const parsed = taskPatch.safeParse(taskValues(data));
	if (!parsed.success) invalid(firstIssue(parsed.error));
	try {
		await service().update(data.id ?? '', parsed.data);
	} catch (cause) {
		if (cause instanceof ProjectNotFound) invalid('Unknown project');
		throw cause;
	}
});

export const toggleTask = form('unchecked', async (data: Raw) => {
	const status = data.status === 'done' ? 'open' : 'done';
	await service().update(data.id ?? '', { status });
});

export const deleteTask = form('unchecked', async (data: Raw) => {
	await service().remove(data.id ?? '');
});

export const createProject = form('unchecked', async (data: Raw) => {
	const parsed = projectInput.safeParse({ name: data.name ?? '' });
	if (!parsed.success) invalid(firstIssue(parsed.error));
	const created = await service().projects.create(parsed.data.name);
	redirect(303, `/app?project=${created.id}`);
});

export const deleteProject = form('unchecked', async (data: Raw) => {
	await service().projects.remove(data.id ?? '');
	redirect(303, '/app');
});
