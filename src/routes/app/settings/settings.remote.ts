import { invalid, redirect } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { createPushService } from '$lib/server/push';

const DELETE_PHRASE = 'delete my account';

const nameInput = z.string().trim().min(1, 'Name is required').max(100, 'Name is too long');

type Raw = Record<string, string | undefined>;

export const rename = form('unchecked', async (data: Raw) => {
	const parsed = nameInput.safeParse(data.name ?? '');
	if (!parsed.success) invalid(parsed.error.issues[0].message);
	const { locals, request } = getRequestEvent();
	await locals.auth.api.updateUser({ headers: request.headers, body: { name: parsed.data } });
	return { message: 'Name updated' };
});

export const sendTestNotification = form('unchecked', async () => {
	const { locals, platform } = getRequestEvent();
	if (!platform?.env) invalid('Push is not configured');
	const sent = await createPushService(locals.database, platform.env).send(locals.user!.id, {
		title: 'kennel',
		body: 'Push notifications are working on this device.',
		url: '/app/settings',
		tag: 'kennel-test'
	});
	if (sent === 0) invalid('No subscribed devices. Turn on reminders first.');
	return { message: `Sent to ${sent} device${sent === 1 ? '' : 's'}` };
});

export const deleteAccount = form('unchecked', async (data: Raw) => {
	if ((data.confirm ?? '').trim().toLowerCase() !== DELETE_PHRASE)
		invalid(`Type "${DELETE_PHRASE}" to confirm`);
	const { locals, request } = getRequestEvent();
	await locals.auth.api.deleteUser({ headers: request.headers, body: {} });
	redirect(303, '/');
});
