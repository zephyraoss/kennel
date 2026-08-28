import type { RequestHandler } from './$types';
import { resourceUrls } from '$lib/server/auth';

const document = (origin: string) => {
	const urls = resourceUrls(origin);
	const source = `${origin}/.well-known/integrations.json`;
	const basis = { via: 'declared', source } as const;

	const bearer = { source: 'http', in: 'header', headerName: 'Authorization', scheme: 'Bearer' };
	const apiKeyHeader = { source: 'http', in: 'header', headerName: 'x-api-key' };

	const entry = (id: string, mechanics: object) => ({ use: [{ id, mechanics }], basis });

	return {
		version: 3,
		summary:
			'kennel is a task list you can drive from an agent. It exposes a REST API and a remote MCP server over the same tasks, projects, and labels, authenticated with an API key or an OAuth 2.1 access token scoped to tasks:read and tasks:write.',
		credentials: {
			'api-key': {
				type: 'api_key',
				label: 'kennel API key',
				generateUrl: `${origin}/app/keys`,
				setup: [
					`Sign in at ${origin} and create a key on the [API keys](${origin}/app/keys) page.`,
					'',
					'Keys are prefixed `kn_` and are shown once, so copy the value when it is created. Every key carries both `tasks:read` and `tasks:write`; there is no way to scope one down, so use OAuth when a client should hold narrower or shorter-lived access.',
					'',
					'Send it either as `Authorization: Bearer kn_...` or as `x-api-key: kn_...`.'
				].join('\n')
			},
			'oauth-token': {
				type: 'oauth2',
				label: 'kennel OAuth 2.1 access token',
				generateUrl: `${origin}/app/oauth`,
				setup: [
					`Register a client on the [OAuth](${origin}/app/oauth) page, or let the client register itself through dynamic client registration at \`${origin}/api/auth/oauth2/register\`.`,
					'',
					`Run the authorization code flow with PKCE against the issuer \`${origin}/api/auth\`; its metadata lives at \`${origin}/.well-known/oauth-authorization-server/api/auth\`. Request \`tasks:read\`, \`tasks:write\`, or both.`,
					'',
					`Clients that cannot open a browser redirect can use the device authorization grant: POST \`${origin}/api/auth/device/code\`, send the user to \`${origin}/device\` with the user code, then poll \`${origin}/api/auth/oauth2/token\` with \`grant_type=urn:ietf:params:oauth:grant-type:device_code\`.`,
					'',
					'Send the resulting access token as `Authorization: Bearer <token>`. Users can revoke authorized apps from the same page.'
				].join('\n')
			}
		},
		surfaces: [
			{
				type: 'http',
				slug: 'kennel-api',
				name: 'kennel REST API',
				docs: `${origin}/docs`,
				url: urls.api,
				spec: `${origin}/openapi.json`,
				basis,
				auth: {
					status: 'required',
					entries: [
						entry('api-key', bearer),
						entry('api-key', apiKeyHeader),
						entry('oauth-token', bearer)
					]
				}
			},
			{
				type: 'mcp',
				slug: 'kennel-mcp',
				name: 'kennel MCP server',
				docs: `${origin}/docs`,
				url: urls.mcp,
				transports: ['streamable-http'],
				basis,
				auth: {
					status: 'required',
					entries: [
						entry('oauth-token', { source: 'well-known' }),
						entry('api-key', bearer),
						entry('api-key', apiKeyHeader)
					]
				}
			}
		]
	};
};

export const GET: RequestHandler = async ({ locals }) => {
	const { baseURL } = await locals.auth.$context;
	return new Response(JSON.stringify(document(new URL(baseURL).origin), null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
