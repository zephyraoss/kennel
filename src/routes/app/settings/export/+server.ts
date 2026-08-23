import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createTaskService } from '$lib/server/tasks';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const data = await createTaskService(locals.database, locals.user.id).exportAll();
	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="kennel-${stamp}.json"`
		}
	});
};
