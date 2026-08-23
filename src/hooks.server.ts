import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { getDrizzle } from '$lib/server/db';

const isHeadlessRoute = (pathname: string) =>
	pathname === '/mcp' || pathname.startsWith('/api/v1/') || pathname.startsWith('/.well-known/');

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	if (!env?.D1) {
		throw new Error(
			'Missing D1 binding. In development, run the `dev` script with wrangler bindings.'
		);
	}

	event.locals.database = getDrizzle(env.D1);
	event.locals.auth = createAuth(event.locals.database, env);

	if (isHeadlessRoute(event.url.pathname)) {
		return resolve(event);
	}

	const session = await event.locals.auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth: event.locals.auth, building });
};
