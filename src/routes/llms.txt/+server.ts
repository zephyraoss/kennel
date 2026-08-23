import type { RequestHandler } from './$types';
import { resourceUrls } from '$lib/server/auth';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { baseURL } = await locals.auth.$context;
	const urls = resourceUrls(baseURL);
	const body = `# kennel

> kennel is a simple task list with a dashboard, a REST API, and a remote MCP server so AI agents and your own apps can read and write tasks. It is open source under AGPL-3.0.

## Endpoints

- REST API base: ${urls.api}
- MCP server (Streamable HTTP): ${urls.mcp}
- OAuth issuer: ${baseURL}
- OAuth authorization server metadata: ${baseURL}/.well-known/oauth-authorization-server/api/auth
- OAuth protected resource metadata: ${baseURL}/.well-known/oauth-protected-resource/mcp

## Authentication

Every API and MCP request needs an API key or an OAuth 2.1 access token, sent as \`Authorization: Bearer <token>\`.
API keys start with \`kn_\`, are created in the dashboard, and have full read and write access.
OAuth uses the authorization-code flow with PKCE and supports dynamic client registration. Scopes are \`tasks:read\` and \`tasks:write\`.
Devices and terminals that cannot open a browser redirect can use the device authorization grant (RFC 8628): POST ${baseURL}/api/auth/device/code with client_id and scope, send the user to ${baseURL}/device with the user_code, and poll ${baseURL}/api/auth/oauth2/token with grant_type=urn:ietf:params:oauth:grant-type:device_code.

## REST API

- GET /tasks (query params: status=open|done, projectId, label)
- POST /tasks
- GET /tasks/:id
- PATCH /tasks/:id
- DELETE /tasks/:id
- GET /projects
- POST /projects
- GET /projects/:id
- PATCH /projects/:id
- DELETE /projects/:id

Task fields: title (required), notes, labels (string[]), projectId, status (open|done), priority (none|low|medium|high), dueAt (ISO 8601), repeat ({ every: day|week|month, interval: n } or null).
Completing a task with repeat set creates the next instance with dueAt advanced; complete_task returns it as "next".
Errors return a non-2xx status with \`{ "error": { "code": "...", "message": "..." } }\`.

## MCP tools

list_tasks, get_task, create_task, update_task, complete_task, delete_task, list_projects, create_project, delete_project

Example MCP client config:

\`\`\`json
{ "mcpServers": { "kennel": { "url": "${urls.mcp}", "headers": { "Authorization": "Bearer kn_..." } } } }
\`\`\`

## Pages

- [Home](${url.origin}/): overview and sign in
- [Docs](${url.origin}/docs): full API, MCP, and authentication reference
`;
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
