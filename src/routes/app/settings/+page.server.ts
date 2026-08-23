import type { PageServerLoad } from './$types';

const DELETE_PHRASE = 'delete my account';

export const load: PageServerLoad = ({ locals, platform }) => ({
	email: locals.user!.email,
	deletePhrase: DELETE_PHRASE,
	vapidPublicKey: platform?.env.VAPID_PUBLIC_KEY ?? null
});
