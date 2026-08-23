import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { createTaskService } from '$lib/server/tasks';

const endOfToday = () => {
	const date = new Date();
	date.setHours(23, 59, 59, 999);
	return date;
};

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/');
	const tasks = await createTaskService(locals.database, locals.user.id).list({ status: 'open' });
	const cutoff = endOfToday();
	return {
		user: locals.user,
		dueTasks: tasks
			.filter((t) => t.dueAt && t.dueAt <= cutoff)
			.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt!.toISOString() }))
	};
};
