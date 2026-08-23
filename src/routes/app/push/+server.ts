import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestEvent, RequestHandler } from './$types';
import { createPushService, pushSubscriptionInput } from '$lib/server/push';

const unsubscribeInput = z.object({ endpoint: z.url().max(2_000) });

const parse = async <T>(request: Request, schema: z.ZodType<T>) => {
	const body = await request.json().catch(() => null);
	const parsed = schema.safeParse(body);
	if (!parsed.success) error(400, 'Invalid push subscription');
	return parsed.data;
};

const context = ({ locals, platform }: RequestEvent) => {
	if (!locals.user) error(401, 'Unauthorized');
	if (!platform?.env) error(500, 'Missing platform bindings');
	return { userId: locals.user.id, push: createPushService(locals.database, platform.env) };
};

export const POST: RequestHandler = async (event) => {
	const { userId, push } = context(event);
	const input = await parse(event.request, pushSubscriptionInput);
	await push.subscribe(userId, input);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { userId, push } = context(event);
	const input = await parse(event.request, unsubscribeInput);
	await push.unsubscribe(userId, input.endpoint);
	return json({ ok: true });
};
