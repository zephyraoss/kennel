import { invalid } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { TASK_SCOPES } from '$lib/server/auth';
import { createConnectedAppsService } from '$lib/server/connected-apps';

type Raw = Record<string, string | undefined>;

export const createClient = form('unchecked', async (data: Raw) => {
	const name = (data.name ?? '').trim();
	const redirectUris = (data.redirect_uris ?? '').split(/\s+/).filter(Boolean);
	if (!name) invalid('Name is required');
	if (redirectUris.length === 0) invalid('At least one redirect URI is required');
	const { locals, request } = getRequestEvent();
	const created = await locals.auth.api.createOAuthClient({
		headers: request.headers,
		body: { client_name: name, redirect_uris: redirectUris, scope: TASK_SCOPES.join(' ') }
	});
	return {
		created: { name, clientId: created.client_id, clientSecret: created.client_secret ?? null }
	};
});

export const deleteClient = form('unchecked', async (data: Raw) => {
	const { locals, request } = getRequestEvent();
	await locals.auth.api.deleteOAuthClient({
		headers: request.headers,
		body: { client_id: data.client_id ?? '' }
	});
});

export const revokeApp = form('unchecked', async (data: Raw) => {
	const { locals } = getRequestEvent();
	await createConnectedAppsService(locals.database, locals.user!.id).revoke(data.id ?? '');
});
