import type { Auth } from '$lib/server/auth';
import type { Database } from '$lib/server/db';

type SessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

declare global {
	namespace App {
		interface Platform {
			env: Env;
			cf: CfProperties;
			ctx: ExecutionContext;
		}

		interface Locals {
			auth: Auth;
			database: Database;
			session?: SessionData['session'];
			user?: SessionData['user'];
		}
	}

	interface Env {
		BETTER_AUTH_URL: string;
		BETTER_AUTH_SECRET: string;
		GITHUB_CLIENT_ID: string;
		GITHUB_CLIENT_SECRET: string;
	}
}

export {};
