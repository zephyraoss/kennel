import { redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { PageServerLoad } from './$types';

const describeFailure = (failure: unknown) => {
	if (!(failure instanceof APIError)) return 'Something went wrong';
	const code = (failure.body as { error?: string } | undefined)?.error;
	if (code === 'expired_token') return 'That code has expired. Ask the device for a new one.';
	return 'That code was not recognized. Check it and try again.';
};

export const load: PageServerLoad = async ({ locals, url, request }) => {
	const userCode = url.searchParams.get('user_code')?.trim() ?? '';
	if (!locals.user) {
		redirect(302, `/login?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
	if (!userCode) return { userCode, request: null, failure: null };
	try {
		const verification = await locals.auth.api.deviceVerify({
			headers: request.headers,
			query: { user_code: userCode }
		});
		if (verification.status !== 'pending' || !verification.client_id) {
			return { userCode, request: null, failure: 'That code has already been used.' };
		}
		const client = await locals.auth.api.getOAuthClientPublic({
			headers: request.headers,
			query: { client_id: verification.client_id }
		});
		return {
			userCode,
			request: {
				clientName: client?.client_name ?? verification.client_id,
				scopes: (verification.scope ?? '').split(' ').filter(Boolean)
			},
			failure: null
		};
	} catch (failure) {
		return { userCode, request: null, failure: describeFailure(failure) };
	}
};
