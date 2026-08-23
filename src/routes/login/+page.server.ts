import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { oauthClient } from '$lib/server/db/schema/auth';

const isLocalPath = (value: string | null): value is string =>
	value !== null && value.startsWith('/') && !value.startsWith('//');

export const load: PageServerLoad = async ({ locals, url }) => {
	const redirectTo = url.searchParams.get('redirect');
	const callbackURL = isLocalPath(redirectTo) ? redirectTo : '/app';
	if (locals.user && callbackURL !== '/app') redirect(302, callbackURL);
	const clientId = url.searchParams.get('client_id');
	if (!clientId) {
		if (callbackURL !== '/app') return { clientName: null, callbackURL };
		redirect(302, locals.user ? '/app' : '/');
	}
	const [client] = await locals.database
		.select({ name: oauthClient.name })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, clientId))
		.limit(1);
	return { clientName: client?.name ?? null, callbackURL };
};
