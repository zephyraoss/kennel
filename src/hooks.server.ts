import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { getDrizzle } from '$lib/server/db';

const isHeadlessRoute = (pathname: string) =>
	pathname === '/mcp' || pathname.startsWith('/api/v1/') || pathname.startsWith('/.well-known/');

const isAuthRoute = (pathname: string) => pathname.startsWith('/api/auth/');

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const formContentTypes = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

const isFormSubmission = (request: Request) => {
	const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
	return formContentTypes.includes(contentType);
};

const isCrossSiteFormSubmission = (request: Request, url: URL) =>
	mutatingMethods.has(request.method) &&
	isFormSubmission(request) &&
	request.headers.get('origin') !== url.origin;

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

	if (!isAuthRoute(event.url.pathname) && isCrossSiteFormSubmission(event.request, event.url)) {
		return new Response(`Cross-site ${event.request.method} form submissions are forbidden`, {
			status: 403
		});
	}

	const session = await event.locals.auth.api.getSession({ headers: event.request.headers });
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth: event.locals.auth, building });
};
