import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TASK_SCOPES } from '$lib/server/auth';
import { createConnectedAppsService } from '$lib/server/connected-apps';

export const load: PageServerLoad = async ({ locals, request }) => {
	const [clients, apps, { baseURL }] = await Promise.all([
		locals.auth.api.getOAuthClients({ headers: request.headers }).then((c) => c ?? []),
		createConnectedAppsService(locals.database, locals.user!.id).list(),
		locals.auth.$context
	]);
	return {
		apps,
		clients: clients.map((c) => ({
			clientId: c.client_id,
			name: c.client_name ?? c.client_id,
			redirectUris: c.redirect_uris
		})),
		issuer: baseURL
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const redirectUris = String(form.get('redirect_uris') ?? '')
			.split(/\s+/)
			.filter(Boolean);
		if (!name) return fail(400, { message: 'Name is required' });
		if (redirectUris.length === 0)
			return fail(400, { message: 'At least one redirect URI is required' });
		const created = await locals.auth.api.createOAuthClient({
			headers: request.headers,
			body: { client_name: name, redirect_uris: redirectUris, scope: TASK_SCOPES.join(' ') }
		});
		return {
			created: { name, clientId: created.client_id, clientSecret: created.client_secret ?? null }
		};
	},
	delete: async ({ locals, request }) => {
		const form = await request.formData();
		await locals.auth.api.deleteOAuthClient({
			headers: request.headers,
			body: { client_id: String(form.get('client_id') ?? '') }
		});
	},
	revoke: async ({ locals, request }) => {
		const form = await request.formData();
		await createConnectedAppsService(locals.database, locals.user!.id).revoke(
			String(form.get('id') ?? '')
		);
	}
};
