import type { PageServerLoad } from './$types';
import { resourceUrls } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	const { baseURL } = await locals.auth.$context;
	return { issuer: baseURL, urls: resourceUrls(baseURL) };
};
