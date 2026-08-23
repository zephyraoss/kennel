import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resourceUrls } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, request }) => {
	const { apiKeys } = await locals.auth.api.listApiKeys({ headers: request.headers });
	const { baseURL } = await locals.auth.$context;
	return {
		keys: apiKeys.map((k) => ({
			id: k.id,
			name: k.name,
			start: k.start,
			createdAt: k.createdAt.toISOString(),
			lastRequest: k.lastRequest?.toISOString() ?? null
		})),
		urls: resourceUrls(baseURL)
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Name is required' });
		const created = await locals.auth.api.createApiKey({
			headers: request.headers,
			body: { name }
		});
		return { createdKey: created.key, createdName: name };
	},
	delete: async ({ locals, request }) => {
		const form = await request.formData();
		await locals.auth.api.deleteApiKey({
			headers: request.headers,
			body: { keyId: String(form.get('id') ?? '') }
		});
	}
};
