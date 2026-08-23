import type { RequestHandler } from '@sveltejs/kit';
import { handleMcpRequest } from '$lib/server/mcp';
import { isPrincipal, protectedResourceMetadataUrl, resolvePrincipal } from '$lib/server/principal';

const challenge = async (event: Parameters<RequestHandler>[0], reason: 'missing' | 'invalid') => {
	const { baseURL } = await event.locals.auth.$context;
	const params = [
		`resource_metadata="${protectedResourceMetadataUrl(baseURL)}"`,
		reason === 'invalid' ? 'error="invalid_token"' : null
	]
		.filter(Boolean)
		.join(', ');
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			error: { code: -32001, message: reason === 'missing' ? 'Unauthorized' : 'Invalid token' },
			id: null
		}),
		{
			status: 401,
			headers: { 'content-type': 'application/json', 'www-authenticate': `Bearer ${params}` }
		}
	);
};

const serve: RequestHandler = async (event) => {
	const principal = await resolvePrincipal(event.locals.auth, event.locals.database, event.request);
	if (!isPrincipal(principal)) return challenge(event, principal.reason);
	return handleMcpRequest(event.locals.database, principal, event.request);
};

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
