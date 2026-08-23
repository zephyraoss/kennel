import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { oauthClient } from '$lib/server/db/schema/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
	const clientId = url.searchParams.get('client_id');
	if (!clientId) redirect(302, locals.user ? '/app' : '/');
	const [client] = await locals.database
		.select({ name: oauthClient.name })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, clientId))
		.limit(1);
	return { clientName: client?.name ?? null };
};
