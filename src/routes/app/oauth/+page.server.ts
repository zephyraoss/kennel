import type { PageServerLoad } from './$types';
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
