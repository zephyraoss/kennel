# kennel

kennel is a simple task list. Talk to it over a REST API, over a remote MCP server, or through the dashboard if you'd rather click.

## Setup

1. Create a GitHub OAuth app with callback `http://localhost:5173/api/auth/callback/github`.
2. Copy `.dev.vars.example` to `.dev.vars` and fill in the values. Generate the VAPID pair with `pnpm dlx @pushforge/builder vapid`; the private key is the whole JWK JSON on one line.
3. `pnpm install && pnpm run db:migrate && pnpm dev`

For production, set the same variables as worker secrets with `wrangler secret put`, create the D1 database, run `pnpm run db:migrate:remote`, then `pnpm run cf:deploy`.

## Reminders

A cron trigger on the same worker runs every 15 minutes (see `triggers.crons` in `wrangler.jsonc`) and sends a web push notification the day before a task is due and again when it's due. Users opt in per device from the settings page. `vite dev` doesn't run cron triggers; use `pnpm run preview` (which is `wrangler dev`) with `--test-scheduled` and hit `/__scheduled` to run one by hand.

## Authentication

Every API and MCP request needs an API key or an OAuth access token.

API keys come from the _API keys_ page in the dashboard. Send one as `Authorization: Bearer kn_...` or as `x-api-key: kn_...`. A key always has both `tasks:read` and `tasks:write`. There's no way to scope one down.

OAuth 2.1 is for clients that shouldn't hold a long-lived key. Register a client on the _OAuth_ page, or let the client register itself through dynamic client registration at `/api/auth/oauth2/register`. Then run the authorization-code flow with PKCE and send the resulting token as a bearer token. Scopes are `tasks:read` and `tasks:write`. Users can see and revoke authorized apps on the same page.

Discovery documents live at `/.well-known/oauth-authorization-server/api/auth` for the authorization server and `/.well-known/oauth-protected-resource/mcp` for the MCP resource.

## REST API

Base path is `/api/v1`.

| Method   | Path         | Scope         |
| -------- | ------------ | ------------- |
| `GET`    | `/tasks`     | `tasks:read`  |
| `POST`   | `/tasks`     | `tasks:write` |
| `GET`    | `/tasks/:id` | `tasks:read`  |
| `PATCH`  | `/tasks/:id` | `tasks:write` |
| `DELETE` | `/tasks/:id` | `tasks:write` |

`GET /tasks` filters on `?status=open|done`, `?projectId=`, and `?label=`. Projects follow the same shape at `/projects` (GET, POST) and `/projects/:id` (GET, PATCH, DELETE).

A task has `title`, `notes`, `priority` (`none`, `low`, `medium`, or `high`), `dueAt` as an ISO 8601 string, `repeat` (`{ "every": "day" | "week" | "month", "interval": 1 }` or null), `labels` as a string array, `projectId`, `position` (an integer sort key, lower first), and `status` (`open` or `done`). Completing a task with `repeat` set creates the next instance, with `dueAt` advanced from the previous one until it lands in the future.

## MCP

The streamable HTTP endpoint is `/mcp`. An unauthenticated request gets an RFC 9728 challenge back, which is how MCP clients find the OAuth flow on their own. API keys work here too.

Tools: `list_tasks`, `get_task`, `create_task`, `update_task`, `complete_task`, `delete_task`, `update_tasks`, `complete_tasks`, `reorder_tasks`, `list_labels`, `list_projects`, `create_project`, `delete_project`.

## Scripts

`pnpm run auth:gen` regenerates `src/lib/server/db/schema/auth.ts` from the better-auth plugins configured in `auth.cli.ts`. `pnpm run db:gen` runs that and then creates a drizzle migration, so it's the one to reach for after changing auth config.

## License

AGPL-3.0. See [LICENSE](LICENSE).
