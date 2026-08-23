import type { RequestHandler } from '@sveltejs/kit';

const forward: RequestHandler = async ({ locals, request }) => locals.auth.handler(request);

export const GET = forward;
export const HEAD = forward;
