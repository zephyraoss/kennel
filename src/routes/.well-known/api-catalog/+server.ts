import type { RequestHandler } from './$types';
import { resourceUrls } from '$lib/server/auth';

const linkset = (origin: string) => {
	const urls = resourceUrls(origin);
	const docs = [{ href: `${origin}/docs`, type: 'text/html', title: 'kennel docs' }];

	return {
		linkset: [
			{
				anchor: urls.api,
				'service-desc': [
					{ href: `${origin}/openapi.json`, type: 'application/json', title: 'OpenAPI description' }
				],
				'service-doc': docs,
				'service-meta': [
					{
						href: `${origin}/.well-known/integrations.json`,
						type: 'application/json',
						title: 'Integration surfaces'
					}
				]
			},
			{
				anchor: urls.mcp,
				'service-desc': [
					{
						href: `${origin}/.well-known/mcp/server-card.json`,
						type: 'application/json',
						title: 'MCP server card'
					}
				],
				'service-doc': docs,
				'service-meta': [
					{
						href: `${origin}/.well-known/oauth-protected-resource/mcp`,
						type: 'application/json',
						title: 'Protected resource metadata'
					}
				]
			}
		]
	};
};

export const GET: RequestHandler = async ({ locals }) => {
	const { baseURL } = await locals.auth.$context;
	return new Response(JSON.stringify(linkset(new URL(baseURL).origin), null, 2), {
		headers: {
			'Content-Type': 'application/linkset+json',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
