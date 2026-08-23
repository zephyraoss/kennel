import type { PageServerLoad } from './$types';
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
