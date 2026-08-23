import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { createPushService } from '$lib/server/push';

const DELETE_PHRASE = 'delete my account';

const nameInput = z.string().trim().min(1, 'Name is required').max(100, 'Name is too long');

export const load: PageServerLoad = ({ locals, platform }) => ({
	email: locals.user!.email,
	deletePhrase: DELETE_PHRASE,
	vapidPublicKey: platform?.env.VAPID_PUBLIC_KEY ?? null
});

export const actions: Actions = {
	rename: async ({ locals, request }) => {
		const form = await request.formData();
		const parsed = nameInput.safeParse(form.get('name'));
		if (!parsed.success)
			return fail(400, { action: 'rename', message: parsed.error.issues[0].message });
		await locals.auth.api.updateUser({ headers: request.headers, body: { name: parsed.data } });
		return { action: 'rename', message: 'Name updated' };
	},
	testNotification: async ({ locals, platform }) => {
		if (!platform?.env) return fail(500, { action: 'test', message: 'Push is not configured' });
		const sent = await createPushService(locals.database, platform.env).send(locals.user!.id, {
			title: 'kennel',
			body: 'Push notifications are working on this device.',
			url: '/app/settings',
			tag: 'kennel-test'
		});
		if (sent === 0)
			return fail(400, {
				action: 'test',
				message: 'No subscribed devices. Turn on reminders first.'
			});
		return { action: 'test', message: `Sent to ${sent} device${sent === 1 ? '' : 's'}` };
	},
	deleteAccount: async ({ locals, request }) => {
		const form = await request.formData();
		if (
			String(form.get('confirm') ?? '')
				.trim()
				.toLowerCase() !== DELETE_PHRASE
		)
			return fail(400, { action: 'deleteAccount', message: `Type "${DELETE_PHRASE}" to confirm` });
		await locals.auth.api.deleteUser({ headers: request.headers, body: {} });
		redirect(303, '/');
	}
};
