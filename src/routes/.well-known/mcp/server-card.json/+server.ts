import type { RequestHandler } from './$types';
import { resourceUrls } from '$lib/server/auth';

const card = (origin: string) => ({
	name: 'kennel',
	description:
		'Read and write tasks, projects, and labels on a kennel task list. Filter and search tasks, complete them singly or in bulk, set manual order, and manage recurring tasks.',
	url: resourceUrls(origin).mcp,
	transport: 'streamable-http',
	documentation: `${origin}/docs`,
	authentication: {
		type: 'oauth2',
		authorization_server: `${origin}/api/auth`,
		resource_metadata: `${origin}/.well-known/oauth-protected-resource/mcp`,
		scopes_supported: ['tasks:read', 'tasks:write']
	}
});

export const GET: RequestHandler = async ({ locals }) => {
	const { baseURL } = await locals.auth.$context;
	return new Response(JSON.stringify(card(new URL(baseURL).origin), null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
