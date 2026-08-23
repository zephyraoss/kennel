# kennel

A headless task list. Manage tasks through a REST API, a remote MCP server, or the small dashboard. SvelteKit on Cloudflare Workers with D1, better-auth, and drizzle.

## Setup

1. Create a GitHub OAuth app with callback `http://localhost:5173/api/auth/callback/github`.
2. Copy `.dev.vars.example` to `.dev.vars` and fill in the values.
3. `pnpm install && pnpm run db:migrate && pnpm dev`

For production, set the same four variables as worker secrets (`wrangler secret put ...`), create the D1 database, and run `pnpm run db:migrate:remote`, then `pnpm run cf:deploy`.

## Authentication

Every API and MCP request needs one of:

- **API key** — create one under _API keys_ in the dashboard. Send it as `Authorization: Bearer kn_...` or `x-api-key: kn_...`. Keys have full `tasks:read` + `tasks:write` access.
- **OAuth 2.1 access token** — register a client under _OAuth_ (or via dynamic client registration at `/api/auth/oauth2/register`), run the authorization-code + PKCE flow, and send the resulting token as a bearer token. Scopes are `tasks:read` and `tasks:write`. Users can see and revoke authorized apps on the same page.

Discovery:

- Authorization server: `/.well-known/oauth-authorization-server/api/auth`
- Protected resource (MCP): `/.well-known/oauth-protected-resource/mcp`

## REST API

Base: `/api/v1`

| Method   | Path         | Scope         |
| -------- | ------------ | ------------- |
| `GET`    | `/tasks`     | `tasks:read`  |
| `POST`   | `/tasks`     | `tasks:write` |
| `GET`    | `/tasks/:id` | `tasks:read`  |
| `PATCH`  | `/tasks/:id` | `tasks:write` |
| `DELETE` | `/tasks/:id` | `tasks:write` |

`GET /tasks` accepts `?status=open|done`, `?projectId=`, and `?label=`. Projects live at `/projects` (GET, POST) and `/projects/:id` (GET, PATCH, DELETE). Task fields: `title`, `notes`, `priority` (`none` | `low` | `medium` | `high`), `dueAt` (ISO 8601), `labels` (string array), `projectId`, `status` (`open` | `done`).

## MCP

Streamable HTTP endpoint at `/mcp`. Unauthenticated requests get an RFC 9728 challenge so MCP clients discover the OAuth flow automatically; API keys also work. Tools: `list_tasks`, `get_task`, `create_task`, `update_task`, `complete_task`, `delete_task`, `list_projects`, `create_project`, `delete_project`.

## Scripts

- `pnpm run auth:gen` regenerates `src/lib/server/db/schema/auth.ts` from the better-auth plugins (uses `auth.cli.ts`).
- `pnpm run db:gen` regenerates the auth schema and creates a drizzle migration.
