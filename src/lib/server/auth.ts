import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getRequestEvent } from '$app/server';
import type { Database } from '$lib/server/db';
import { corePlugins } from './auth-plugins';

export {
	API_KEY_PREFIX,
	OAUTH_SCOPES,
	TASK_SCOPES,
	resourceUrls,
	tokenAudience
} from './auth-plugins';

export type AuthEnv = {
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
};

export const createAuth = (drizzle: Database, env: AuthEnv) =>
	betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(drizzle, { provider: 'sqlite' }),
		user: { deleteUser: { enabled: true } },
		session: { freshAge: 0 },
		socialProviders: {
			github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
		},
		plugins: [...corePlugins(env.BETTER_AUTH_URL), sveltekitCookies(getRequestEvent)]
	});

export type Auth = ReturnType<typeof createAuth>;
