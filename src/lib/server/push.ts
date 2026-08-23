import { buildPushHTTPRequest } from '@pushforge/builder';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db';
import { pushSubscription, type PushSubscription } from './db/schema/push';

export type PushEnv = {
	VAPID_PRIVATE_KEY: string;
	VAPID_SUBJECT: string;
};

export const pushSubscriptionInput = z.object({
	endpoint: z.url().max(2_000),
	keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) })
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInput>;

export type PushPayload = {
	title: string;
	body: string;
	url: string;
	tag: string;
};

const GONE_STATUSES = new Set([404, 410]);

export const createPushService = (db: Database, env: PushEnv) => {
	const subscribe = async (userId: string, input: PushSubscriptionInput) => {
		await db
			.insert(pushSubscription)
			.values({
				id: crypto.randomUUID(),
				userId,
				endpoint: input.endpoint,
				p256dh: input.keys.p256dh,
				auth: input.keys.auth
			})
			.onConflictDoUpdate({
				target: pushSubscription.endpoint,
				set: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth }
			});
	};

	const unsubscribe = async (userId: string, endpoint: string) => {
		await db
			.delete(pushSubscription)
			.where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
	};

	const listForUser = (userId: string) =>
		db.select().from(pushSubscription).where(eq(pushSubscription.userId, userId));

	const deliver = async (subscription: PushSubscription, payload: PushPayload) => {
		const { endpoint, headers, body } = await buildPushHTTPRequest({
			privateJWK: env.VAPID_PRIVATE_KEY,
			subscription: {
				endpoint: subscription.endpoint,
				keys: { p256dh: subscription.p256dh, auth: subscription.auth }
			},
			message: {
				payload,
				adminContact: env.VAPID_SUBJECT,
				options: { ttl: 60 * 60 * 12, urgency: 'normal', topic: payload.tag }
			}
		});
		const response = await fetch(endpoint, { method: 'POST', headers, body });
		if (GONE_STATUSES.has(response.status)) return 'gone';
		return response.ok ? 'sent' : 'failed';
	};

	const sendToMany = async (subscriptions: PushSubscription[], payload: PushPayload) => {
		const results = await Promise.all(
			subscriptions.map(async (subscription) => ({
				subscription,
				outcome: await deliver(subscription, payload).catch((cause) => {
					console.error(`push delivery failed for ${subscription.endpoint}`, cause);
					return 'failed' as const;
				})
			}))
		);
		const gone = results.filter((r) => r.outcome === 'gone').map((r) => r.subscription.id);
		if (gone.length) await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
		return results.filter((r) => r.outcome === 'sent').length;
	};

	const send = async (userId: string, payload: PushPayload) =>
		sendToMany(await listForUser(userId), payload);

	return { subscribe, unsubscribe, listForUser, send, sendToMany };
};

export type PushService = ReturnType<typeof createPushService>;
