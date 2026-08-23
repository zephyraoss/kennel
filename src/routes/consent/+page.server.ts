import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, request }) => {
	if (!locals.user) redirect(302, `/login?${url.searchParams}`);
	const clientId = url.searchParams.get('client_id');
	if (!clientId) error(400, 'Missing client_id');
	const client = await locals.auth.api.getOAuthClientPublic({
		headers: request.headers,
		query: { client_id: clientId }
	});
	return {
		clientName: client?.client_name ?? clientId,
		scopes: (url.searchParams.get('scope') ?? '').split(' ').filter(Boolean)
	};
};
